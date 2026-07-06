// Smile ID async callback (webhook). verify_jwt=false. Always returns HTTP 200
// for accepted (signature-verified) payloads; rejects unsigned/invalid with 401.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, buildSignature, normalizeKybResult, normalizeKycResult, normalizeAmlResult } from "../_shared/smileid.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const providerJobId = payload?.SmileJobID ?? payload?.PartnerParams?.job_id ?? null;
    const providerUserId = payload?.PartnerParams?.user_id ?? null;
    const signature = payload?.signature ?? null;
    const timestamp = payload?.timestamp ?? null;

    // Verify Smile ID HMAC signature (same scheme as _shared/smileid.ts).
    // Reject unsigned or invalid payloads to prevent forged KYC/AML/KYB results.
    if (!signature || !timestamp) {
      return new Response(JSON.stringify({ error: "missing signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Replay protection: reject callbacks older than 15 minutes.
    const ts = Date.parse(String(timestamp));
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 15 * 60 * 1000) {
      return new Response(JSON.stringify({ error: "stale timestamp" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let expectedSig = "";
    try { expectedSig = await buildSignature(String(timestamp)); } catch {
      return new Response(JSON.stringify({ error: "signature check unavailable" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (expectedSig !== String(signature)) {
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // 1. Insert raw callback (idempotent on provider_job_id + signature)
    const { error: cbErr } = await admin.from("verification_callbacks").insert({
      provider: "smileid",
      provider_job_id: providerJobId,
      provider_user_id: providerUserId,
      signature,
      raw_payload: payload,
      processed: false,
    });
    // If duplicate, return 200 immediately
    if (cbErr && !cbErr.message.includes("duplicate")) {
      console.error("callback insert error:", cbErr.message);
    }

    // 2. Find matching verification_jobs row
    if (providerJobId) {
      const { data: job } = await admin
        .from("verification_jobs").select("id, job_type, subject_type, subject_id")
        .eq("provider_job_id", providerJobId).maybeSingle();

      if (job) {
        const norm = job.job_type === "kyb"
          ? normalizeKybResult(payload)
          : job.job_type === "aml"
            ? normalizeAmlResult(payload)
            : normalizeKycResult(payload);
        const extraPayload = job.job_type === "aml"
          ? { ...payload, _hits_count: (norm as any).hits_count, _risk_band: (norm as any).risk_band }
          : payload;
        await admin.from("verification_jobs")
          .update({
            provider_status: norm.provider_status,
            internal_status: norm.internal_status,
            result_payload: extraPayload,
          })
          .eq("id", job.id);

        await admin.from("verification_audit_events").insert({
          verification_job_id: job.id,
          subject_type: job.subject_type, subject_id: job.subject_id,
          event_type: `${job.job_type}_result_received`,
          actor_user_id: null, actor_role: "system",
          details: {
            provider_status: norm.provider_status,
            internal_status: norm.internal_status,
            ...(job.job_type === "aml" ? { hits_count: (norm as any).hits_count, risk_band: (norm as any).risk_band } : {}),
          },
        });

        await admin.from("verification_callbacks")
          .update({ processed: true })
          .eq("provider_job_id", providerJobId).eq("signature", signature);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("smileid-callback error", (e as Error).message);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
