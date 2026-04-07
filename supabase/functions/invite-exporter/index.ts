import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSiteUrl(_req: Request) {
  // Always use the stable public preview URL — never the iframe origin
  return (Deno.env.get("SITE_URL") || "https://id-preview--5aecb038-1cd1-4607-baa8-41e86f61384a.lovable.app").replace(/\/+$/, "");
}

function isExistingUserError(message?: string) {
  return !!message && (message.includes("already been registered") || message.includes("already exists"));
}

async function findUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return users?.find((user: any) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { email: rawEmail, full_name, organisation, exporter_id } = await req.json();
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email || !exporter_id) {
      return new Response(JSON.stringify({ error: "email and exporter_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: exporter, error: exporterError } = await adminClient
      .from("exporters")
      .select("id, contact_email, company_name, director_name, onboarding_status, exporter_user_id, invite_sent_at, invite_accepted_at")
      .eq("id", exporter_id)
      .maybeSingle();

    if (exporterError) {
      throw exporterError;
    }

    if (!exporter) {
      return new Response(JSON.stringify({ error: "Exporter not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((exporter.contact_email ?? "").trim().toLowerCase() !== email) {
      return new Response(JSON.stringify({ error: "Invite email does not match this exporter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPendingInvite = exporter.onboarding_status === "invited" && !exporter.invite_accepted_at;
    let hasPartnerAccess = false;

    if (authHeader) {
      const anonClient = createClient(supabaseUrl, anonKey);
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { data: { user: caller }, error: authError } = await anonClient.auth.getUser(token);

      if (!authError && caller) {
        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", caller.id)
          .in("role", ["partner_admin", "partner_staff", "super_admin"])
          .maybeSingle();

        hasPartnerAccess = !!roleData;
      }
    }

    if (!hasPartnerAccess) {
      if (!isPendingInvite) {
        return new Response(JSON.stringify({ error: "This invite can no longer be resent automatically. Please contact your administrator." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (exporter.invite_sent_at) {
        const lastInviteAt = new Date(exporter.invite_sent_at).getTime();
        if (Number.isFinite(lastInviteAt) && Date.now() - lastInviteAt < 60_000) {
          return new Response(JSON.stringify({ error: "A fresh invite was just sent. Please wait a minute and check your inbox." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const siteUrl = getSiteUrl(req);
    const redirectTo = `${siteUrl}/set-password?email=${encodeURIComponent(email)}&exporter_id=${encodeURIComponent(exporter_id)}`;
    const invitePayload = {
      data: {
        full_name: (typeof full_name === "string" && full_name.trim()) || exporter.director_name || "",
        organisation: (typeof organisation === "string" && organisation.trim()) || exporter.company_name || "",
        role: "exporter",
      },
      redirectTo,
    };

    const sendInvite = () => adminClient.auth.admin.inviteUserByEmail(email, invitePayload);

    let { data: inviteData, error: inviteError } = await sendInvite();

    if (inviteError) {
      if (isExistingUserError(inviteError.message)) {
        if (!isPendingInvite) {
          return new Response(JSON.stringify({ error: "This exporter has already accepted the invite. Ask them to sign in instead." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const existingUser = exporter.exporter_user_id
          ? { id: exporter.exporter_user_id }
          : await findUserByEmail(adminClient, email);

        if (!existingUser?.id) {
          throw inviteError;
        }

        const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(existingUser.id);
        if (deleteAuthError) {
          throw deleteAuthError;
        }

        await Promise.all([
          adminClient.from("users").delete().eq("id", existingUser.id),
          adminClient.from("user_roles").delete().eq("user_id", existingUser.id),
          adminClient.from("exporters").update({ exporter_user_id: null } as any).eq("id", exporter_id),
        ]);

        const retry = await sendInvite();
        inviteData = retry.data;
        inviteError = retry.error;

        if (inviteError) {
          throw inviteError;
        }
      } else {
        throw inviteError;
      }
    }

    // Link the new user to the exporter profile
    if (inviteData?.user) {
      await adminClient.from("exporters").update({
        exporter_user_id: inviteData.user.id,
        invite_sent_at: new Date().toISOString(),
      } as any).eq("id", exporter_id);
    }

    return new Response(JSON.stringify({ 
      user_id: inviteData?.user?.id,
      invited: true,
      reset_email_sent: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("invite-exporter error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
