// send-registration-link: super_admin / deal_manager sends a /apply/exporter
// (or other) registration link by email to a new prospect or an existing user,
// and tracks the invite in public.registration_invites.
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

const ALLOWED_PATHS = new Set(["/apply/exporter", "/apply/partner"]);

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
    if (!callerRole || !["super_admin", "deal_manager"].includes(callerRole.role)) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const full_name = String(body.full_name ?? "").trim() || null;
    const path = ALLOWED_PATHS.has(body.path) ? String(body.path) : "/apply/exporter";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Valid email is required" }, 400);
    }

    const siteUrl = getSiteUrl();
    const registrationUrl = `${siteUrl}${path}`;

    // Upsert invite tracking row
    const { data: existing } = await admin
      .from("registration_invites")
      .select("id, send_count, first_sent_at")
      .eq("email", email)
      .maybeSingle();

    let inviteId: string;
    let sendCount: number;
    if (existing) {
      sendCount = (existing.send_count ?? 0) + 1;
      const { data: updated, error: updErr } = await admin
        .from("registration_invites")
        .update({
          full_name: full_name ?? undefined,
          target_path: path,
          invited_by: caller.id,
          last_sent_at: new Date().toISOString(),
          send_count: sendCount,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (updErr) throw updErr;
      inviteId = updated.id;
    } else {
      sendCount = 1;
      const { data: inserted, error: insErr } = await admin
        .from("registration_invites")
        .insert({
          email,
          full_name,
          target_path: path,
          invited_by: caller.id,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      inviteId = inserted.id;
    }

    // Send the email (fire and log)
    const idempotencyKey = `reg-link-${inviteId}-${sendCount}`;
    const { error: mailErr } = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "registration-link-invite",
        recipientEmail: email,
        idempotencyKey,
        templateData: { fullName: full_name ?? "", registrationUrl },
      },
    });
    if (mailErr) {
      console.warn("send-registration-link email error:", mailErr);
    }

    await admin.rpc("insert_audit_log", {
      p_user_id: caller.id,
      p_user_role: callerRole.role,
      p_action_type: "team_member_invited",
      p_metadata: {
        invited_email: email,
        intent: "registration_link_sent",
        target_path: path,
        send_count: sendCount,
      },
    });

    return json({ success: true, invite_id: inviteId, send_count: sendCount });
  } catch (err) {
    console.error("send-registration-link error:", err);
    return json({ error: (err as Error).message ?? "Internal error" }, 500);
  }
});
