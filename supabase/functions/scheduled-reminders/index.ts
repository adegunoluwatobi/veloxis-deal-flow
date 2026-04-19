// scheduled-reminders: daily cron job that dispatches reminder emails:
//  - document-expiry-30: KYC docs expiring in exactly 30 days
//  - document-expiry-7:  KYC docs expiring in exactly 7 days
//  - ipu-pending-reminder: signed-IPU still pending, 3 days before expiry
//  - maturity-reminder-7: funded_active deals 7 days before repayment_due_date
//  - maturity-reminder-1: funded_active deals 1 day before repayment_due_date
//
// Idempotency is enforced via send-transactional-email's idempotencyKey
// (stored in email_send_log.message_id). Each idempotencyKey embeds the
// target date so a single threshold can never fire twice for the same item.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = (Deno.env.get('SITE_URL') ?? 'https://app.veloxis.co.uk').replace(/\/+$/, '');

const DOC_LABELS: Record<string, string> = {
  cac_certificate: 'CAC Certificate',
  director_id: 'Director ID',
  nepc_certificate: 'NEPC Certificate',
  ubo_declaration_doc: 'UBO Declaration',
  source_of_funds_doc: 'Source of Funds Statement',
  bank_statements: 'Bank Statements',
  other: 'KYC Document',
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

function addDaysIso(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function fmtAmount(currency: string | null | undefined, amount: number | null | undefined): string | undefined {
  if (amount == null || !currency) return undefined;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = todayUtc();
  const stats = {
    docExpiry30: 0,
    docExpiry7: 0,
    ipuPending: 0,
    maturity7: 0,
    maturity1: 0,
    missingInvitesFixed: 0,
    failed: 0,
  };

  const send = async (templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) => {
    try {
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: { templateName, recipientEmail, idempotencyKey, templateData },
      });
      if (error) {
        console.error(`send ${templateName} failed`, error.message);
        stats.failed++;
        return false;
      }
      return true;
    } catch (e) {
      console.error(`send ${templateName} threw`, (e as Error).message);
      stats.failed++;
      return false;
    }
  };

  // -------- 1) Document expiry reminders (T-30, T-7) --------
  for (const offset of [30, 7] as const) {
    const target = addDaysIso(today, offset);
    const { data: docs, error } = await supabase
      .from('exporter_documents')
      .select(`
        id, document_type, expiry_date, exporter_id,
        exporter:exporters!exporter_documents_exporter_id_fkey (
          company_name, contact_email, director_name, originator_id
        )
      `)
      .eq('is_superseded', false)
      .eq('expiry_date', target);

    if (error) {
      console.error('doc query error', error.message);
      continue;
    }

    for (const doc of (docs ?? []) as any[]) {
      const exporter = doc.exporter ?? {};
      const exporterEmail = exporter.contact_email as string | null;
      if (!exporterEmail) continue;

      const label = DOC_LABELS[doc.document_type as string] ?? 'KYC Document';
      const templateData = {
        recipientName: (exporter.director_name as string | null) ?? '',
        exporterCompanyName: (exporter.company_name as string | null) ?? 'your company',
        documentLabel: label,
        expiryDate: fmtDate(doc.expiry_date),
        daysRemaining: offset,
        uploadUrl: `${APP_URL}/exporter/documents`,
      };
      const templateName = offset === 30 ? 'document-expiry-30' : 'document-expiry-7';
      const idempotencyKey = `${templateName}-${doc.id}-${doc.expiry_date}`;
      const ok = await send(templateName, exporterEmail, idempotencyKey, templateData);
      if (ok) {
        if (offset === 30) stats.docExpiry30++; else stats.docExpiry7++;
      }
    }
  }

  // -------- 2) IPU pending reminder (3 days before expiry) --------
  {
    const target = addDaysIso(today, 3);
    const { data: ipus, error } = await supabase
      .from('ipus')
      .select(`
        id, deal_id, expires_at, sent_to_email, signer_name, is_active,
        deal:deals!ipus_deal_id_fkey (
          id, deal_reference, status, buyer_company_name, exporter_id,
          exporter:exporters!deals_exporter_id_fkey ( contact_email, director_name )
        )
      `)
      .eq('is_active', true)
      .is('signed_at', null)
      .gte('expires_at', `${target}T00:00:00Z`)
      .lt('expires_at', `${target}T23:59:59Z`);

    if (error) {
      console.error('ipu query error', error.message);
    } else {
      for (const ipu of (ipus ?? []) as any[]) {
        const deal = ipu.deal ?? {};
        if (!['ipu_sent'].includes(deal.status)) continue;
        const exporterEmail = ipu.sent_to_email || deal.exporter?.contact_email;
        if (!exporterEmail) continue;

        const expiresAtIso = (ipu.expires_at as string).split('T')[0];
        const ok = await send(
          'ipu-pending-reminder',
          exporterEmail,
          `ipu-pending-${ipu.id}-${expiresAtIso}`,
          {
            exporterContactName: (deal.exporter?.director_name as string | null) ?? ipu.signer_name ?? '',
            dealReference: deal.deal_reference ?? '',
            buyerCompanyName: deal.buyer_company_name ?? 'the buyer',
            ipuExpiresAt: fmtDate(ipu.expires_at),
            daysRemaining: 3,
            dealUrl: `${APP_URL}/exporter/deals/${deal.id}`,
          },
        );
        if (ok) stats.ipuPending++;
      }
    }
  }

  // -------- 3) Maturity reminders (T-7, T-1) --------
  for (const offset of [7, 1] as const) {
    const target = addDaysIso(today, offset);
    const { data: deals, error } = await supabase
      .from('deals')
      .select(`
        id, deal_reference, repayment_due_date, status, partner_organisation_id,
        buyer_company_name, repayment_amount, settlement_currency, advance_currency, invoice_currency_v2,
        exporter:exporters!deals_exporter_id_fkey ( company_name, contact_email, director_name )
      `)
      .eq('status', 'funded_active')
      .eq('repayment_due_date', target);

    if (error) {
      console.error('maturity query error', error.message);
      continue;
    }

    for (const deal of (deals ?? []) as any[]) {
      const currency = deal.settlement_currency || deal.advance_currency || deal.invoice_currency_v2 || null;
      const amountDisplay = fmtAmount(currency, deal.repayment_amount);
      const exporterEmail = deal.exporter?.contact_email as string | null;
      const exporterName = (deal.exporter?.director_name as string | null) ?? '';
      const exporterCompany = (deal.exporter?.company_name as string | null) ?? '';
      const dealRef = deal.deal_reference ?? '';
      const buyer = deal.buyer_company_name ?? 'the buyer';

      const templateName = offset === 7 ? 'maturity-reminder-7' : 'maturity-reminder-1';

      // Exporter
      if (exporterEmail) {
        const ok = await send(
          templateName,
          exporterEmail,
          `${templateName}-exp-${deal.id}-${deal.repayment_due_date}`,
          {
            recipientName: exporterName,
            dealReference: dealRef,
            buyerCompanyName: buyer,
            repaymentDueDate: fmtDate(deal.repayment_due_date),
            daysRemaining: offset,
            amountDisplay,
            dealUrl: `${APP_URL}/exporter/deals/${deal.id}`,
          },
        );
        if (ok) {
          if (offset === 7) stats.maturity7++; else stats.maturity1++;
        }
      }

      // Partner admin
      if (deal.partner_organisation_id) {
        const { data: partner } = await supabase.rpc('get_partner_admin_email', {
          p_org_id: deal.partner_organisation_id,
        });
        const row = Array.isArray(partner) ? partner[0] : partner;
        const partnerEmail = row?.email as string | undefined;
        const partnerName = (row?.full_name as string | undefined) ?? '';
        if (partnerEmail) {
          const ok = await send(
            templateName,
            partnerEmail,
            `${templateName}-pt-${deal.id}-${deal.repayment_due_date}`,
            {
              recipientName: partnerName || `${exporterCompany} team`.trim(),
              dealReference: dealRef,
              buyerCompanyName: buyer,
              repaymentDueDate: fmtDate(deal.repayment_due_date),
              daysRemaining: offset,
              amountDisplay,
              dealUrl: `${APP_URL}/greystar/deals/${deal.id}`,
            },
          );
          if (ok) {
            if (offset === 7) stats.maturity7++; else stats.maturity1++;
          }
        }
      }
    }
  }

  // -------- 4) Safety-net: auto-invite exporters that were never invited --------
  // RULE: every exporter MUST receive an invitation. If a row was created
  // (via admin tooling, migration, or a UI flow that skipped the invite), this
  // job picks it up the next day and fires invite-exporter. Idempotent: once
  // invite_sent_at is set the row is no longer matched.
  {
    const { data: missing, error } = await supabase
      .from('exporters')
      .select('id, contact_email, director_name, company_name')
      .is('invite_sent_at', null)
      .is('exporter_user_id', null)
      .not('contact_email', 'is', null);

    if (error) {
      console.error('missing-invite query error', error.message);
    } else {
      for (const exp of (missing ?? []) as any[]) {
        const email = (exp.contact_email as string | null)?.trim();
        if (!email) continue;
        try {
          const { error: invErr } = await supabase.functions.invoke('invite-exporter', {
            body: {
              email,
              full_name: exp.director_name ?? '',
              organisation: exp.company_name ?? '',
              exporter_id: exp.id,
            },
          });
          if (invErr) {
            console.error(`auto-invite failed for ${email}:`, invErr.message);
            stats.failed++;
          } else {
            stats.missingInvitesFixed++;
          }
        } catch (e) {
          console.error(`auto-invite threw for ${email}:`, (e as Error).message);
          stats.failed++;
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, today, stats }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
