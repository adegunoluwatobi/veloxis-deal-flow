import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const url = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Read only inside the edge function. Never logged, never returned in a response.
const HS_KEY = Deno.env.get('DROPBOX_SIGN_API_KEY') ?? '';

const basic = () => 'Basic ' + btoa(`${HS_KEY}:`);

async function eventHash(eventTime: string, eventType: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(HS_KEY),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${eventTime}${eventType}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const STATUS_BY_EVENT: Record<string, string> = {
  signature_request_viewed: 'viewed',
  signature_request_signed: 'signed',
  signature_request_all_signed: 'signed',
  signature_request_declined: 'declined',
  signature_request_expired: 'expired',
  signature_request_sent: 'sent',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ok = () => new Response('Hello API Event Received', { status: 200, headers: corsHeaders });
  const admin = createClient(url, service);

  const security = async (reason: string, metadata: Record<string, unknown>) => {
    await admin.from('document_audit_log').insert({
      entity_type: 'security_event',
      entity_id: crypto.randomUUID(),
      action: 'webhook_rejected',
      actor_role: 'system',
      reason,
      metadata: { source: 'dropbox_sign_webhook', ...metadata },
    });
  };

  try {
    if (req.method !== 'POST') {
      await security('Unsupported method on the signing callback', { method: req.method });
      return new Response('Rejected', { status: 400, headers: corsHeaders });
    }

    // No key configured means no callback can ever be trusted.
    if (!HS_KEY) {
      await security('Signing callback received while no provider key is configured', {});
      return new Response('Rejected', { status: 400, headers: corsHeaders });
    }

    let raw = '';
    try {
      const form = await req.formData();
      raw = String(form.get('json') ?? '');
    } catch {
      raw = '';
    }
    if (!raw) {
      await security('Signing callback had no payload', {});
      return new Response('Rejected', { status: 400, headers: corsHeaders });
    }

    let payload: any;
    try { payload = JSON.parse(raw); } catch {
      await security('Signing callback payload was not valid JSON', {});
      return new Response('Rejected', { status: 400, headers: corsHeaders });
    }

    const event = payload.event ?? {};
    const eventTime = String(event.event_time ?? '');
    const eventType = String(event.event_type ?? '');
    const providedHash = String(event.event_hash ?? '').toLowerCase();

    // Mandatory HMAC verification on every callback.
    if (!eventTime || !eventType || !providedHash) {
      await security('Signing callback was missing the event signature fields', { event_type: eventType });
      return new Response('Rejected', { status: 400, headers: corsHeaders });
    }
    const expected = await eventHash(eventTime, eventType);
    if (!timingSafeEqual(expected, providedHash)) {
      await security('Signing callback failed HMAC verification', { event_type: eventType, event_time: eventTime });
      return new Response('Rejected', { status: 400, headers: corsHeaders });
    }

    const sr = payload.signature_request ?? {};
    const requestId = sr.signature_request_id as string | undefined;
    const status = STATUS_BY_EVENT[eventType];

    // Callback test events carry no signature request. Acknowledge without touching data.
    if (eventType === 'callback_test') return ok();

    if (!requestId) {
      await security('Signing callback carried no signature request id', { event_type: eventType });
      return new Response('Rejected', { status: 400, headers: corsHeaders });
    }

    const { data: rows } = await admin.from('invoice_signature_requests')
      .select('*').eq('provider_request_id', requestId);

    // The callback must correspond to a signature request we created.
    if (!rows?.length) {
      await security('Signing callback referenced an unknown signature request', {
        event_type: eventType, provider_request_id: requestId,
      });
      return new Response('Rejected', { status: 400, headers: corsHeaders });
    }

    if (!status) return ok();

    const invoiceId = rows[0].invoice_id as string;
    const documentId = rows[0].document_id as string | null;
    const { data: inv } = await admin.from('v2_invoices').select('exporter_id').eq('id', invoiceId).maybeSingle();

    // Per signer status from the provider payload where available.
    const signatures: any[] = sr.signatures ?? [];
    for (const row of rows) {
      const match = signatures.find((s) => (s.signer_email_address ?? '').toLowerCase() === (row.signer_email ?? '').toLowerCase());
      let next = status;
      if (match?.status_code) {
        next = match.status_code === 'signed' ? 'signed'
          : match.status_code === 'declined' ? 'declined'
            : match.status_code === 'viewed' ? 'viewed'
              : match.status_code === 'awaiting_signature' ? 'sent' : status;
      }
      await admin.from('invoice_signature_requests').update({
        status: next,
        completed_at: next === 'signed' ? new Date().toISOString() : row.completed_at,
      }).eq('id', row.id);
    }

    const allSigned = eventType === 'signature_request_all_signed' || (sr.is_complete === true);

    // A test-mode envelope is not a binding execution. It must never look like a
    // verified Stage 2 document, and must never store a certificate of completion,
    // because the disbursement gate reads that certificate.
    const isTest = sr.test_mode === true || sr.test_mode === 1 || sr.test_mode === '1'
      || String(sr.metadata?.mode ?? '') === 'test';

    let certificatePath: string | null = null;

    if (allSigned && documentId) {
      // Fetch the executed PDF, which carries the certificate of completion.
      const res = await fetch(`https://api.hellosign.com/v3/signature_request/files/${requestId}?file_type=pdf`, {
        headers: { Authorization: basic() },
      });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const { data: doc } = await admin.from('invoice_documents')
          .select('id, invoice_id, document_type_id, version, template_id, template_version, original_filename')
          .eq('id', documentId).maybeSingle();
        if (doc) {
          const nextVersion = (doc.version ?? 1) + 1;
          const base = (doc.original_filename ?? 'document.pdf').replace(/\.pdf$/i, '');
          const name = `${isTest ? 'TEST-' : ''}${base}-signed-v${nextVersion}.pdf`;
          const path = `${inv?.exporter_id}/invoices/${invoiceId}/generated/${Date.now()}-${name}`;
          const up = await admin.storage.from('veloxis-documents')
            .upload(path, bytes, { contentType: 'application/pdf' });
          if (!up.error) {
            certificatePath = isTest ? null : path;
            const { data: newDoc } = await admin.from('invoice_documents').insert({
              invoice_id: invoiceId,
              document_type_id: doc.document_type_id,
              storage_path: path,
              original_filename: name,
              file_size_bytes: bytes.byteLength,
              version: nextVersion,
              status: isTest ? 'pending' : 'verified',
              reviewed_at: isTest ? null : new Date().toISOString(),
              source: 'veloxis_generated',
              template_id: doc.template_id,
              template_version: doc.template_version,
              scan_status: 'clean',
              scanned_at: new Date().toISOString(),
              scan_detail: isTest
                ? 'Test mode copy returned by the signing provider. Not a binding signature.'
                : 'Executed copy returned by the signing provider',
            }).select('id').single();
            await admin.from('invoice_documents').update({ superseded_by: newDoc?.id }).eq('id', documentId);
            await admin.from('invoice_signature_requests')
              .update({ certificate_path: certificatePath, document_id: newDoc?.id ?? documentId })
              .eq('provider_request_id', requestId);
          }
        }
      }
    }

    await admin.from('document_audit_log').insert({
      entity_type: 'signature_request',
      entity_id: rows[0].id,
      invoice_id: invoiceId,
      exporter_id: inv?.exporter_id ?? null,
      action: status === 'declined' ? 'signature_declined' : allSigned ? 'signature_completed' : 'signature_requested',
      actor_role: 'system',
      metadata: {
        provider_request_id: requestId, event: eventType, mode: isTest ? 'test' : 'production',
        after: { status, certificate_path: certificatePath },
      },
    });

    if (!isTest && (allSigned || status === 'declined')) {
      await admin.rpc('v2_notify_exporter', {
        p_invoice_id: invoiceId,
        p_title: status === 'declined' ? 'A document was declined' : 'Your documents are signed',
        p_message: status === 'declined'
          ? 'One of your assignment documents was declined. We will be in touch.'
          : 'All parties have signed. Nothing further is needed from you on these documents.',
        p_type: status === 'declined' ? 'warning' : 'success',
      });
    }

    return ok();
  } catch (_e) {
    return ok();
  }
});
