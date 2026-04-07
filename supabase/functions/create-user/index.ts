import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    // Verify caller
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check caller role
    const { data: callerRoleData } = await adminClient
      .from("user_roles")
      .select("role, partner_organisation_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    const callerRole = callerRoleData?.role;
    const callerOrgId = callerRoleData?.partner_organisation_id;

    const { email, password, role, full_name, organisation, invite_only, partner_organisation_id } = await req.json();

    if (!email) {
      return jsonResponse({ error: "Email is required" }, 400);
    }

    const validRoles = ["super_admin", "partner_admin", "partner_staff", "deal_manager", "exporter"];
    if (role && !validRoles.includes(role)) {
      return jsonResponse({ error: `Invalid role: ${role}` }, 400);
    }

    // ── Permission checks ──────────────────────────────────────────────
    if (callerRole === "super_admin") {
      // super_admin can create: partner_admin, deal_manager, exporter
      // partner_staff delegated to partner_admin
      if (role === "partner_staff") {
        return jsonResponse({ error: "Partner staff creation is delegated to partner admins" }, 403);
      }
    } else if (callerRole === "partner_admin") {
      // partner_admin can create: partner_staff (own org), exporter (invite only, own org)
      if (role === "partner_staff") {
        // OK — will use caller's org
      } else if (role === "exporter" && invite_only) {
        // OK — exporter invite for own org
      } else {
        return jsonResponse({ error: "Partner admins can only create partner staff or invite exporters" }, 403);
      }
    } else {
      return jsonResponse({ error: "Forbidden: insufficient permissions" }, 403);
    }

    // ── Exporter invite-only flow ──────────────────────────────────────
    if (role === "exporter" && invite_only) {
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: full_name || "",
          organisation: organisation || "",
          role: "exporter",
        },
        redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/set-password`,
      });

      if (inviteError) {
        if (inviteError.message?.includes("already been registered") || inviteError.message?.includes("already exists")) {
          return jsonResponse({ error: "This email is already registered. The user may already have an account." }, 400);
        }
        throw inviteError;
      }

      return jsonResponse({ success: true, user_id: inviteData?.user?.id, email, invited: true });
    }

    // ── Partner Admin creation: auto-create partner org ─────────────────
    if (role === "partner_admin") {
      if (!organisation?.trim()) {
        return jsonResponse({ error: "Organisation name is required for partner_admin" }, 400);
      }

      // Check if org already exists by name
      const { data: existingOrg } = await adminClient
        .from("partner_organisations")
        .select("id")
        .ilike("name", organisation.trim())
        .maybeSingle();

      let orgId: string;

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        // Create new partner organisation
        const { data: newOrg, error: orgErr } = await adminClient
          .from("partner_organisations")
          .insert({ name: organisation.trim() })
          .select("id")
          .single();
        if (orgErr) throw orgErr;
        orgId = newOrg.id;
      }

      // Enforce one active partner_admin per org
      const { data: existingAdmin } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "partner_admin")
        .eq("partner_organisation_id", orgId)
        .maybeSingle();

      if (existingAdmin) {
        return jsonResponse({ error: "This organisation already has a Partner Admin. Only one Partner Admin is allowed per organisation." }, 400);
      }

      // Create the user
      if (!password || password.length < 8) {
        return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
      }

      const userId = await createOrGetUser(adminClient, email, password, full_name, organisation, role);

      // Assign role with org
      await upsertRole(adminClient, userId, "partner_admin", orgId);

      return jsonResponse({ success: true, user_id: userId, email, partner_organisation_id: orgId });
    }

    // ── Internal user creation (deal_manager, partner_staff) ───────────
    if (!password || password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
    }

    const userId = await createOrGetUser(adminClient, email, password, full_name, organisation, role);

    // Assign role
    if (role && userId) {
      let assignedOrgId: string | null = null;

      if (role === "partner_staff") {
        // Must come from partner_admin — use caller's org
        if (callerRole === "partner_admin" && callerOrgId) {
          assignedOrgId = callerOrgId;
        } else if (partner_organisation_id) {
          assignedOrgId = partner_organisation_id;
        }
      }

      await upsertRole(adminClient, userId, role, assignedOrgId);
    }

    return jsonResponse({ success: true, user_id: userId, email });
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────

async function createOrGetUser(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  password: string,
  full_name?: string,
  organisation?: string,
  role?: string,
): Promise<string> {
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: full_name || "",
      organisation: organisation || "",
      role: role || "deal_manager",
    },
  });

  if (createError) {
    if (createError.message.includes("already been registered") || createError.message.includes("already exists")) {
      const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) throw listErr;
      const existing = users.find((u: any) => u.email === email);
      if (!existing) throw new Error("User exists but could not be found");
      await adminClient.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      return existing.id;
    }
    throw createError;
  }

  return newUser.user!.id;
}

async function upsertRole(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  role: string,
  orgId: string | null,
) {
  const { data: existingRole } = await adminClient
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingRole) {
    await adminClient.from("user_roles").update({
      role,
      partner_organisation_id: orgId || null,
    }).eq("user_id", userId);
  } else {
    await adminClient.from("user_roles").insert({
      user_id: userId,
      role,
      partner_organisation_id: orgId || null,
    });
  }
}
