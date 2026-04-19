import { supabase } from '@/integrations/supabase/client';
import { sendOnboardingEmail, appUrl, resolvePartnerAdminRecipient } from '@/lib/sendOnboardingEmail';

const CURRENCY_FALLBACK = 'GBP';

const fmtMoney = (value: number | null | undefined): string =>
  (value ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface DealContext {
  dealId: string;
  dealReference: string;
  exporterCompanyName: string;
  exporterContactEmail: string | null;
  exporterContactName: string | null;
  partnerOrganisationId: string | null;
  buyerCompanyName: string;
  invoiceCurrency: string;
  invoiceValue: number | null;
  advanceAmount: number | null;
  netAdvanceAmount: number | null;
  disbursementDate: string | null;
  repaymentDueDate: string | null;
  paymentAmountReceived: number | null;
  residualBalance: number | null;
}

/**
 * Load the join of fields needed by every Stage-2 lifecycle email.
 * Returns null silently if anything is missing — emails are best-effort.
 */
export async function loadDealContext(dealId: string): Promise<DealContext | null> {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      id, deal_reference, buyer_company_name, invoice_currency_v2, invoice_value,
      advance_amount, net_advance_amount, disbursement_date, repayment_due_date,
      payment_amount_received, residual_balance, partner_organisation_id,
      exporter:exporters!deals_exporter_id_fkey ( company_name, contact_email, director_name )
    `)
    .eq('id', dealId)
    .maybeSingle();

  if (error || !data) return null;
  const exporter = (data as any).exporter as { company_name: string; contact_email: string | null; director_name: string | null } | null;
  return {
    dealId: data.id as string,
    dealReference: (data.deal_reference as string) ?? '',
    exporterCompanyName: exporter?.company_name ?? 'Your company',
    exporterContactEmail: exporter?.contact_email ?? null,
    exporterContactName: exporter?.director_name ?? null,
    partnerOrganisationId: (data as any).partner_organisation_id ?? null,
    buyerCompanyName: (data.buyer_company_name as string) ?? 'your buyer',
    invoiceCurrency: ((data as any).invoice_currency_v2 as string) ?? CURRENCY_FALLBACK,
    invoiceValue: (data.invoice_value as number | null) ?? null,
    advanceAmount: (data.advance_amount as number | null) ?? null,
    netAdvanceAmount: (data.net_advance_amount as number | null) ?? null,
    disbursementDate: (data.disbursement_date as string | null) ?? null,
    repaymentDueDate: (data.repayment_due_date as string | null) ?? null,
    paymentAmountReceived: (data.payment_amount_received as number | null) ?? null,
    residualBalance: (data.residual_balance as number | null) ?? null,
  };
}

function exporterDealUrl(dealId: string): string {
  return appUrl(`/exporter/deals/${dealId}`);
}
function partnerDealUrl(dealId: string): string {
  return appUrl(`/greystar/deals/${dealId}`);
}

/** Email #10 — Deal approved → exporter + partner */
export async function sendDealApprovedEmails(dealId: string): Promise<void> {
  const ctx = await loadDealContext(dealId);
  if (!ctx) return;

  const baseExporter = {
    exporterContactName: ctx.exporterContactName ?? '',
    dealReference: ctx.dealReference,
    buyerCompanyName: ctx.buyerCompanyName,
    invoiceCurrency: ctx.invoiceCurrency,
    invoiceValue: fmtMoney(ctx.invoiceValue),
    advanceAmount: fmtMoney(ctx.advanceAmount),
    netAdvanceAmount: fmtMoney(ctx.netAdvanceAmount),
    dealUrl: exporterDealUrl(ctx.dealId),
  };

  if (ctx.exporterContactEmail) {
    await sendOnboardingEmail({
      templateName: 'deal-approved-to-exporter',
      recipientEmail: ctx.exporterContactEmail,
      idempotencyKey: `deal-approved-exp-${ctx.dealId}`,
      templateData: baseExporter,
    });
  }

  const partner = await resolvePartnerAdminRecipient(ctx.partnerOrganisationId);
  if (partner) {
    await sendOnboardingEmail({
      templateName: 'deal-approved-to-partner',
      recipientEmail: partner.email,
      idempotencyKey: `deal-approved-pt-${ctx.dealId}`,
      templateData: {
        partnerAdminName: partner.fullName,
        dealReference: ctx.dealReference,
        exporterCompanyName: ctx.exporterCompanyName,
        buyerCompanyName: ctx.buyerCompanyName,
        invoiceCurrency: ctx.invoiceCurrency,
        invoiceValue: fmtMoney(ctx.invoiceValue),
        dealUrl: partnerDealUrl(ctx.dealId),
      },
    });
  }
}

/** Email #11 — IPU signed → exporter (partner already has a banner) */
export async function sendIpuSignedEmail(dealId: string): Promise<void> {
  const ctx = await loadDealContext(dealId);
  if (!ctx?.exporterContactEmail) return;
  await sendOnboardingEmail({
    templateName: 'ipu-signed-to-exporter',
    recipientEmail: ctx.exporterContactEmail,
    idempotencyKey: `ipu-signed-exp-${ctx.dealId}`,
    templateData: {
      exporterContactName: ctx.exporterContactName ?? '',
      dealReference: ctx.dealReference,
      buyerCompanyName: ctx.buyerCompanyName,
      dealUrl: exporterDealUrl(ctx.dealId),
    },
  });
}

/** Email #12 — Deal funded → exporter + partner */
export async function sendDealFundedEmails(dealId: string): Promise<void> {
  const ctx = await loadDealContext(dealId);
  if (!ctx) return;

  const shared = {
    dealReference: ctx.dealReference,
    invoiceCurrency: ctx.invoiceCurrency,
    netAdvanceAmount: fmtMoney(ctx.netAdvanceAmount),
    disbursementDate: fmtDate(ctx.disbursementDate),
    repaymentDueDate: fmtDate(ctx.repaymentDueDate),
  };

  if (ctx.exporterContactEmail) {
    await sendOnboardingEmail({
      templateName: 'deal-funded-to-exporter',
      recipientEmail: ctx.exporterContactEmail,
      idempotencyKey: `deal-funded-exp-${ctx.dealId}`,
      templateData: {
        ...shared,
        exporterContactName: ctx.exporterContactName ?? '',
        dealUrl: exporterDealUrl(ctx.dealId),
      },
    });
  }

  const partner = await resolvePartnerAdminRecipient(ctx.partnerOrganisationId);
  if (partner) {
    await sendOnboardingEmail({
      templateName: 'deal-funded-to-partner',
      recipientEmail: partner.email,
      idempotencyKey: `deal-funded-pt-${ctx.dealId}`,
      templateData: {
        ...shared,
        partnerAdminName: partner.fullName,
        exporterCompanyName: ctx.exporterCompanyName,
        dealUrl: partnerDealUrl(ctx.dealId),
      },
    });
  }
}

/** Email #13 — Deal overdue → exporter + partner. Idempotent per overdue date. */
export async function sendDealOverdueEmails(dealId: string): Promise<void> {
  const ctx = await loadDealContext(dealId);
  if (!ctx) return;
  const dueKey = ctx.repaymentDueDate ?? 'unknown';

  if (ctx.exporterContactEmail) {
    await sendOnboardingEmail({
      templateName: 'deal-overdue-to-exporter',
      recipientEmail: ctx.exporterContactEmail,
      idempotencyKey: `deal-overdue-exp-${ctx.dealId}-${dueKey}`,
      templateData: {
        exporterContactName: ctx.exporterContactName ?? '',
        dealReference: ctx.dealReference,
        buyerCompanyName: ctx.buyerCompanyName,
        repaymentDueDate: fmtDate(ctx.repaymentDueDate),
        dealUrl: exporterDealUrl(ctx.dealId),
      },
    });
  }

  const partner = await resolvePartnerAdminRecipient(ctx.partnerOrganisationId);
  if (partner) {
    await sendOnboardingEmail({
      templateName: 'deal-overdue-to-partner',
      recipientEmail: partner.email,
      idempotencyKey: `deal-overdue-pt-${ctx.dealId}-${dueKey}`,
      templateData: {
        partnerAdminName: partner.fullName,
        dealReference: ctx.dealReference,
        exporterCompanyName: ctx.exporterCompanyName,
        buyerCompanyName: ctx.buyerCompanyName,
        repaymentDueDate: fmtDate(ctx.repaymentDueDate),
        dealUrl: partnerDealUrl(ctx.dealId),
      },
    });
  }
}

/** Email #14 — Payment received → exporter + partner */
export async function sendPaymentReceivedEmails(dealId: string): Promise<void> {
  const ctx = await loadDealContext(dealId);
  if (!ctx) return;

  const shared = {
    dealReference: ctx.dealReference,
    invoiceCurrency: ctx.invoiceCurrency,
    amountReceived: fmtMoney(ctx.paymentAmountReceived),
    residualBalance: fmtMoney(ctx.residualBalance),
  };

  if (ctx.exporterContactEmail) {
    await sendOnboardingEmail({
      templateName: 'payment-received-to-exporter',
      recipientEmail: ctx.exporterContactEmail,
      idempotencyKey: `payment-received-exp-${ctx.dealId}`,
      templateData: {
        ...shared,
        exporterContactName: ctx.exporterContactName ?? '',
        dealUrl: exporterDealUrl(ctx.dealId),
      },
    });
  }

  const partner = await resolvePartnerAdminRecipient(ctx.partnerOrganisationId);
  if (partner) {
    await sendOnboardingEmail({
      templateName: 'payment-received-to-partner',
      recipientEmail: partner.email,
      idempotencyKey: `payment-received-pt-${ctx.dealId}`,
      templateData: {
        ...shared,
        partnerAdminName: partner.fullName,
        exporterCompanyName: ctx.exporterCompanyName,
        dealUrl: partnerDealUrl(ctx.dealId),
      },
    });
  }
}

/** Email #15/#16 — Deal closed → exporter + partner */
export async function sendDealClosedEmails(dealId: string): Promise<void> {
  const ctx = await loadDealContext(dealId);
  if (!ctx) return;

  if (ctx.exporterContactEmail) {
    await sendOnboardingEmail({
      templateName: 'deal-closed-to-exporter',
      recipientEmail: ctx.exporterContactEmail,
      idempotencyKey: `deal-closed-exp-${ctx.dealId}`,
      templateData: {
        exporterContactName: ctx.exporterContactName ?? '',
        dealReference: ctx.dealReference,
        buyerCompanyName: ctx.buyerCompanyName,
        dealUrl: exporterDealUrl(ctx.dealId),
      },
    });
  }

  const partner = await resolvePartnerAdminRecipient(ctx.partnerOrganisationId);
  if (partner) {
    await sendOnboardingEmail({
      templateName: 'deal-closed-to-partner',
      recipientEmail: partner.email,
      idempotencyKey: `deal-closed-pt-${ctx.dealId}`,
      templateData: {
        partnerAdminName: partner.fullName,
        dealReference: ctx.dealReference,
        exporterCompanyName: ctx.exporterCompanyName,
        dealUrl: partnerDealUrl(ctx.dealId),
      },
    });
  }
}
