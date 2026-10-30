import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { canSendPack, linkAvailable, PACK_LIFETIME_SECONDS, sendPackSchema } from '../_shared/pack-rules.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hash = async (token: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(b => b.toString(16).padStart(2, '0')).join('');
const bucket = 'veloxis-documents';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) return json({ error: 'Service configuration unavailable' }, 503);
    const admin = createClient(url, service, { auth: { persistSession: false } });

    // The public link never exposes the underlying storage URL. Each download checks revocation.
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('token');
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return json({ error: 'This download link is invalid.' }, 404);
      const { data: link, error } = await admin.from('kyb_pack_links').select('*').eq('token_hash', await hash(token)).maybeSingle();
      if (error) throw error;
      if (!link || !linkAvailable(link)) return json({ error: 'This download link has expired or been revoked.' }, 410);
      const pdf = await fetch(link.signed_url);
      if (!pdf.ok) return json({ error: 'This download is no longer available.' }, 410);
      // Recheck after fetching so revocation during generation/download preparation wins.
      const { data: current, error: checkError } = await admin.from('kyb_pack_links').select('revoked_at,expires_at,delivery_status').eq('id', link.id).single();
      if (checkError || !current || !linkAvailable(current)) return json({ error: 'This download link has expired or been revoked.' }, 410);
      const { error: auditError } = await admin.rpc('kyb_append_activity', { p_exporter: link.exporter_id, p_invite: null, p_event: 'shared_pack_downloaded', p_actor: null, p_details: { link_id: link.id, pack_type: link.pack_type } });
      if (auditError) throw auditError;
      return new Response(pdf.body, { headers: { ...corsHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Exporter_KYB_Pack.pdf"', 'Cache-Control': 'no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const authorization = req.headers.get('Authorization') ?? '';
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: roles, error: roleError } = await caller.from('app_user_roles').select('role').eq('user_id', user.id);
    if (roleError || !roles?.some(r => ['originator', 'credit_officer', 'approver', 'super_admin'].includes(r.role))) return json({ error: 'Forbidden' }, 403);
    const body = await req.json().catch(() => null);
    if (body?.action === 'revoke') {
      const parsed = z.object({ link_id: z.string().uuid() }).safeParse(body);
      if (!parsed.success) return json({ error: 'Invalid link' }, 400);
      const { data: path, error } = await caller.rpc('kyb_revoke_pack', { p_link_id: parsed.data.link_id });
      if (error) return json({ error: error.message }, 403);
      // Deleting the uniquely generated object also invalidates its storage-signed URL.
      if (path) {
        const { error: removeError } = await admin.storage.from(bucket).remove([path]);
        if (removeError) console.error('Revoked object cleanup failed', removeError.message);
      }
      return json({ success: true });
    }
    const parsed = sendPackSchema.safeParse(body);
    if (!parsed.success) return json({ error: 'Check the recipients, subject, message and pack type.', fields: parsed.error.flatten().fieldErrors }, 400);
    const input = parsed.data;
    const { data: exp, error: expError } = await caller.from('v2_exporters').select('id,company_name,onboarding_status').eq('id', input.exporter_id).maybeSingle();
    if (expError || !exp) return json({ error: 'Forbidden' }, 403);
    if (!canSendPack(exp.onboarding_status)) return json({ error: 'Only approved applications can send a pack.' }, 409);

    const generated = await fetch(`${url}/functions/v1/exporter-pack`, { method: 'POST', headers: { Authorization: authorization, apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ exporter_id: exp.id, mode: input.pack_type, purpose: 'send' }) });
    if (!generated.ok) return json({ error: 'Pack generation failed', status: generated.status, details: await generated.text() }, generated.status);
    const bytes = await generated.arrayBuffer();
    const created = new Date();
    const expiry = new Date(created.getTime() + PACK_LIFETIME_SECONDS * 1000).toISOString();
    const id = crypto.randomUUID();
    const path = `shared_kyb/${exp.id}/${id}.pdf`;
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;
    const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(path, PACK_LIFETIME_SECONDS);
    if (signedError || !signed) { await admin.storage.from(bucket).remove([path]); throw signedError ?? new Error('Could not sign pack'); }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data: profile } = await admin.from('profiles').select('name,email').eq('user_id', user.id).maybeSingle();
    const { error: insertError } = await admin.from('kyb_pack_links').insert({ id, exporter_id: exp.id, token_hash: await hash(token), storage_path: path, signed_url: signed.signedUrl, pack_type: input.pack_type, recipients: input.to, cc: input.cc, subject: input.subject, sent_by: user.id, sender_name: profile?.name || user.email || user.id, created_at: created.toISOString(), expires_at: expiry });
    if (insertError) { await admin.storage.from(bucket).remove([path]); throw insertError; }
    const { data: fresh } = await caller.from('v2_exporters').select('onboarding_status').eq('id', exp.id).single();
    if (!fresh || !canSendPack(fresh.onboarding_status)) {
      await admin.from('kyb_pack_links').update({ delivery_status: 'failed' }).eq('id', id);
      await admin.storage.from(bucket).remove([path]);
      return json({ error: 'The application is no longer approved.' }, 409);
    }
    // One event, one recipient. The common sender handles suppression and the required footer.
    const { data: result, error: emailError } = await admin.functions.invoke('send-transactional-email', {
      headers: { Authorization: authorization },
      body: { templateName: 'kyb-pack-share', recipientEmail: input.to[0], idempotencyKey: `kyb-pack-${id}`,
        templateData: { linkId: id, token, message: input.message } },
    });
    if (emailError || !result?.success || !result?.queued) {
      let failure = result?.reason || 'queue_failed';
      if (emailError && 'context' in emailError && emailError.context instanceof Response) {
        const response = await emailError.context.json().catch(() => ({}));
        failure = response.code || response.error || failure;
      }
      // Never log the token, signed storage URL or request body.
      console.error('Pack email queue rejected', { link_id: id, reason: failure });
      await admin.from('kyb_pack_links').update({ delivery_status: 'failed' }).eq('id', id);
      await admin.storage.from(bucket).remove([path]);
      return json({ error: result?.reason === 'email_suppressed' ? 'This recipient cannot receive app emails.' : 'Could not queue the pack email. Check More → Emails.' }, 503);
    }
    // Existing "sent" state means handed off for delivery, not confirmed receipt.
    const { error: recordError } = await admin.from('kyb_pack_links').update({ delivery_status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
    if (recordError) {
      await admin.storage.from(bucket).remove([path]);
      return json({ error: 'Email queued, but its link could not be recorded and has been disabled.' }, 500);
    }
    return json({ success: true, queued: true, link_id: id, expires_at: expiry });
  } catch (error) {
    console.error('KYB pack sharing failed', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Could not complete this pack request.' }, 500);
  }
});