// Smile ID async callback (webhook). verify_jwt=false. Always returns HTTP 200.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, normalizeKybResult, normalizeKycResult } from "../_shared/smileid.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const providerJobId = payload?.SmileJobID ?? payload?.PartnerParams?.job_id ?? null;
    const providerUserId = payload?.PartnerParams?.user_id ?? null;
    const signature = payload?.signature ?? null;

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
        const norm = job.job_type === "kyb" ? normalizeKybResult(payload) : normalizeKycResult(payload);
        await admin.from("verification_jobs")
          .update({
            provider_status: norm.provider_status,
            internal_status: norm.internal_status,
            result_payload: payload,
          })
          .eq("id", job.id);

        await admin.from("verification_audit_events").insert({
          verification_job_id: job.id,
          subject_type: job.subject_type, subject_id: job.subject_id,
          event_type: `${job.job_type}_result_received`,
          actor_user_id: null, actor_role: "system",
          details: { provider_status: norm.provider_status, internal_status: norm.internal_status },
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
