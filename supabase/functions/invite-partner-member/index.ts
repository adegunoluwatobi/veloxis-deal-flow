// invite-partner-member: partner_admin invites a new member (partner_admin or partner_staff)
// to their own organisation. Sends an invite email; on signup the invitee is auto-assigned the
// requested role + partner_organisation_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getSiteUrl() {
  const raw = Deno.env.get("SITE_URL")?.trim();
  if (!raw) throw new Error("SITE_URL is not configured");
  const u = new URL(raw);
  if (u.protocol !== "https:") throw new Error("SITE_URL must use https://");
  u.pathname = ""; u.search = ""; u.hash = "";
  return u.toString().replace(/\/+$/, "");
}

function isExistingUserError(message?: string) {
  return !!message && (message.includes("already been registered") || message.includes("already exists"));
}

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

    // Caller must be partner_admin
    const { data: callerRoleRow } = await admin
      .from("user_roles")
      .select("role, partner_organisation_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (callerRoleRow?.role !== "partner_admin" || !callerRoleRow.partner_organisation_id) {
      return json({ error: "Only Partner Admins can invite team members" }, 403);
    }
    const orgId = callerRoleRow.partner_organisation_id;

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const full_name = String(body.full_name ?? "").trim();
    const role = String(body.role ?? "");

    if (!email) return json({ error: "Email is required" }, 400);
    if (!full_name) return json({ error: "Full name is required" }, 400);
    if (role !== "partner_admin" && role !== "partner_staff") {
      return json({ error: "Role must be partner_admin or partner_staff" }, 400);
    }

    // Look up org name for metadata
    const { data: orgRow } = await admin
      .from("partner_organisations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    const orgName = orgRow?.name ?? "";

    const siteUrl = getSiteUrl();
    const redirectUrl = new URL("/set-password", `${siteUrl}/`);
    redirectUrl.searchParams.set("email", email);

    const inviteMeta = {
      data: { full_name, organisation: orgName, role, partner_organisation_id: orgId },
      redirectTo: redirectUrl.toString(),
    };

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, inviteMeta);

    let userId: string | null = invited?.user?.id ?? null;

    if (inviteErr) {
      if (isExistingUserError(inviteErr.message)) {
        // User already exists — find them and (re)assign role to this org
        const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = users?.find((u: any) => u.email?.toLowerCase() === email);
        if (!existing) return json({ error: "Existing user not found" }, 404);
        userId = existing.id;
        // Send a recovery email so they can set a new password and access the partner shell
        await admin.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl.toString() });
      } else {
        throw inviteErr;
      }
    }

    if (!userId) return json({ error: "Failed to create invitation" }, 500);

    // Ensure users row exists (handle_new_user trigger creates it on signup, but defensive)
    await admin.from("users").upsert({ id: userId, email, full_name, organisation: orgName }, { onConflict: "id" });

    // Upsert role with org id
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRole) {
      await admin.from("user_roles").update({ role, partner_organisation_id: orgId }).eq("user_id", userId);
    } else {
      await admin.from("user_roles").insert({ user_id: userId, role, partner_organisation_id: orgId });
    }

    // Audit log
    await admin.rpc("insert_audit_log", {
      p_user_id: caller.id,
      p_user_role: "partner_admin",
      p_action_type: "team_member_invited",
      p_metadata: { invited_email: email, role, partner_organisation_id: orgId },
    });

    return json({ success: true, user_id: userId, email });
  } catch (err) {
    console.error("invite-partner-member error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
