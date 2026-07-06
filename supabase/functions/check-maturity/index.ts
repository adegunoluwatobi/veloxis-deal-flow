import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const APP_URL = (Deno.env.get('SITE_URL') ?? 'https://app.veloxis.co.uk').replace(/\/+$/, '');

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authorization: allow either cron (Bearer = service role key) or a
    // staff caller (super_admin / deal_manager JWT).
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (token !== serviceRoleKey) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: cErr } = await authClient.auth.getClaims(token);
      if (cErr || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: roles } = await admin.from('user_roles')
        .select('role').eq('user_id', claims.claims.sub);
      const ok = (roles ?? []).some((r: any) => r.role === 'super_admin' || r.role === 'deal_manager');
      if (!ok) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);


    const today = new Date().toISOString().split('T')[0];

    // Find funded_active deals where repayment_due_date has passed.
    // Pull the join needed for email rendering in one go.
    const { data: overdue, error } = await supabase
      .from('deals')
      .select(`
        id, deal_reference, repayment_due_date, exporter_id, partner_organisation_id,
        buyer_company_name,
        exporter:exporters!deals_exporter_id_fkey ( company_name, contact_email, director_name )
      `)
      .eq('status', 'funded_active')
      .not('repayment_due_date', 'is', null)
      .lte('repayment_due_date', today);

    if (error) throw error;

    let updated = 0;
    let emailed = 0;

    for (const deal of (overdue ?? []) as any[]) {
      const { error: updateErr } = await supabase
        .from('deals')
        .update({ status: 'overdue' })
        .eq('id', deal.id);

      if (updateErr) continue;
      updated++;

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_deal_id: deal.id,
        p_action_type: 'deal_overdue',
        p_metadata: {
          auto: true,
          repayment_due_date: deal.repayment_due_date,
          checked_at: today,
        },
      });

      // Email #13 — notify exporter + partner. Idempotency keyed on the
      // repayment_due_date so we only send once per overdue event, even if
      // the cron runs multiple times.
      const dueKey = deal.repayment_due_date ?? 'unknown';
      const exporterEmail = deal.exporter?.contact_email as string | null;
      const exporterName = (deal.exporter?.director_name as string | null) ?? '';
      const exporterCompany = (deal.exporter?.company_name as string | null) ?? 'the exporter';
      const buyer = (deal.buyer_company_name as string | null) ?? 'the buyer';
      const dealRef = (deal.deal_reference as string | null) ?? '';
      const dueDate = fmtDate(deal.repayment_due_date);

      const sendEmail = async (templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) => {
        try {
          const { error: invokeErr } = await supabase.functions.invoke('send-transactional-email', {
            body: { templateName, recipientEmail, idempotencyKey, templateData },
          });
          if (!invokeErr) emailed++;
        } catch (_e) {
          // best-effort
        }
      };

      if (exporterEmail) {
        await sendEmail(
          'deal-overdue-to-exporter',
          exporterEmail,
          `deal-overdue-exp-${deal.id}-${dueKey}`,
          {
            exporterContactName: exporterName,
            dealReference: dealRef,
            buyerCompanyName: buyer,
            repaymentDueDate: dueDate,
            dealUrl: `${APP_URL}/exporter/deals/${deal.id}`,
          },
        );
      }

      // Partner admin recipient via RPC
      if (deal.partner_organisation_id) {
        const { data: partner } = await supabase.rpc('get_partner_admin_email', {
          p_org_id: deal.partner_organisation_id,
        });
        const row = Array.isArray(partner) ? partner[0] : partner;
        const partnerEmail = row?.email as string | undefined;
        const partnerName = (row?.full_name as string | undefined) ?? '';
        if (partnerEmail) {
          await sendEmail(
            'deal-overdue-to-partner',
            partnerEmail,
            `deal-overdue-pt-${deal.id}-${dueKey}`,
            {
              partnerAdminName: partnerName,
              dealReference: dealRef,
              exporterCompanyName: exporterCompany,
              buyerCompanyName: buyer,
              repaymentDueDate: dueDate,
              dealUrl: `${APP_URL}/greystar/deals/${deal.id}`,
            },
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ checked: (overdue ?? []).length, updated, emailed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
