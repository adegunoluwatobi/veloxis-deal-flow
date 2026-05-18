// Super-admin-only Smile ID test harness. Does NOT touch business tables.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getEnv, smileFetch } from "../_shared/smileid.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", claims.claims.sub).maybeSingle();
    if (role?.role !== "super_admin") return json({ error: "Forbidden — super_admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "ping");
    const env = getEnv();

    if (action === "ping") {
      return json({
        ok: true,
        environment: env.environment,
        base_url: env.baseUrl,
        partner_id_configured: !!env.partnerId,
        smileid_api_key_configured: !!env.apiKey,
        partner_id_preview: env.partnerId ? env.partnerId.slice(0, 4) + "…" : null,
      });
    }

    if (action === "kyb") {
      const r = await smileFetch("/business_verification", {
        country: body.country ?? "NG",
        id_type: body.id_type ?? "BUSINESS_REGISTRATION",
        id_number: body.id_number,
        business_type: body.business_type ?? "co",
        business_name: body.business_name,
        partner_params: { job_id: crypto.randomUUID(), user_id: claims.claims.sub, job_type: 7 },
      });
      return json({ ok: r.ok, status: r.status, environment: env.environment, partner_params_present: true, debug_payload_shape: r.payloadShape, smile_response: r.response });
    }

    if (action === "kyc") {
      const r = await smileFetch("/identity_verification", {
        country: body.country ?? "NG",
        id_type: body.id_type ?? "NIN",
        id_number: body.id_number,
        first_name: body.first_name,
        last_name: body.last_name,
        dob: body.dob,
        partner_params: { job_id: crypto.randomUUID(), user_id: claims.claims.sub, job_type: 5 },
      });
      return json({ ok: r.ok, status: r.status, environment: env.environment, partner_params_present: true, debug_payload_shape: r.payloadShape, smile_response: r.response });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
