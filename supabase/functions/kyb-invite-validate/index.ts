// Public: checks a KYB Onboarding Invite link and returns the locked email.
import { adminClient, cors, findUsableInvite, json, rateLimited } from "../_shared/kyb-invite.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = adminClient();
    if (await rateLimited(admin, req)) return json({ valid: false, error: "Too many attempts. Please wait a minute." }, 429);
    const { token } = await req.json().catch(() => ({}));
    const inv = await findUsableInvite(admin, token);
    if (!inv) return json({ valid: false });
    if (inv.status === "pending") {
      await admin.from("kyb_invites").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", inv.id);
      await admin.from("kyb_invite_events").insert({ invite_id: inv.id, action: "opened" });
    }
    return json({ valid: true, email: inv.contact_email, company_name: inv.company_name, contact_name: inv.contact_name });
  } catch {
    return json({ valid: false }, 500);
  }
});
