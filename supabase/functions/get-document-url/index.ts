import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'veloxis-documents';
const EXPIRES_IN = 900; // hardcoded, never a parameter

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  let body: { document_id?: string; document_kind?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const documentId = body.document_id;
  const kind = body.document_kind;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!documentId || !uuidRe.test(documentId) || (kind !== 'invoice' && kind !== 'company')) {
    return json({ error: 'document_id (uuid) and document_kind (invoice|company) are required' }, 400);
  }

  // Caller-scoped client: RLS applies to every read below.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: roleRows } = await userClient
    .from('app_user_roles').select('role').eq('user_id', user.id);
  const roles: string[] = (roleRows ?? []).map((r: { role: string }) => r.role);
  const isStaff = roles.some((r) => ['originator', 'credit_officer', 'approver', 'super_admin'].includes(r));

  // Resolve the record (RLS-filtered) and its owning exporter.
  let path: string | null = null;
  let exporterId: string | null = null;
  let invoiceId: string | null = null;

  if (kind === 'invoice') {
    const { data } = await userClient
      .from('invoice_documents')
      .select('id, storage_path, invoice_id, v2_invoices!inner(exporter_id)')
      .eq('id', documentId).maybeSingle();
    if (data) {
      path = (data as any).storage_path;
      invoiceId = (data as any).invoice_id;
      exporterId = (data as any).v2_invoices?.exporter_id ?? null;
    } else {
      const { data: legacy } = await userClient
        .from('v2_invoice_documents')
        .select('id, file_url, invoice_id, v2_invoices!inner(exporter_id)')
        .eq('id', documentId).maybeSingle();
      if (legacy) {
        path = (legacy as any).file_url;
        invoiceId = (legacy as any).invoice_id;
        exporterId = (legacy as any).v2_invoices?.exporter_id ?? null;
      }
    }
  } else {
    const { data } = await userClient
      .from('company_documents').select('id, storage_path, exporter_id')
      .eq('id', documentId).maybeSingle();
    if (data) {
      path = (data as any).storage_path;
      exporterId = (data as any).exporter_id;
    } else {
      const { data: legacy } = await userClient
        .from('v2_exporter_documents').select('id, file_url, exporter_id')
        .eq('id', documentId).maybeSingle();
      if (legacy) {
        path = (legacy as any).file_url;
        exporterId = (legacy as any).exporter_id;
      }
    }
  }

  if (!path || !exporterId) return json({ error: 'Forbidden' }, 403);

  // Deny by default: independent ownership / staff assertion in code.
  let allowed = isStaff;
  if (!allowed) {
    const { data: owned } = await userClient
      .from('v2_exporters').select('id').eq('id', exporterId).eq('owner_user_id', user.id).maybeSingle();
    allowed = !!owned;
  }
  if (!allowed) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET).createSignedUrl(path, EXPIRES_IN);
  if (signErr || !signed?.signedUrl) return json({ error: 'Unable to sign document' }, 500);

  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || null;
  const userAgent = req.headers.get('user-agent') ?? null;

  await admin.from('document_audit_log').insert({
    entity_type: kind === 'invoice' ? 'invoice_document' : 'company_document',
    entity_id: documentId,
    invoice_id: invoiceId,
    exporter_id: exporterId,
    action: 'viewed',
    actor_id: user.id,
    actor_role: isStaff ? roles.join(',') : 'exporter',
    metadata: { at: new Date().toISOString(), ip, user_agent: userAgent },
  });


  return json({ url: signed.signedUrl });
});
