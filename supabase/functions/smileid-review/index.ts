// Two-stage review actions for verification jobs.
// Enforces server-side: super admin cannot approve before partner approval,
// except via explicit manual_override action which requires a reason and is audited.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/smileid.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Action =
  | "partner_start_review"
  | "partner_approve"
  | "partner_reject"
  | "partner_request_action"
  | "super_admin_start_review"
  | "super_admin_approve"
  | "super_admin_reject"
  | "super_admin_request_action"
  | "manual_override_check"
  | "retry";

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

    const body = await req.json();
    const verification_job_id: string = body.verification_job_id;
    const action: Action = body.action;
    const notes: string | undefined = body.notes;
    const reason: string | undefined = body.reason;
    if (!verification_job_id || !action) return json({ error: "verification_job_id + action required" }, 400);

    const { data: job, error: jobErr } = await admin
      .from("verification_jobs").select("*").eq("id", verification_job_id).maybeSingle();
    if (jobErr || !job) return json({ error: "Verification job not found" }, 404);

    const isSuper = role === "super_admin";
    const isPartner = (role === "partner_admin" || role === "partner_staff") && job.partner_organisation_id === callerOrg;

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {};

    const partnerActions: Action[] = ["partner_start_review", "partner_approve", "partner_reject", "partner_request_action"];
    const superActions: Action[] = ["super_admin_start_review", "super_admin_approve", "super_admin_reject", "super_admin_request_action", "manual_override_check"];

    if (partnerActions.includes(action)) {
      if (!isPartner) return json({ error: "Only Partner Admin/Staff of the owning org can perform partner review actions" }, 403);
      if (action === "partner_start_review") update.partner_review_status = "under_review";
      if (action === "partner_approve") { update.partner_review_status = "approved"; update.reviewed_by_partner_admin_id = userId; update.partner_reviewed_at = now; }
      if (action === "partner_reject") { update.partner_review_status = "rejected"; update.reviewed_by_partner_admin_id = userId; update.partner_reviewed_at = now; }
      if (action === "partner_request_action") update.partner_review_status = "action_required";
      if (notes !== undefined) update.partner_review_notes = notes;
    } else if (superActions.includes(action)) {
      if (!isSuper) return json({ error: "Only Super Admin can perform final review actions" }, 403);

      // WORKFLOW RULE: super admin cannot approve/unlock unless partner approved first.
      if (action === "super_admin_approve" && job.partner_review_status !== "approved") {
        return json({ error: "Partner review must be approved before Super Admin can finalise approval. Use manual_override_check (with reason) only when explicitly required." }, 409);
      }
      if (action === "super_admin_start_review") update.super_admin_review_status = "under_review";
      if (action === "super_admin_approve") {
        update.super_admin_review_status = "approved";
        update.reviewed_by_super_admin_id = userId;
        update.super_admin_reviewed_at = now;
        update.final_access_status = "access_unlocked";
      }
      if (action === "super_admin_reject") {
        update.super_admin_review_status = "rejected";
        update.reviewed_by_super_admin_id = userId;
        update.super_admin_reviewed_at = now;
        update.final_access_status = "access_locked";
      }
      if (action === "super_admin_request_action") update.super_admin_review_status = "action_required";
      if (action === "manual_override_check") {
        if (!reason || reason.trim().length < 5) return json({ error: "Manual override requires a reason (min 5 chars)" }, 400);
        update.manual_override_by = userId;
        update.manual_override_reason = reason;
        update.manual_override_at = now;
        update.final_access_status = "manually_checked";
      }
      if (notes !== undefined) update.super_admin_review_notes = notes;
    } else {
      return json({ error: `Unsupported action: ${action}` }, 400);
    }

    const { error: updErr } = await admin.from("verification_jobs").update(update).eq("id", verification_job_id);
    if (updErr) return json({ error: updErr.message }, 500);

    await admin.from("verification_audit_events").insert({
      verification_job_id,
      subject_type: job.subject_type, subject_id: job.subject_id,
      event_type: action,
      actor_user_id: userId, actor_role: role,
      details: { notes: notes ?? null, reason: reason ?? null },
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
