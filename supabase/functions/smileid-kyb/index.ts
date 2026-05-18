// Initiate Smile ID KYB (Business Verification) for a subject.
// Callers: partner_admin/partner_staff (own org subjects only) or super_admin/deal_manager (any).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, smileFetch, normalizeKybResult } from "../_shared/smileid.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("role, partner_organisation_id").eq("user_id", userId).maybeSingle();
    const role = roleRow?.role;
    const callerOrg = roleRow?.partner_organisation_id;
    if (!["super_admin", "deal_manager", "partner_admin", "partner_staff"].includes(role ?? "")) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const {
      subject_type, subject_id, partner_organisation_id,
      country = "NG", id_type = "BUSINESS_REGISTRATION", id_number,
      business_type = "co", business_name,
    } = body;

    if (!subject_type || !subject_id || !id_number) return json({ error: "subject_type, subject_id, id_number required" }, 400);

    // Resolve scoping org if not provided (default to exporter's org)
    let orgId: string | null = partner_organisation_id ?? null;
    if (!orgId && subject_type === "exporter") {
      const { data: exp } = await admin.from("exporters").select("originator_id").eq("id", subject_id).maybeSingle();
      if (exp?.originator_id) {
        const { data: orgRow } = await admin.from("user_roles").select("partner_organisation_id").eq("user_id", exp.originator_id).maybeSingle();
        orgId = orgRow?.partner_organisation_id ?? null;
      }
    } else if (!orgId && subject_type === "partner_organisation") {
      orgId = subject_id;
    }

    // Partner scoping check
    if (["partner_admin", "partner_staff"].includes(role!) && orgId !== callerOrg) {
      return json({ error: "Cannot initiate verification for subjects outside your organisation" }, 403);
    }

    const jobId = crypto.randomUUID();
    const requestPayload = {
      country, id_type, id_number, business_type, business_name,
      partner_params: { job_id: jobId, user_id: subject_id, job_type: 7 },
    };

    const r = await smileFetch("/business_verification", requestPayload);
    const norm = normalizeKybResult(r.response);

    const { data: inserted, error: insErr } = await admin
      .from("verification_jobs")
      .insert({
        subject_type, subject_id, partner_organisation_id: orgId,
        job_type: "kyb", provider: "smileid",
        provider_job_id: (r.response as any)?.SmileJobID ?? jobId,
        provider_user_id: subject_id,
        provider_status: norm.provider_status,
        internal_status: norm.internal_status,
        request_payload: { ...requestPayload, signature: "<redacted>" },
        result_payload: r.response,
        initiated_by: userId,
      })
      .select("id")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    await admin.from("verification_audit_events").insert({
      verification_job_id: inserted.id,
      subject_type, subject_id,
      event_type: "kyb_request_sent",
      actor_user_id: userId, actor_role: role,
      details: { http_status: r.status, provider_status: norm.provider_status },
    });

    return json({ ok: r.ok, verification_job_id: inserted.id, provider_status: norm.provider_status, internal_status: norm.internal_status, smile_response: r.response });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
