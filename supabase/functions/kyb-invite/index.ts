// Staff: create / resend / revoke KYB Onboarding Invites.
// Super Admin manages all; Business Developers manage only invites they created.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { adminClient, cors, json, newToken, sha256, siteUrl } from "../_shared/kyb-invite.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = adminClient();
    const { data: rr } = await admin.from("app_user_roles").select("role").eq("user_id", user.id);
    const roles = (rr ?? []).map((r: any) => r.role);
    const isSuper = roles.includes("super_admin");
    if (!isSuper && !roles.includes("originator")) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const sendEmail = async (inv: any, token: string) => {
      const url = `${siteUrl()}/onboard/${token}`;
      const { error } = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "kyb-onboarding-invite",
          recipientEmail: inv.contact_email,
          idempotencyKey: `kyb-invite-${inv.id}-${inv.send_count}-${Date.now()}`,
          templateData: {
            contactName: inv.contact_name, companyName: inv.company_name, inviteUrl: url,
            expiresOn: new Date(inv.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          },
        },
      });
      if (error) console.warn("kyb invite email failed for invite", inv.id);
      return !error;
    };

    if (action === "create") {
      const company_name = String(body.company_name ?? "").trim();
      const contact_name = String(body.contact_name ?? "").trim();
      const contact_email = String(body.contact_email ?? "").trim().toLowerCase();
      const contact_phone = String(body.contact_phone ?? "").trim() || null;
      const internal_note = String(body.internal_note ?? "").trim() || null;
      const days = [7, 14, 30].includes(Number(body.expiry_days)) ? Number(body.expiry_days) : 14;
      if (!company_name || company_name.length > 200) return json({ error: "Company name is required" }, 400);
      if (!contact_name || contact_name.length > 200) return json({ error: "Contact name is required" }, 400);
      if (!EMAIL_RE.test(contact_email) || contact_email.length > 255) return json({ error: "Enter a valid email address, like name@company.com" }, 400);
      const token = newToken();
      const { data: inv, error } = await admin.from("kyb_invites").insert({
        token_hash: await sha256(token), company_name, contact_name, contact_email, contact_phone, internal_note,
        expires_at: new Date(Date.now() + days * 86400_000).toISOString(), created_by: user.id,
      }).select("*").single();
      if (error) return json({ error: "Could not create invite" }, 400);
      await admin.from("kyb_invite_events").insert({ invite_id: inv.id, action: "created", actor_id: user.id, details: { expiry_days: days } });
      let emailed = false;
      if (body.send_email) {
        emailed = await sendEmail(inv, token);
        if (emailed) await admin.from("kyb_invite_events").insert({ invite_id: inv.id, action: "emailed", actor_id: user.id });
      }
      return json({ success: true, invite: inv, link: `${siteUrl()}/onboard/${token}`, emailed });
    }

    const id = String(body.id ?? "");
    const { data: inv } = await admin.from("kyb_invites").select("*").eq("id", id).maybeSingle();
    if (!inv) return json({ error: "Invite not found" }, 404);
    if (!isSuper && inv.created_by !== user.id) return json({ error: "You can only manage invites you created" }, 403);

    if (action === "revoke") {
      if (inv.status === "registered") return json({ error: "This invite has already been used" }, 400);
      await admin.from("kyb_invites").update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: user.id, token_hash: `revoked:${inv.id}` }).eq("id", id);
      await admin.from("kyb_invite_events").insert({ invite_id: id, action: "revoked", actor_id: user.id });
      return json({ success: true });
    }

    if (action === "resend") {
      if (["registered", "revoked"].includes(inv.status)) return json({ error: "This invite can no longer be resent" }, 400);
      const token = newToken();
      const days = [7, 14, 30].includes(Number(body.expiry_days)) ? Number(body.expiry_days) : 14;
      const { data: upd } = await admin.from("kyb_invites").update({
        token_hash: await sha256(token), status: "pending", opened_at: null,
        expires_at: new Date(Date.now() + days * 86400_000).toISOString(),
        send_count: inv.send_count + 1, last_sent_at: new Date().toISOString(),
      }).eq("id", id).select("*").single();
      await admin.from("kyb_invite_events").insert({ invite_id: id, action: "resent", actor_id: user.id, details: { previous_link_invalidated: true } });
      const emailed = body.send_email ? await sendEmail(upd, token) : false;
      return json({ success: true, invite: upd, link: `${siteUrl()}/onboard/${token}`, emailed });
    }

    if (action === "email") {
      return json({ error: "For security the link isn't stored. Use Resend to issue and email a new link." }, 400);
    }

    return json({ error: "Unknown action" }, 400);
  } catch {
    return json({ error: "Something went wrong" }, 500);
  }
});
