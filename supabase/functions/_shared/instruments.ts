// Shared helpers for Stage 2 instrument generation and signature routing.

export const INSTRUMENT_CODES = [
  'notice_of_assignment',
  'deed_of_assignment',
  'domiciliation_instruction',
] as const;

export type InstrumentCode = typeof INSTRUMENT_CODES[number];

export const SIGNER_PLAN: Record<InstrumentCode, Array<'exporter_signatory' | 'veloxis_countersignatory' | 'veloxis_approver'>> = {
  notice_of_assignment: ['exporter_signatory', 'veloxis_countersignatory'],
  deed_of_assignment: ['exporter_signatory', 'veloxis_approver'],
  domiciliation_instruction: ['exporter_signatory'],
};

const money = (v: unknown, currency: string) => {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return '';
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + currency;
};

const date = (v: unknown) =>
  v ? new Date(String(v)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/** Builds the merge token map for one invoice. */
export function buildTokens(ctx: {
  invoice: any; exporter: any; buyer: any; signatory: any; bank: any;
}): Record<string, string> {
  const { invoice: i, exporter: e, buyer: b, signatory: s, bank } = ctx;
  const currency = String(i.invoice_currency ?? 'USD');
  const gross = Number(i.gross_invoice_value ?? i.invoice_amount ?? 0);
  const deductions = Number(i.agreed_deductions ?? 0);
  const net = Math.max(0, gross - deductions);
  const advance = net * (Number(i.advance_rate ?? 0) / 100);
  const holdback = Math.max(0, net - advance);

  const account = bank
    ? [
        bank.bank_name && `Bank: ${bank.bank_name}`,
        bank.account_name && `Account name: ${bank.account_name}`,
        bank.account_number && `Account number: ${bank.account_number}`,
        bank.sort_code_iban && `Sort code or IBAN: ${bank.sort_code_iban}`,
        bank.swift_bic && `SWIFT or BIC: ${bank.swift_bic}`,
        bank.account_currency && `Currency: ${bank.account_currency}`,
        bank.bank_country && `Country: ${bank.bank_country}`,
      ].filter(Boolean).join('\n')
    : 'Domiciliary account details not on file';

  return {
    invoice_reference: i.reference ?? '',
    invoice_number: i.invoice_number ?? '',
    gross_invoice_value: money(gross, currency).replace(' ' + currency, ''),
    currency,
    agreed_deductions: money(deductions, currency).replace(' ' + currency, ''),
    advance_amount: money(advance, currency).replace(' ' + currency, ''),
    holdback_amount: money(holdback, currency).replace(' ' + currency, ''),
    maturity_date: date(i.maturity_date),
    incoterm: i.incoterm ?? '',
    commodity: i.commodity ?? '',
    bl_number: i.bl_number ?? '',
    bl_date: date(i.bl_date),
    port_of_loading: i.port_of_loading ?? '',
    port_of_discharge: i.port_of_discharge ?? '',
    exporter_legal_name: e?.company_name ?? '',
    exporter_rc_number: e?.rc_number ?? e?.company_registration_number ?? '',
    exporter_registered_address: e?.address ?? '',
    signatory_name: s?.full_name ?? '',
    signatory_position: s?.position ?? '',
    buyer_legal_name: b?.company_name ?? '',
    buyer_registered_address: b?.registered_address ?? '',
    buyer_company_number: b?.registration_number ?? b?.companies_house_id ?? '',
    domiciliary_account_details: account,
    today_date: date(new Date().toISOString()),
  };
}

export function render(body: string, tokens: Record<string, string>) {
  const missing: string[] = [];
  const out = body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = tokens[key];
    if (v === undefined) { missing.push(key); return `{{${key}}}`; }
    if (v === '') { missing.push(key); return '[not on file]'; }
    return v;
  });
  return { out, missing: Array.from(new Set(missing)) };
}
