// Shared helpers for KYB Onboarding Invites. Tokens are never logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
export const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

export const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

export function siteUrl() {
  const raw = Deno.env.get("SITE_URL")?.trim() || "https://app.veloxis.co.uk";
  try { return new URL(raw).origin; } catch { return "https://app.veloxis.co.uk"; }
}

export async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 10 attempts per minute per IP. Returns true when the caller is over the limit. */
export async function rateLimited(admin: ReturnType<typeof adminClient>, req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = await sha256(`kyb:${ip}`);
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("kyb_invite_rate_limits")
    .select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  await admin.from("kyb_invite_rate_limits").insert({ ip_hash: ipHash });
  return (count ?? 0) >= 10;
}

/** Returns the invite only if it is usable (pending/opened and not expired). */
export async function findUsableInvite(admin: ReturnType<typeof adminClient>, token: unknown) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const { data } = await admin.from("kyb_invites").select("*").eq("token_hash", await sha256(token)).maybeSingle();
  if (!data) return null;
  if (!["pending", "opened"].includes(data.status)) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}
