// Supabase Edge Function: verify-buyer-companies-house
// Searches Companies House for the buyer name on a given deal,
// stores the top match (or "not found") on the deal, and writes an audit log.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface CHCompany {
  company_number?: string;
  company_status?: string;
  title?: string;
  address_snippet?: string;
  sic_codes?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // ---- Auth ----
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const CH_API_KEY = Deno.env.get('COMPANIES_HOUSE_API_KEY');

  if (!CH_API_KEY) {
    return json(500, {
      error: 'Companies House API key not configured. Add COMPANIES_HOUSE_API_KEY in backend secrets.',
    });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return json(401, { error: 'Unauthorized' });
  const userId = claimsData.claims.sub as string;

  // ---- Parse body ----
  let body: { deal_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (!body.deal_id || typeof body.deal_id !== 'string') {
    return json(400, { error: 'deal_id is required' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ---- Authorisation: caller must be partner-in-org of this deal OR veloxis staff ----
  const { data: deal, error: dealErr } = await admin
    .from('deals')
    .select('id, buyer_company_name, buyer_country, exporter_id, exporters!inner(originator_id)')
    .eq('id', body.deal_id)
    .maybeSingle();

  if (dealErr || !deal) return json(404, { error: 'Deal not found' });

  const buyerName = (deal.buyer_company_name ?? '').trim();
  if (!buyerName) return json(400, { error: 'Deal has no buyer_company_name to verify' });

  const { data: isStaff } = await admin.rpc('is_veloxis_staff', { _user_id: userId });
  let actorRole: 'super_admin' | 'deal_manager' | 'partner_admin' | 'partner_staff' | null = null;

  if (isStaff) {
    // Determine specific staff role
    const { data: roleRows } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (roles.includes('super_admin')) actorRole = 'super_admin';
    else if (roles.includes('deal_manager')) actorRole = 'deal_manager';
  } else {
    // Must be a partner in the originator's org
    const originatorId = (deal as any).exporters?.originator_id as string | null;
    if (!originatorId) return json(403, { error: 'Forbidden' });
    const { data: orgIdData } = await admin.rpc('get_partner_org_id', { _user_id: originatorId });
    const orgId = orgIdData as string | null;
    if (!orgId) return json(403, { error: 'Forbidden' });
    const { data: ok } = await admin.rpc('is_partner_in_org', { _user_id: userId, _org_id: orgId });
    if (!ok) return json(403, { error: 'Forbidden' });
    const { data: roleRows } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('partner_organisation_id', orgId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (roles.includes('partner_admin')) actorRole = 'partner_admin';
    else if (roles.includes('partner_staff')) actorRole = 'partner_staff';
  }

  if (!actorRole) return json(403, { error: 'Forbidden' });

  // ---- Call Companies House ----
  const encoded = btoa(`${CH_API_KEY}:`);
  let chResp: Response;
  try {
    chResp = await fetch(
      `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(buyerName)}&items_per_page=5`,
      { headers: { Authorization: `Basic ${encoded}` } },
    );
  } catch (e) {
    return json(502, { error: 'Failed to reach Companies House', detail: String(e) });
  }

  if (chResp.status === 401 || chResp.status === 403) {
    return json(502, { error: 'Companies House rejected the API key. Check COMPANIES_HOUSE_API_KEY.' });
  }
  if (!chResp.ok) {
    const txt = await chResp.text();
    return json(502, { error: `Companies House error ${chResp.status}`, detail: txt.slice(0, 500) });
  }

  const data = (await chResp.json()) as { items?: CHCompany[] };
  const top = data.items?.[0] ?? null;
  const found = !!top;
  const nowIso = new Date().toISOString();

  // ---- Persist on deal ----
  const update = {
    buyer_ch_verified: true,
    buyer_ch_verified_at: nowIso,
    buyer_ch_verified_by: userId,
    buyer_ch_verified_by_role: actorRole,
    buyer_ch_search_term: buyerName,
    buyer_ch_found: found,
    buyer_ch_company_number: top?.company_number ?? null,
    buyer_ch_company_status: top?.company_status ?? null,
    buyer_ch_company_name: top?.title ?? null,
    buyer_ch_registered_address: top?.address_snippet ?? null,
    buyer_ch_sic_codes: top?.sic_codes ?? null,
    buyer_ch_raw_response: top ?? null,
  };

  const { error: upErr } = await admin.from('deals').update(update).eq('id', body.deal_id);
  if (upErr) return json(500, { error: 'Failed to persist verification', detail: upErr.message });

  // ---- Audit log ----
  await admin.rpc('insert_audit_log', {
    p_deal_id: body.deal_id,
    p_user_id: userId,
    p_user_role: actorRole,
    p_action_type: found ? 'buyer_ch_verified' : 'buyer_ch_not_found',
    p_metadata: {
      buyer_name_searched: buyerName,
      ch_company_number: top?.company_number ?? null,
      ch_company_status: top?.company_status ?? null,
      ch_company_title: top?.title ?? null,
    },
  });

  return json(200, {
    found,
    result: top,
    verified_at: nowIso,
    verified_by_role: actorRole,
  });
});
