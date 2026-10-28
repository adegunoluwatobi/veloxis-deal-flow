// Public: { token, password } only. The email always comes from the invite record.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { adminClient, cors, findUsableInvite, json, rateLimited, siteUrl } from "../_shared/kyb-invite.ts";

const INVALID = { error: "This invitation link is no longer valid. Please contact Veloxis for a new link." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = adminClient();
    if (await rateLimited(admin, req)) return json({ error: "Too many attempts. Please wait a minute." }, 429);
    const body = await req.json().catch(() => ({}));
    const { token, password } = body ?? {};
    if (typeof password !== "string" || password.length < 10 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return json({ error: "Password must be at least 10 characters and include a letter and a number." }, 400);
    }
    const inv = await findUsableInvite(admin, token);
    if (!inv) return json(INVALID, 400);
    const email = String(inv.contact_email).toLowerCase();

    // Existing account? Attach the invite to it; the client signs in with the password.
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
    let userId: string;
    let existingAccount = false;

    if (existing) {
      userId = existing.id;
      existingAccount = true;
    } else {
      // Server-side signUp so Auth sends the confirmation email.
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: su, error: suErr } = await anon.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${siteUrl()}/portal/onboarding`,
          data: { name: inv.contact_name, full_name: inv.contact_name, role: "exporter" },
        },
      });
      if (suErr || !su.user) return json({ error: "We couldn't create your account. Please contact Veloxis." }, 400);
      userId = su.user.id;
    }

    const now = new Date().toISOString();
    await admin.from("profiles").upsert(
      { user_id: userId, email, name: inv.contact_name, active: true, ...(existingAccount ? {} : { password_set_at: now }) },
      { onConflict: "user_id" },
    );
    const { error: roleErr } = await admin.from("app_user_roles").insert({ user_id: userId, role: "exporter" });
    if (roleErr && roleErr.code !== "23505") console.error("role assign failed", roleErr.message);

    // Link or create the exporter record.
    let exporterId: string | null = null;
    const { data: ex } = await admin.from("v2_exporters").select("id").eq("owner_user_id", userId).maybeSingle();
    if (ex) {
      exporterId = ex.id;
      await admin.from("v2_exporters").update({ invite_id: inv.id }).eq("id", ex.id);
    } else {
      const { data: created, error: exErr } = await admin.from("v2_exporters").insert({
        company_name: inv.company_name, contact_name: inv.contact_name, email,
        phone: inv.contact_phone, owner_user_id: userId, created_by: inv.created_by, invite_id: inv.id,
      }).select("id").single();
      if (exErr) console.error("exporter create failed", exErr.message);
      exporterId = created?.id ?? null;
    }

    // Consume: only succeeds if still usable (guards against double use).
    const { data: consumed } = await admin.from("kyb_invites")
      .update({ status: "registered", registered_at: now, registered_user_id: userId, exporter_id: exporterId, token_hash: `used:${inv.id}` })
      .eq("id", inv.id).in("status", ["pending", "opened"]).select("id");
    if (!consumed?.length) return json(INVALID, 400);
    await admin.from("kyb_invite_events").insert({ invite_id: inv.id, action: "registered", actor_id: userId, details: { existing_account: existingAccount } });

    return json({ success: true, email, existing_account: existingAccount });
  } catch {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
