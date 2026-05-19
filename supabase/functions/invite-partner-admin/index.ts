// invite-partner-admin: super_admin invites the primary Partner Admin for a
// partner organisation. Creates an auth user via invite-by-email, assigns
// the partner_admin role + partner_organisation_id, and triggers the
// Supabase auth invitation email so the user can set a password and log in.
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
  if (!raw) return "https://app.veloxis.co.uk";
  try {
    const u = new URL(raw);
    u.pathname = ""; u.search = ""; u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return "https://app.veloxis.co.uk";
  }
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

    const { data: callerRole } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (callerRole?.role !== "super_admin") {
      return json({ error: "Forbidden: super_admin only" }, 403);
    }

    const body = await req.json();
    const partner_organisation_id = String(body.partner_organisation_id ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const full_name = String(body.full_name ?? "").trim();

    if (!partner_organisation_id) return json({ error: "partner_organisation_id is required" }, 400);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Valid email is required" }, 400);

    const { data: orgRow } = await admin
      .from("partner_organisations").select("id, name, admin_email")
      .eq("id", partner_organisation_id).maybeSingle();
    if (!orgRow) return json({ error: "Partner organisation not found" }, 404);

    const siteUrl = getSiteUrl();
    const redirectUrl = new URL("/set-password", `${siteUrl}/`);
    redirectUrl.searchParams.set("email", email);

    const inviteMeta = {
      data: {
        full_name,
        organisation: orgRow.name,
        role: "partner_admin",
        partner_organisation_id,
      },
      redirectTo: redirectUrl.toString(),
    };

    let userId: string | null = null;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, inviteMeta);
    if (inviteErr) {
      if (isExistingUserError(inviteErr.message)) {
        const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = users?.find((u: any) => u.email?.toLowerCase() === email);
        if (!existing) return json({ error: "Existing user not found" }, 404);
        userId = existing.id;
        await admin.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl.toString() });
      } else {
        throw inviteErr;
      }
    } else {
      userId = invited?.user?.id ?? null;
    }

    if (!userId) return json({ error: "Failed to create invitation" }, 500);

    await admin.from("users").upsert(
      { id: userId, email, full_name, organisation: orgRow.name },
      { onConflict: "id" },
    );

    const { data: existingRole } = await admin
      .from("user_roles").select("id").eq("user_id", userId).maybeSingle();

    if (existingRole) {
      await admin.from("user_roles")
        .update({ role: "partner_admin", partner_organisation_id })
        .eq("user_id", userId);
    } else {
      await admin.from("user_roles")
        .insert({ user_id: userId, role: "partner_admin", partner_organisation_id });
    }

    // Sync the org's admin_email if blank
    if (!orgRow.admin_email) {
      await admin.from("partner_organisations")
        .update({ admin_email: email })
        .eq("id", partner_organisation_id);
    }

    await admin.rpc("insert_audit_log", {
      p_user_id: caller.id,
      p_user_role: "super_admin",
      p_action_type: "team_member_invited",
      p_metadata: {
        invited_email: email,
        role: "partner_admin",
        partner_organisation_id,
        intent: "partner_admin_invite_from_admin",
      },
    });

    return json({ success: true, user_id: userId, email });
  } catch (err) {
    console.error("invite-partner-admin error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
