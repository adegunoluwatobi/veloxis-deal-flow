// Shared Smile ID REST client helpers.
// Used by smileid-kyb, smileid-kyc, smileid-test, smileid-callback.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function getEnv() {
  const partnerId = (Deno.env.get("SMILEID_PARTNER_ID") ?? "").trim();
  const apiKey = (Deno.env.get("SMILEID_API_KEY") ?? "").trim();
  const environment = (Deno.env.get("SMILEID_ENVIRONMENT") ?? "sandbox").trim().toLowerCase();
  const baseUrl = environment === "production"
    ? "https://api.smileidentity.com/v1"
    : "https://testapi.smileidentity.com/v1";
  return { partnerId, apiKey, environment, baseUrl };
}

export async function buildSignature(timestamp: string): Promise<string> {
  const { partnerId, apiKey } = getEnv();
  if (!partnerId || !apiKey) throw new Error("SMILEID_PARTNER_ID / SMILEID_API_KEY not configured");
  const msg = `${timestamp}${partnerId}sid_request`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function smileFetch(endpoint: string, body: Record<string, unknown>) {
  const { baseUrl, partnerId } = getEnv();
  const timestamp = new Date().toISOString();
  const signature = await buildSignature(timestamp);
  const payload = {
    partner_id: partnerId,
    source_sdk: "rest_api",
    source_sdk_version: "1.0.0",
    timestamp,
    signature,
    ...body,
  };
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, response: json, payloadShape: { ...payload, signature: "<redacted>", api_key: undefined } };
}

// Normalize Smile ID response into our internal verification statuses.
// Returns { provider_status, internal_status }.
export function normalizeKybResult(resp: any): { provider_status: string; internal_status: string } {
  const verify = resp?.Actions?.Verify_Business ?? resp?.data?.Actions?.Verify_Business;
  if (verify === "Verified") return { provider_status: "provider_verified", internal_status: "verified" };
  if (verify === "Unable To Authenticate") return { provider_status: "action_required", internal_status: "manual_review" };
  return { provider_status: "provider_failed", internal_status: "failed" };
}

export function normalizeKycResult(resp: any): { provider_status: string; internal_status: string } {
  const code = String(resp?.ResultCode ?? "");
  if (["1012", "1013", "0810", "0811"].includes(code)) return { provider_status: "provider_verified", internal_status: "verified" };
  if (code.startsWith("11") || code === "0001") return { provider_status: "provider_failed", internal_status: "failed" };
  if (code) return { provider_status: "action_required", internal_status: "manual_review" };
  return { provider_status: "provider_pending", internal_status: "submitted" };
}
