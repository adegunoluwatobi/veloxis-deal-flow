// kyc-change-review: partner_admin/partner_staff approves or rejects a KYC profile change request.
// On approve, the proposed_changes JSON is applied to the exporters row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED_FIELDS = new Set([
  "company_name",
  "rc_number",
  "director_name",
  "vat_number",
  "primary_commodity",
  "registered_address_line1", "registered_address_line2",
  "registered_city", "registered_postcode", "registered_country",
  "trading_address_line1", "trading_address_line2",
  "trading_city", "trading_postcode", "trading_country",
  "trading_address_same_as_registered",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: callerRoleRow } = await admin
      .from("user_roles")
      .select("role, partner_organisation_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    const callerRole = callerRoleRow?.role;
    const isPartner = callerRole === "partner_admin" || callerRole === "partner_staff";
    const isStaff = callerRole === "super_admin" || callerRole === "deal_manager";
    if (!isPartner && !isStaff) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const requestId = String(body.request_id ?? "");
    const decision = String(body.decision ?? "");
    const reviewNotes = typeof body.review_notes === "string" ? body.review_notes.trim() : null;
    if (!requestId || !["approved", "rejected"].includes(decision)) {
      return json({ error: "request_id and decision (approved|rejected) are required" }, 400);
    }

    const { data: changeReq } = await admin
      .from("kyc_profile_change_requests")
      .select("id, exporter_id, proposed_changes, status")
      .eq("id", requestId)
      .maybeSingle();
    if (!changeReq) return json({ error: "Change request not found" }, 404);
    if (changeReq.status !== "pending") return json({ error: "Already resolved" }, 400);

    // Verify partner is in the same org (RLS-style check at function level)
    if (isPartner) {
      const { data: exporter } = await admin
        .from("exporters")
        .select("originator_id")
        .eq("id", changeReq.exporter_id)
        .maybeSingle();
      if (!exporter) return json({ error: "Exporter not found" }, 404);
      const { data: originatorRole } = await admin
        .from("user_roles")
        .select("partner_organisation_id")
        .eq("user_id", exporter.originator_id)
        .maybeSingle();
      if (originatorRole?.partner_organisation_id !== callerRoleRow?.partner_organisation_id) {
        return json({ error: "Not your organisation" }, 403);
      }
    }

    if (decision === "approved") {
      const proposed = (changeReq.proposed_changes ?? {}) as Record<string, unknown>;
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(proposed)) {
        if (ALLOWED_FIELDS.has(k)) updates[k] = v;
      }
      if (Object.keys(updates).length > 0) {
        await admin.from("exporters").update(updates).eq("id", changeReq.exporter_id);
      }
    }

    await admin.from("kyc_profile_change_requests").update({
      status: decision,
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    }).eq("id", requestId);

    await admin.rpc("insert_audit_log", {
      p_user_id: caller.id,
      p_user_role: callerRole,
      p_action_type: decision === "approved" ? "kyc_change_approved" : "kyc_change_rejected",
      p_exporter_id: changeReq.exporter_id,
      p_metadata: { request_id: requestId, review_notes: reviewNotes },
    });

    return json({ success: true });
  } catch (err) {
    console.error("kyc-change-review error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
