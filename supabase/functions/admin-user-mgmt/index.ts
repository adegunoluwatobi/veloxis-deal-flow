// admin-user-mgmt: super_admin actions on any user.
// Actions: force_password_reset | suspend | reactivate | update_profile | remove_team_member
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function getSiteUrl() {
  const raw = Deno.env.get("SITE_URL")?.trim();
  if (!raw) return "https://veloxis.co.uk";
  try {
    const u = new URL(raw);
    u.pathname = ""; u.search = ""; u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return "https://veloxis.co.uk";
  }
}

const SUSPEND_BANNED_UNTIL = "2999-12-31T23:59:59Z";

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

    // Resolve caller role
    const { data: callerRoleRow } = await admin
      .from("user_roles")
      .select("role, partner_organisation_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    const callerRole = callerRoleRow?.role;
    const callerOrgId = callerRoleRow?.partner_organisation_id;

    const body = await req.json();
    const action = String(body.action ?? "");
    const targetUserId = String(body.user_id ?? "");

    if (!action) return json({ error: "action is required" }, 400);
    if (!targetUserId) return json({ error: "user_id is required" }, 400);

    // Fetch target user
    const { data: targetAuth } = await admin.auth.admin.getUserById(targetUserId);
    const targetEmail = targetAuth?.user?.email ?? "";
    if (!targetAuth?.user) return json({ error: "Target user not found" }, 404);

    const isSuper = callerRole === "super_admin";
    const isPartnerAdmin = callerRole === "partner_admin";

    // Authorisation matrix
    if (action === "remove_team_member") {
      // Only partner_admin acting on a member of their own org. Cannot remove themselves.
      if (!isPartnerAdmin) return json({ error: "Only Partner Admins can remove team members" }, 403);
      if (targetUserId === caller.id) return json({ error: "You cannot remove yourself" }, 400);
      const { data: targetRoleRow } = await admin
        .from("user_roles").select("role, partner_organisation_id")
        .eq("user_id", targetUserId).maybeSingle();
      if (!targetRoleRow || targetRoleRow.partner_organisation_id !== callerOrgId) {
        return json({ error: "Target is not in your organisation" }, 403);
      }
      // If removing a partner_admin, ensure at least one remains
      if (targetRoleRow.role === "partner_admin") {
        const { count } = await admin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("partner_organisation_id", callerOrgId)
          .eq("role", "partner_admin");
        if ((count ?? 0) <= 1) {
          return json({ error: "Cannot remove the only Partner Admin. Promote another member first." }, 400);
        }
      }
      // Remove role mapping (this strips access). Keep the auth user intact.
      await admin.from("user_roles").delete().eq("user_id", targetUserId);
      await admin.rpc("insert_audit_log", {
        p_user_id: caller.id,
        p_user_role: callerRole,
        p_action_type: "team_member_removed",
        p_metadata: { target_user_id: targetUserId, target_email: targetEmail, partner_organisation_id: callerOrgId },
      });
      return json({ success: true });
    }

    // Remaining actions are super_admin only
    if (!isSuper) return json({ error: "Forbidden: super_admin only" }, 403);

    if (action === "force_password_reset") {
      const siteUrl = getSiteUrl();
      const { error } = await admin.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${siteUrl}/set-password`,
      });
      if (error) throw error;
      await admin.rpc("insert_audit_log", {
        p_user_id: caller.id,
        p_user_role: "super_admin",
        p_action_type: "force_password_reset",
        p_metadata: { target_user_id: targetUserId, target_email: targetEmail },
      });
      return json({ success: true });
    }

    if (action === "suspend") {
      if (targetUserId === caller.id) return json({ error: "Cannot suspend your own account" }, 400);
      const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h", // ~100 years
      } as any);
      if (error) throw error;
      // Mirror to public.users for UI badges
      await admin.from("users").update({ is_active: false }).eq("id", targetUserId);
      await admin.rpc("insert_audit_log", {
        p_user_id: caller.id,
        p_user_role: "super_admin",
        p_action_type: "user_suspended",
        p_metadata: { target_user_id: targetUserId, target_email: targetEmail },
      });
      return json({ success: true });
    }

    if (action === "reactivate") {
      const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      } as any);
      if (error) throw error;
      await admin.from("users").update({ is_active: true }).eq("id", targetUserId);
      await admin.rpc("insert_audit_log", {
        p_user_id: caller.id,
        p_user_role: "super_admin",
        p_action_type: "user_reactivated",
        p_metadata: { target_user_id: targetUserId, target_email: targetEmail },
      });
      return json({ success: true });
    }

    if (action === "update_profile") {
      const updates: Record<string, unknown> = {};
      if (typeof body.full_name === "string") updates.full_name = body.full_name.trim();
      if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
      if (typeof body.organisation === "string") updates.organisation = body.organisation.trim();
      if (Object.keys(updates).length > 0) {
        await admin.from("users").update(updates).eq("id", targetUserId);
      }
      await admin.rpc("insert_audit_log", {
        p_user_id: caller.id,
        p_user_role: "super_admin",
        p_action_type: "profile_updated",
        p_metadata: { target_user_id: targetUserId, target_email: targetEmail, fields: Object.keys(updates) },
      });
      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("admin-user-mgmt error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
