import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller with anon client
    const anonClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has partner_staff or partner_admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["partner_staff", "partner_admin"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: requires partner role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, organisation, exporter_id } = await req.json();

    if (!email || !exporter_id) {
      return new Response(JSON.stringify({ error: "email and exporter_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin API to invite user by email (sends magic link / invite email)
    // Derive redirect URL from the request origin so it matches the user's browser
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || Deno.env.get("SITE_URL") || `https://id-preview--5aecb038-1cd1-4607-baa8-41e86f61384a.lovable.app`;
    const siteUrl = origin.replace(/\/+$/, "");
    const redirectTo = `${siteUrl}/set-password`;
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: full_name || "",
        organisation: organisation || "",
        role: "exporter",
      },
      redirectTo,
    });

    if (inviteError) {
      // If user already exists, try to get their ID and link anyway
      if (inviteError.message?.includes("already been registered") || inviteError.message?.includes("already exists")) {
        const { data: { users } } = await adminClient.auth.admin.listUsers();
        const existingUser = users?.find((u: any) => u.email === email);
        if (existingUser) {
          // Link to exporter profile
          await adminClient.from("exporters").update({
            exporter_user_id: existingUser.id,
          }).eq("id", exporter_id);

          const { error: resetError } = await anonClient.auth.resetPasswordForEmail(email, {
            redirectTo,
          });

          if (resetError) {
            throw resetError;
          }

          return new Response(JSON.stringify({ 
            user_id: existingUser.id, 
            already_existed: true,
            invited: false,
            reset_email_sent: true,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      throw inviteError;
    }

    // Link the new user to the exporter profile
    if (inviteData?.user) {
      await adminClient.from("exporters").update({
        exporter_user_id: inviteData.user.id,
      }).eq("id", exporter_id);
    }

    return new Response(JSON.stringify({ 
      user_id: inviteData?.user?.id,
      invited: true,
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
