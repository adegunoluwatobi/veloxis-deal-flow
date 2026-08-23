// Super admin invites a user via magic link (creates auth user if missing, assigns v2 role, sends magic link)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function authErrorResponse(message: string) {
  if (message.includes("unable to find user from email identity for duplicates")) {
    return json({
      error: "This email has an orphaned login identity from a previously deleted account. The login identity must be removed before this address can be invited again.",
      code: "ORPHANED_AUTH_IDENTITY",
    }, 409);
  }
  return json({ error: message }, 400);
}

function getSiteUrl() {
  const raw = Deno.env.get("SITE_URL")?.trim() || "https://app.veloxis.co.uk";
  try {
    const u = new URL(raw);
    u.pathname = ""; u.search = ""; u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch { return "https://app.veloxis.co.uk"; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: rr } = await admin.from("app_user_roles").select("role").eq("user_id", user.id);
    const callerRoles = (rr ?? []).map((r: any) => r.role as string);
    const isSuper = callerRoles.includes("super_admin");
    const isOriginator = callerRoles.includes("originator");
    if (!isSuper && !isOriginator) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const role = body.role as string | undefined;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Valid email required" }, 400);

    const validRoles = ["super_admin","originator","credit_officer","approver","exporter"];
    if (role && !validRoles.includes(role)) return json({ error: "Invalid role" }, 400);

    // Business Developers may only invite exporters — never staff roles.
    if (!isSuper && role !== "exporter") {
      return json({ error: "Business Developers can only invite exporters" }, 403);
    }

    // Find or create auth user
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name, full_name: name, role },
      });
      if (cErr) return authErrorResponse(cErr.message);
      userId = created.user?.id ?? null;
    }
    if (!userId) return json({ error: "Failed to resolve user" }, 500);

    // Ensure profile exists and stamp invited_at (first invite only)
    await admin.from("profiles").upsert(
      { user_id: userId, email, name: name || null, active: true, invited_at: new Date().toISOString() },
      { onConflict: "user_id", ignoreDuplicates: false }
    );
    // If the row already existed without invited_at, backfill it
    await admin.from("profiles")
      .update({ invited_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("invited_at", null);

    // Assign role if provided
    if (role) {
      const { error: roleErr } = await admin.from("app_user_roles").insert({ user_id: userId, role }).select();
      // Ignore duplicate role assignments; surface anything else
      if (roleErr && roleErr.code !== "23505") return json({ error: roleErr.message }, 400);
    }

    // Generate a magic link
    const redirectTo = `${getSiteUrl()}/home`;
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (lErr) return json({ error: lErr.message }, 400);

    const action_link = (link as any)?.properties?.action_link ?? (link as any)?.action_link ?? null;
    return json({ success: true, user_id: userId, email, action_link });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
