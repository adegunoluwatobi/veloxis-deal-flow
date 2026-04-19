import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const disallowedAuthCallbackHostPatterns = [
  /\.lovableproject\.com$/i,
  /^localhost$/i,
  /^127(?:\.\d{1,3}){3}$/i,
  /^\[::1\]$/i,
];

function getSiteUrl() {
  const rawSiteUrl = Deno.env.get("SITE_URL")?.trim();

  if (!rawSiteUrl) {
    throw new Error("SITE_URL is not configured. Invite emails require a stable public app URL.");
  }

  let siteUrl: URL;

  try {
    siteUrl = new URL(rawSiteUrl);
  } catch {
    throw new Error("SITE_URL must be a valid absolute URL.");
  }

  if (siteUrl.protocol !== "https:") {
    throw new Error("SITE_URL must use https://.");
  }

  const normalizedHostname = siteUrl.hostname.trim().toLowerCase();
  const isLovablePreviewHost = normalizedHostname.endsWith(".lovable.app") && normalizedHostname.includes("preview--");

  if (isLovablePreviewHost || disallowedAuthCallbackHostPatterns.some((pattern) => pattern.test(normalizedHostname))) {
    throw new Error("SITE_URL must be a stable public domain, not a preview or local URL.");
  }

  siteUrl.pathname = "";
  siteUrl.search = "";
  siteUrl.hash = "";

  return siteUrl.toString().replace(/\/+$/, "");
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

    const siteUrl = getSiteUrl();
    const redirectUrl = new URL("/set-password", `${siteUrl}/`);
    redirectUrl.searchParams.set("email", email);
    redirectUrl.searchParams.set("exporter_id", exporter_id);
    const redirectTo = redirectUrl.toString();
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
        if (!isPendingInvite && !hasPartnerAccess) {
          return new Response(JSON.stringify({ error: "This exporter has already accepted the invite. Ask them to sign in instead." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // User already exists but hasn't completed onboarding.
        // Use generateLink(magiclink) to get action_link, then redirect user
        // to /set-password via that link. generateLink does NOT send the email
        // automatically, so we also call resetPasswordForEmail to deliver an email.
        const existingUser = exporter.exporter_user_id
          ? { id: exporter.exporter_user_id }
          : await findUserByEmail(adminClient, email);

        // Send a password-reset email that redirects to /set-password
        // This actually sends an email to the user with a valid link
        const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo,
        });

        if (resetError) {
          console.error("resetPasswordForEmail error:", resetError.message);
          throw resetError;
        }

        inviteData = { user: existingUser } as any;
        inviteError = null;
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

    // Email #1 — branded Veloxis invitation. We send this in addition to
    // Supabase's default invite email so the exporter receives the brand-
    // consistent template; the redirect URL is the same so either link works.
    try {
      // Resolve partner organisation name via the originator's role
      const { data: expWithOrig } = await adminClient
        .from("exporters")
        .select("id, originator_id")
        .eq("id", exporter_id)
        .maybeSingle();
      let partnerOrganisationName = "your partner";
      if (expWithOrig?.originator_id) {
        const { data: roleRow } = await adminClient
          .from("user_roles")
          .select("partner_organisation_id")
          .eq("user_id", expWithOrig.originator_id)
          .in("role", ["partner_admin", "partner_staff"])
          .maybeSingle();
        if (roleRow?.partner_organisation_id) {
          const { data: org } = await adminClient
            .from("partner_organisations")
            .select("name")
            .eq("id", roleRow.partner_organisation_id)
            .maybeSingle();
          if (org?.name) partnerOrganisationName = org.name;
        }
      }

      const firstName = (typeof full_name === "string" && full_name.trim().split(/\s+/)[0]) || exporter.director_name?.split(/\s+/)[0] || "";
      await adminClient.functions.invoke("send-transactional-email", {
        body: {
          templateName: "exporter-invitation",
          recipientEmail: email,
          idempotencyKey: `exporter-invitation-${exporter_id}-${new Date().toISOString().slice(0, 10)}`,
          templateData: {
            firstName,
            partnerOrganisationName,
            acceptUrl: redirectTo,
          },
        },
      });
    } catch (emailErr) {
      console.warn("exporter-invitation email failed:", emailErr);
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
