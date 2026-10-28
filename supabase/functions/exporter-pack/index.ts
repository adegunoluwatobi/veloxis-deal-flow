import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'npm:pdf-lib@1.17.1';
import JSZip from 'npm:jszip@3.10.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'veloxis-documents';
const STAFF = ['originator', 'credit_officer', 'approver', 'super_admin'];
const PERSON_CODES = ['director_id', 'proof_of_address', 'passport_photo'];
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const safe = (s: string) => (s || '').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
// Standard fonts are WinAnsi only; strip anything else so drawing never throws.
const ascii = (v: unknown) => String(v ?? '').replace(/[^\x20-\x7E]/g, '?');
const maskTail = (v?: string | null) => (v ? `•••• ${String(v).slice(-4)}`.replace('••••', '****') : '');
const fmtDate = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  let body: { exporter_id?: string; mode?: string; field?: string; person_id?: string; purpose?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { exporter_id, mode } = body;
  if (!exporter_id || !uuidRe.test(exporter_id) || !['full', 'summary', 'zip', 'reveal'].includes(mode ?? '')) {
    return json({ error: 'exporter_id (uuid) and mode (full|summary|zip|reveal) are required' }, 400);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  const user = u?.user;
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const { data: roleRows } = await userClient.from('app_user_roles').select('role').eq('user_id', user.id);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r) => STAFF.includes(r))) return json({ error: 'Forbidden' }, 403);

  // RLS decides whether this staff member may see this exporter (BDs: own only).
  const { data: visible } = await userClient.from('v2_exporters').select('id').eq('id', exporter_id).maybeSingle();
  if (!visible) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const audit = (action: string, metadata: Record<string, unknown>) =>
    admin.from('document_audit_log').insert({
      entity_type: 'exporter', entity_id: exporter_id, exporter_id, action,
      actor_id: user.id, actor_role: roles.join(','), metadata: { at: new Date().toISOString(), ...metadata },
    });

  const [{ data: exp }, { data: people }, { data: docs }, { data: prof }] = await Promise.all([
    admin.from('v2_exporters').select('*').eq('id', exporter_id).single(),
    admin.from('v2_exporter_directors').select('*').eq('exporter_id', exporter_id).order('is_primary', { ascending: false }).order('created_at'),
    admin.from('company_documents').select('id, storage_path, original_filename, issue_date, uploaded_at, status, person_id, scan_status, document_types(code, label, sort_order)')
      .eq('exporter_id', exporter_id).eq('scan_status', 'clean').order('uploaded_at'),
    admin.from('profiles').select('name, email').eq('user_id', user.id).maybeSingle(),
  ]);
  if (!exp) return json({ error: 'Not found' }, 404);

  // ---- Reveal a masked value (audited) ----
  if (mode === 'reveal') {
    const field = body.field ?? '';
    let value: string | null = null;
    if (field === 'account_number') value = (exp.bank_details as any)?.account_number ?? null;
    else if (['bvn', 'id_number'].includes(field) && body.person_id && uuidRe.test(body.person_id)) {
      value = (people ?? []).find((p: any) => p.id === body.person_id)?.[field] ?? null;
    } else if (field === 'director_id_number') value = exp.director_id_number ?? null;
    else return json({ error: 'Unknown field' }, 400);
    await audit('sensitive_field_revealed', { field, person_id: body.person_id ?? null });
    return json({ value });
  }

  const allDocs = (docs ?? []) as any[];
  const personOf = (d: any) => d.person_id ?? (PERSON_CODES.includes(d.document_types?.code)
    ? (people ?? []).find((p: any) => p.is_primary)?.id ?? null : null);
  const ordered = [
    ...allDocs.filter((d) => !personOf(d)).sort((a, b) => (a.document_types?.sort_order ?? 0) - (b.document_types?.sort_order ?? 0)),
    ...(people ?? []).flatMap((p: any) => allDocs.filter((d) => personOf(d) === p.id)),
  ];
  const personName = (d: any) => (people ?? []).find((p: any) => p.id === personOf(d))?.full_name ?? null;
  const rc = exp.company_registration_number ?? exp.rc_number ?? 'NA';
  const date = new Date().toISOString().slice(0, 10);
  const base = `${safe(exp.company_name)}_${safe(rc)}_KYB_Pack_${date}`;

  const download = async (path: string) => {
    const { data, error } = await admin.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  };

  // ---- ZIP of originals ----
  if (mode === 'zip') {
    const zip = new JSZip();
    const used = new Set<string>();
    for (const d of ordered) {
      const bytes = await download(d.storage_path);
      if (!bytes) continue;
      const folder = safe(d.document_types?.label ?? 'Other') || 'Other';
      const who = personName(d);
      let name = `${folder}/${who ? safe(who) + '_' : ''}${d.original_filename ?? 'file'}`;
      let i = 2; while (used.has(name)) name = name.replace(/(\.[^.]+)?$/, `_${i++}$1`);
      used.add(name);
      zip.file(name, bytes);
    }
    const out = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
    await audit('kyb_pack_downloaded', { format: 'zip', files: used.size });
    return new Response(out, { headers: { ...corsHeaders, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${base}.zip"` } });
  }

  // ---- PDF ----
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 50;
  const teal = rgb(0.04, 0.24, 0.18), grey = rgb(0.4, 0.4, 0.4);
  const generatedBy = prof?.name || prof?.email || user.email || user.id;
  const now = new Date();

  const text = (p: PDFPage, s: string, x: number, y: number, size = 10, f: PDFFont = font, color = rgb(0, 0, 0)) =>
    p.drawText(ascii(s), { x, y, size, font: f, color });
  const wrap = (s: string, f: PDFFont, size: number, max: number) => {
    const out: string[] = []; let line = '';
    for (const w of ascii(s).split(' ')) {
      const t = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > max && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line); return out;
  };

  // Cover
  const cover = pdf.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: H - 160, width: W, height: 160, color: teal });
  text(cover, 'VELOXIS', M, H - 90, 32, bold, rgb(0.37, 1, 0.84));
  text(cover, 'KYB / KYC Review Pack', M, H - 120, 14, font, rgb(1, 1, 1));
  let y = H - 240;
  const coverRow = (k: string, v: string) => { text(cover, k, M, y, 10, font, grey); text(cover, v || '-', M + 150, y, 12, bold); y -= 28; };
  coverRow('Company', exp.company_name);
  coverRow('RC number', rc);
  coverRow('Current status', String(exp.onboarding_status) + (exp.bd_approved_at ? ' (BD approved)' : ''));
  coverRow('Generated', now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC');
  coverRow('Generated by', generatedBy);
  coverRow('Contents', mode === 'full' ? `Summary + ${ordered.length} document(s)` : 'Summary only');

  // Summary tables
  let page = pdf.addPage([W, H]); y = H - M;
  const ensure = (need: number) => { if (y - need < M + 30) { page = pdf.addPage([W, H]); y = H - M; } };
  const heading = (s: string) => { ensure(40); y -= 10; text(page, s, M, y, 14, bold, teal); y -= 8; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: teal }); y -= 18; };
  const row = (k: string, v: unknown) => {
    const lines = wrap(String(v ?? '') || '-', font, 10, W - M * 2 - 170);
    ensure(lines.length * 13 + 6);
    text(page, k, M, y, 9, bold, grey);
    lines.forEach((l, i) => text(page, l, M + 170, y - i * 13, 10));
    y -= lines.length * 13 + 6;
  };
  const b = (exp.bank_details ?? {}) as any;
  heading('Business details');
  row('Company name', exp.company_name);
  row('CAC RC number', rc);
  row('Date of incorporation', fmtDate(exp.incorporation_date));
  row('Country of incorporation', exp.country_of_incorporation);
  row('Industry / commodity', [exp.industry, exp.commodity].filter(Boolean).join(' / '));
  row('TIN', exp.tax_id);
  row('NEPC registration', [exp.nepc_number, exp.nepc_status].filter(Boolean).join(' - '));
  row('Registered address', [exp.address_street, exp.address_city, exp.address_state, exp.address_country].filter(Boolean).join(', ') || exp.address);
  row('Phone', exp.phone); row('Email', exp.email); row('Website', exp.website);
  heading('Banking');
  row('Access Bank customer', exp.banks_with_access == null ? '' : exp.banks_with_access ? 'Yes' : 'No');
  if (exp.banks_with_access === false) row('Banks used', (exp.other_banks ?? []).join(', '));
  row('Main account bank', exp.banks_with_access ? 'Access Bank' : b.bank_name);
  row('Account name', b.account_name);
  row('Account number', maskTail(b.account_number));
  row('Account type', b.account_type); row('Branch', b.branch); row('SWIFT / BIC', b.swift);
  row('Letters of introduction', allDocs.filter((d) => d.document_types?.code === 'bank_reference_letter').map((d) => d.original_filename).join(', ') || 'None uploaded');
  heading('Directors & shareholders');
  (people ?? []).forEach((p: any, i: number) => {
    ensure(60); text(page, `${i + 1}. ${p.full_name}`, M, y, 11, bold); y -= 16;
    row('Role', p.person_role === 'both' ? 'Director & Shareholder' : p.person_role === 'shareholder' ? 'Shareholder' : 'Director');
    if (p.shareholding_pct != null) row('Shareholding', `${p.shareholding_pct}%`);
    row('Date of birth', fmtDate(p.dob)); row('Nationality', p.nationality);
    row('Email / phone', [p.email, p.phone].filter(Boolean).join(' / '));
    row('Address', [p.address_street, p.address_city, p.address_state, p.address_country].filter(Boolean).join(', ') || p.address);
    row('ID', [p.id_type, maskTail(p.id_number), p.id_expiry && `expires ${fmtDate(p.id_expiry)}`].filter(Boolean).join(' - '));
    row('BVN', maskTail(p.bvn));
    y -= 6;
  });
  heading('Document register');
  ordered.forEach((d) => row(d.document_types?.label ?? 'Document',
    `${d.original_filename ?? ''}${personName(d) ? ` (${personName(d)})` : ''} - ${d.status === 'verified' ? 'Approved' : d.status === 'rejected' ? 'Rejected' : 'Awaiting review'} - uploaded ${fmtDate(d.uploaded_at)}${d.issue_date ? `, issued ${fmtDate(d.issue_date)}` : ''}`));

  // Appended documents
  const skipped: string[] = [];
  if (mode === 'full') {
    for (const d of ordered) {
      const div = pdf.addPage([W, H]);
      div.drawRectangle({ x: 0, y: H / 2 - 70, width: W, height: 140, color: teal });
      text(div, d.document_types?.label ?? 'Document', M, H / 2 + 20, 20, bold, rgb(1, 1, 1));
      text(div, personName(d) ?? exp.company_name, M, H / 2 - 10, 13, font, rgb(0.37, 1, 0.84));
      text(div, d.original_filename ?? '', M, H / 2 - 35, 10, font, rgb(1, 1, 1));
      const bytes = await download(d.storage_path);
      const name = (d.original_filename ?? d.storage_path).toLowerCase();
      try {
        if (!bytes) throw new Error('missing');
        if (name.endsWith('.pdf')) {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          (await pdf.copyPages(src, src.getPageIndices())).forEach((pg) => pdf.addPage(pg));
        } else if (/\.(jpe?g|png)$/.test(name)) {
          const img = name.endsWith('.png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const pg = pdf.addPage([W, H]);
          const s = Math.min((W - M * 2) / img.width, (H - M * 2 - 30) / img.height, 1);
          pg.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2 + 10, width: img.width * s, height: img.height * s });
        } else throw new Error('type');
      } catch {
        skipped.push(d.original_filename ?? d.id);
        text(div, 'This file could not be embedded - see the ZIP download for the original.', M, H / 2 - 100, 10, font, grey);
      }
    }
  }

  // Footers
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const { width } = p.getSize();
    p.drawText('Strictly Private & Confidential', { x: M, y: 22, size: 8, font: bold, color: grey });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: width - M - font.widthOfTextAtSize(label, 8), y: 22, size: 8, font, color: grey });
  });

  const out = await pdf.save();
  await audit(body.purpose === 'send' ? 'kyb_pack_generated' : 'kyb_pack_downloaded', { format: mode === 'full' ? 'pdf_full' : 'pdf_summary', documents: mode === 'full' ? ordered.length : 0, skipped });
  const fname = mode === 'full' ? `${base}.pdf` : `${base.replace('_KYB_Pack_', '_KYB_Summary_')}.pdf`;
  return new Response(out, { headers: { ...corsHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fname}"` } });
});
