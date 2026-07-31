import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { INSTRUMENT_CODES, SIGNER_PLAN, InstrumentCode } from '../_shared/instruments.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Read only inside the edge function. Never logged, never returned in a response.
const HS_KEY = Deno.env.get('DROPBOX_SIGN_API_KEY') ?? Deno.env.get('HELLOSIGN_API_KEY') ?? '';


const basic = () => 'Basic ' + btoa(`${HS_KEY}:`);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);
    if (!HS_KEY) return json({ error: 'Electronic signature is not configured yet. Add the signing provider key.' }, 400);

    const admin = createClient(url, service);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'Not signed in' }, 401);
    const actorId = u.user.id;

    const { data: roles } = await admin.from('app_user_roles').select('role').eq('user_id', actorId);
    const list = (roles ?? []).map((r: any) => r.role);
    if (!list.some((r: string) => ['approver', 'super_admin'].includes(r))) {
      return json({ error: 'Only the Approver or a Super Admin may send documents for signature' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body.invoice_id ?? '');
    if (!invoiceId) return json({ error: 'invoice_id is required' }, 400);

    const { data: inv } = await admin.from('v2_invoices')
      .select('id, reference, invoice_number, exporter_id, signatory_id, board_resolution_id').eq('id', invoiceId).maybeSingle();
    if (!inv) return json({ error: 'Application not found' }, 404);
    if (!inv.signatory_id) return json({ error: 'No authorised signatory is recorded on this application' }, 400);

    const { data: sig } = await admin.from('authorised_signatories')
      .select('id, full_name, email, position, board_resolution_id').eq('id', inv.signatory_id).maybeSingle();
    if (!sig?.email) return json({ error: 'The authorised signatory has no email address on file' }, 400);
    if (!inv.board_resolution_id || sig.board_resolution_id !== inv.board_resolution_id) {
      return json({ error: 'The signatory is not named on the board resolution relied upon. Correct this before sending.' }, 400);
    }

    // Veloxis counterparty
    const { data: cfg } = await admin.from('v2_system_config').select('key, value')
      .in('key', ['veloxis_signatory_name', 'veloxis_signatory_email']);
    const cfgMap: Record<string, string> = {};
    (cfg ?? []).forEach((c: any) => { cfgMap[c.key] = String(c.value).replace(/^"|"$/g, ''); });
    const veloxisName = cfgMap.veloxis_signatory_name || 'Veloxis approver';
    const veloxisEmail = cfgMap.veloxis_signatory_email || u.user.email || '';
    if (!veloxisEmail) return json({ error: 'No Veloxis countersignatory email is configured' }, 400);

    const { data: types } = await admin.from('document_types')
      .select('id, code, label').in('code', INSTRUMENT_CODES as unknown as string[]).eq('level', 'invoice');
    const { data: docs } = await admin.from('invoice_documents')
      .select('id, document_type_id, storage_path, original_filename, version')
      .eq('invoice_id', invoiceId).is('superseded_by', null).eq('source', 'veloxis_generated');

    const results: any[] = [];
    for (const code of INSTRUMENT_CODES) {
      const type = (types ?? []).find((t: any) => t.code === code);
      const doc = (docs ?? []).find((d: any) => d.document_type_id === type?.id);
      if (!type || !doc) return json({ error: `The ${code.replace(/_/g, ' ')} has not been generated yet` }, 400);

      const { data: file, error: dlErr } = await admin.storage.from('veloxis-documents').download(doc.storage_path);
      if (dlErr || !file) return json({ error: `Could not read the generated ${code}` }, 500);

      const form = new FormData();
      form.append('title', `${type.label} · ${inv.reference ?? inv.invoice_number}`);
      form.append('subject', `${type.label} for ${inv.reference ?? inv.invoice_number}`);
      form.append('message', 'Please review and sign this document electronically.');
      form.append('test_mode', HS_TEST ? '1' : '0');
      form.append('file[0]', file, doc.original_filename ?? `${code}.pdf`);

      const plan = SIGNER_PLAN[code as InstrumentCode];
      plan.forEach((role, idx) => {
        const isExporter = role === 'exporter_signatory';
        form.append(`signers[${idx}][name]`, isExporter ? (sig.full_name ?? 'Authorised signatory') : veloxisName);
        form.append(`signers[${idx}][email_address]`, isExporter ? sig.email! : veloxisEmail);
        form.append(`signers[${idx}][order]`, String(idx));
      });
      form.append('metadata[invoice_id]', invoiceId);
      form.append('metadata[document_id]', doc.id);
      form.append('metadata[code]', code);

      const res = await fetch('https://api.hellosign.com/v3/signature_request/send', {
        method: 'POST', headers: { Authorization: basic() }, body: form,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        return json({ error: payload?.error?.error_msg ?? 'The signing provider rejected the request', code }, 502);
      }
      const requestId = payload?.signature_request?.signature_request_id ?? null;
      const providerSigners = payload?.signature_request?.signatures ?? [];

      for (let idx = 0; idx < plan.length; idx++) {
        const role = plan[idx];
        const isExporter = role === 'exporter_signatory';
        await admin.from('invoice_signature_requests').insert({
          invoice_id: invoiceId,
          document_id: doc.id,
          provider: 'hellosign',
          provider_request_id: requestId,
          signer_role: role,
          signer_name: isExporter ? sig.full_name : veloxisName,
          signer_email: isExporter ? sig.email : veloxisEmail,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      }

      await admin.from('document_audit_log').insert({
        entity_type: 'invoice_document', entity_id: doc.id, invoice_id: invoiceId,
        exporter_id: inv.exporter_id, action: 'signature_requested', actor_id: actorId,
        actor_role: list.join(','),
        metadata: { code, provider: 'hellosign', provider_request_id: requestId, signers: plan, signer_count: providerSigners.length },
      });

      results.push({ code, provider_request_id: requestId, signers: plan.length });
    }

    await admin.rpc('v2_notify_exporter', {
      p_invoice_id: invoiceId,
      p_title: 'Documents ready for your signature',
      p_message: 'We have prepared your assignment documents. You will receive an email asking you to sign them electronically.',
      p_type: 'action_required',
    });

    return json({ sent: results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
