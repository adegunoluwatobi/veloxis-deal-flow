import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { INSTRUMENT_CODES, buildTokens, render } from '../_shared/instruments.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function toPdf(title: string, text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size = 10.5;
  const margin = 56;
  let page = pdf.addPage([595.28, 841.89]);
  let y = 841.89 - margin;

  const maxWidth = 595.28 - margin * 2;
  const wrap = (line: string) => {
    if (!line) return [''];
    const words = line.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  page.drawText(title, { x: margin, y, size: 14, font: bold, color: rgb(0.04, 0.24, 0.18) });
  y -= 26;

  for (const raw of text.split('\n')) {
    for (const line of wrap(raw)) {
      if (y < margin) { page = pdf.addPage([595.28, 841.89]); y = 841.89 - margin; }
      page.drawText(line, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
      y -= size * 1.55;
    }
  }
  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Not signed in' }, 401);

    const admin = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body.invoice_id ?? '');
    if (!invoiceId) return json({ error: 'invoice_id is required' }, 400);

    // Either the approval trigger (service role) or a signed in reviewer.
    let actorId: string | null = null;
    let actorRole = 'system';
    if (token !== service) {
      const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: 'Not signed in' }, 401);
      actorId = u.user.id;
      const { data: roles } = await admin.from('app_user_roles').select('role').eq('user_id', actorId);
      const list = (roles ?? []).map((r: any) => r.role);
      actorRole = list.join(',') || 'unknown';
      if (!list.some((r: string) => ['credit_officer', 'approver', 'super_admin'].includes(r))) {
        return json({ error: 'You are not permitted to generate these documents' }, 403);
      }
    }

    const { data: inv } = await admin.from('v2_invoices').select('*').eq('id', invoiceId).maybeSingle();
    if (!inv) return json({ error: 'Application not found' }, 404);

    const [{ data: exporter }, { data: buyer }, { data: bank }] = await Promise.all([
      admin.from('v2_exporters').select('*').eq('id', inv.exporter_id).maybeSingle(),
      inv.buyer_id
        ? admin.from('v2_buyers').select('*').eq('id', inv.buyer_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      admin.from('exporter_bank_accounts').select('*').eq('exporter_id', inv.exporter_id)
        .order('is_default', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const { data: signatory } = inv.signatory_id
      ? await admin.from('authorised_signatories').select('*').eq('id', inv.signatory_id).maybeSingle()
      : { data: null } as any;

    const tokens = buildTokens({ invoice: inv, exporter, buyer, signatory, bank });

    const { data: templates } = await admin.from('document_templates')
      .select('*').in('code', INSTRUMENT_CODES as unknown as string[]).eq('active', true);
    const { data: types } = await admin.from('document_types')
      .select('id, code, label').in('code', INSTRUMENT_CODES as unknown as string[]).eq('level', 'invoice');

    const created: any[] = [];
    const unresolved: string[] = [];

    for (const code of INSTRUMENT_CODES) {
      const tpl = (templates ?? []).find((t: any) => t.code === code);
      const type = (types ?? []).find((t: any) => t.code === code);
      if (!tpl || !type) continue;

      const { out, missing } = render(tpl.body, tokens);
      unresolved.push(...missing);

      const bytes = await toPdf(tpl.label, out);

      const { data: prior } = await admin.from('invoice_documents')
        .select('id, version').eq('invoice_id', invoiceId).eq('document_type_id', type.id)
        .order('version', { ascending: false });
      const nextVersion = ((prior ?? [])[0]?.version ?? 0) + 1;

      const filename = `${code}-v${nextVersion}.pdf`;
      const path = `${inv.exporter_id}/invoices/${invoiceId}/generated/${Date.now()}-${filename}`;

      const up = await admin.storage.from('veloxis-documents')
        .upload(path, bytes, { contentType: 'application/pdf', upsert: false });
      if (up.error) return json({ error: up.error.message }, 500);

      const { data: doc, error: insErr } = await admin.from('invoice_documents').insert({
        invoice_id: invoiceId,
        document_type_id: type.id,
        storage_path: path,
        original_filename: filename,
        file_size_bytes: bytes.byteLength,
        version: nextVersion,
        uploaded_by: actorId,
        status: 'pending',
        source: 'veloxis_generated',
        template_id: tpl.id,
        template_version: tpl.version,
        scan_status: 'clean',
        scanned_at: new Date().toISOString(),
        scan_detail: 'Generated by Veloxis',
      }).select('id').single();
      if (insErr) return json({ error: insErr.message }, 500);

      // supersede the previous version and any open signature requests against it
      for (const p of prior ?? []) {
        await admin.from('invoice_documents').update({ superseded_by: doc.id }).eq('id', p.id).is('superseded_by', null);
        await admin.from('invoice_signature_requests')
          .update({ status: 'expired' }).eq('document_id', p.id).in('status', ['not_sent', 'sent', 'viewed']);
      }

      await admin.from('document_audit_log').insert({
        entity_type: 'invoice_document', entity_id: doc.id, invoice_id: invoiceId,
        exporter_id: inv.exporter_id, action: 'document_generated',
        actor_id: actorId, actor_role: actorRole,
        metadata: {
          code, template_id: tpl.id, template_version: tpl.version, version: nextVersion,
          unresolved_tokens: missing,
          before: { version: (prior ?? [])[0]?.version ?? null },
          after: { version: nextVersion },
        },
      });

      created.push({ code, document_id: doc.id, version: nextVersion, template_version: tpl.version });
    }

    return json({ created, unresolved_tokens: Array.from(new Set(unresolved)) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
