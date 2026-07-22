// Veloxis Deal Room — TypeScript Types

export type AppRole = 'super_admin' | 'admin_manager' | 'deal_manager' | 'exporter' | 'partner_admin' | 'partner_staff';

export type EntityType = 'limited_company' | 'plc' | 'llp' | 'incorporated_trustee';

export type CommodityType = 'solid_minerals' | 'scrap_metal' | 'manufactured_goods' | 'textiles';

export type DealStatus =
  | 'draft' | 'submitted' | 'changes_requested' | 'sent_to_veloxis' /* legacy */
  | 'under_review' | 'docs_requested'
  | 'ready_for_final_approval' | 'rejection_pending_approval'
  | 'pending_exporter_acceptance' | 'declined_by_exporter'
  | 'approved'
  | 'deed_sent' | 'deed_acknowledged'
  | 'rejected' | 'rejected_by_partner' | 'rejected_by_veloxis'
  | 'ipu_sent' | 'ipu_expired' | 'ipu_signed_awaiting_funding' /* legacy */
  | 'funded_active' | 'repayment_due' | 'overdue' | 'payment_received'
  | 'in_collections'
  | 'closed_repaid' | 'closed_partial';

export type KycStatus =
  | 'pending_documents' | 'documents_uploaded' | 'under_review'
  | 'verified' | 'kyc_document_expired' | 'rejected';

export type ExpiryStatus = 'valid' | 'expiring_soon_60' | 'expiring_soon_30' | 'expiring_soon_7' | 'expired' | 'no_expiry';

export type SubscriptionTier = 'pay_as_you_go' | 'veloxis_pro';

export type InvoiceCurrency = 'GBP' | 'USD' | 'EUR' | 'NGN';

export type ExporterDocumentType = 'cac_certificate' | 'director_id' | 'nepc_certificate' | 'registered_address_proof' | 'ubo_declaration_doc' | 'source_of_funds_doc' | 'bank_statements' | 'other';

export type DealDocumentType = 'commercial_invoice' | 'bill_of_lading' | 'buyer_registration_doc' | 'ipu_signed' | 'payment_advice' | 'deed_of_assignment' | 'notice_of_assignment' | 'buyer_confirmation' | 'disbursement_proof' | 'repayment_proof' | 'other';

export type SanctionsScreeningStatus = 'pending_screening' | 'clear' | 'flagged';
export type BuyerCreditCheckStatus = 'pending' | 'pass' | 'refer' | 'fail';

export const SANCTIONS_STATUS_LABELS: Record<SanctionsScreeningStatus, string> = {
  pending_screening: 'Pending Screening',
  clear: 'Clear',
  flagged: 'Flagged',
};

export const SANCTIONS_STATUS_COLORS: Record<SanctionsScreeningStatus, string> = {
  pending_screening: 'bg-warning/10 text-warning',
  clear: 'bg-success/10 text-success',
  flagged: 'bg-destructive/10 text-destructive',
};

export const BUYER_CREDIT_CHECK_LABELS: Record<BuyerCreditCheckStatus, string> = {
  pending: 'Pending',
  pass: 'Pass',
  refer: 'Refer',
  fail: 'Fail',
};

export const BUYER_CREDIT_CHECK_COLORS: Record<BuyerCreditCheckStatus, string> = {
  pending: 'bg-warning/10 text-warning',
  pass: 'bg-success/10 text-success',
  refer: 'bg-primary/10 text-primary',
  fail: 'bg-destructive/10 text-destructive',
};

export type SettlementMethod = 'dom_account' | 'naira_account';
export type RepaymentReconciliationStatus = 'exact' | 'short_payment' | 'overpayment';

export const SETTLEMENT_METHOD_LABELS: Record<SettlementMethod, string> = {
  dom_account: 'Foreign Currency to Domiciliary Account',
  naira_account: 'NGN to Naira Account',
};

export const RECONCILIATION_STATUS_LABELS: Record<RepaymentReconciliationStatus, string> = {
  exact: 'Exact',
  short_payment: 'Short Payment',
  overpayment: 'Overpayment',
};

export const RECONCILIATION_STATUS_COLORS: Record<RepaymentReconciliationStatus, string> = {
  exact: 'bg-success/10 text-success',
  short_payment: 'bg-destructive/10 text-destructive',
  overpayment: 'bg-warning/10 text-warning',
};

export type AuditAction =
  | 'deal_created' | 'deal_submitted' | 'document_uploaded' | 'deal_moved_to_under_review'
  | 'document_requested' | 'deal_approved' | 'deal_rejected' | 'ipu_generated' | 'ipu_sent'
  | 'ipu_signed' | 'ipu_expired' | 'ipu_resent' | 'funding_recorded' | 'repayment_recorded'
  | 'demurrage_updated' | 'internal_note_added' | 'deal_closed' | 'deal_status_changed'
  | 'pricing_recalculated' | 'document_superseded' | 'exporter_created' | 'kyc_verified'
  | 'kyc_rejected' | 'upload_token_generated' | 'exporter_document_uploaded'
  | 'exporter_document_verified' | 'buyer_ch_verified' | 'buyer_ch_not_found';

// UI Label Maps
export type Portal = 'exporter' | 'partner' | 'veloxis';

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  changes_requested: 'Changes Requested',
  sent_to_veloxis: 'Under Review',
  under_review: 'Under Review',
  docs_requested: 'Documents Requested',
  ready_for_final_approval: 'Ready for Final Approval',
  rejection_pending_approval: 'Rejection Pending Approval',
  pending_exporter_acceptance: 'Pending Exporter Acceptance',
  declined_by_exporter: 'Declined by Exporter',
  approved: 'Approved',
  deed_sent: 'Deed Sent',
  deed_acknowledged: 'Deed Acknowledged',
  rejected: 'Rejected',
  rejected_by_partner: 'Rejected by Partner',
  rejected_by_veloxis: 'Rejected by Veloxis',
  ipu_sent: 'IPU Sent',
  ipu_expired: 'IPU Expired',
  ipu_signed_awaiting_funding: 'IPU Signed — Awaiting Funding',
  funded_active: 'Funded (Active)',
  repayment_due: 'Repayment Due',
  overdue: 'Overdue',
  payment_received: 'Payment Received — Pending Closure',
  in_collections: 'In Collections',
  closed_repaid: 'Closed (Repaid)',
  closed_partial: 'Closed (Partial)',
};

// Portal-specific overrides for status labels
export const PORTAL_STATUS_OVERRIDES: Record<Portal, Partial<Record<DealStatus, string>>> = {
  exporter: {
    sent_to_veloxis: 'Under Review',
    under_review: 'Under Review',
    pending_exporter_acceptance: 'Offer Received',
    declined_by_exporter: 'Offer Declined',
    approved: 'Approved — Awaiting IPU',
    ipu_sent: 'Approved — IPU Sent to Buyer',
    ipu_signed_awaiting_funding: 'IPU Signed — Disbursement in Progress',
    funded_active: 'Funded (Active)',
    overdue: 'Overdue — Penalty Accruing',
    payment_received: 'Payment Received — Confirm Receipt',
    closed_repaid: 'Closed (Repaid)',
    closed_partial: 'Closed (Partial)',
  },
  partner: {
    sent_to_veloxis: 'Under Review',
    under_review: 'Under Review',
    pending_exporter_acceptance: 'Awaiting Exporter Response',
    declined_by_exporter: 'Declined by Exporter',
    approved: 'Approved — Awaiting IPU',
    ipu_sent: 'IPU Sent to Buyer',
    ipu_signed_awaiting_funding: 'IPU Signed — Awaiting Funding',
    funded_active: 'Funded (Active)',
    overdue: 'Overdue',
    payment_received: 'Payment Received — Pending Closure',
    closed_repaid: 'Closed (Repaid)',
  },
  veloxis: {
    sent_to_veloxis: 'Under Review',
    under_review: 'Under Review',
    pending_exporter_acceptance: 'Pending Exporter Acceptance',
    declined_by_exporter: 'Declined by Exporter',
  },
};

export function getDealStatusLabel(status: DealStatus, portal?: Portal): string {
  if (portal && PORTAL_STATUS_OVERRIDES[portal]?.[status]) {
    return PORTAL_STATUS_OVERRIDES[portal][status]!;
  }
  return DEAL_STATUS_LABELS[status];
}

export const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/10 text-primary',
  changes_requested: 'bg-warning/10 text-warning',
  sent_to_veloxis: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  docs_requested: 'bg-warning/10 text-warning',
  ready_for_final_approval: 'bg-primary/10 text-primary',
  rejection_pending_approval: 'bg-destructive/10 text-destructive',
  pending_exporter_acceptance: 'bg-primary/10 text-primary',
  declined_by_exporter: 'bg-destructive/10 text-destructive',
  approved: 'bg-success/10 text-success',
  deed_sent: 'bg-primary/10 text-primary',
  deed_acknowledged: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  rejected_by_partner: 'bg-destructive/10 text-destructive',
  rejected_by_veloxis: 'bg-destructive/10 text-destructive',
  ipu_sent: 'bg-primary/10 text-primary',
  ipu_expired: 'bg-destructive/10 text-destructive',
  ipu_signed_awaiting_funding: 'bg-success/10 text-success',
  funded_active: 'bg-success/10 text-success',
  repayment_due: 'bg-warning/10 text-warning',
  overdue: 'bg-destructive/10 text-destructive',
  payment_received: 'bg-success/10 text-success',
  in_collections: 'bg-destructive/10 text-destructive',
  closed_repaid: 'bg-muted text-muted-foreground',
  closed_partial: 'bg-muted text-muted-foreground',
};

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  pending_documents: 'Pending Documents',
  documents_uploaded: 'Documents Uploaded',
  under_review: 'Under Review',
  verified: 'Verified',
  kyc_document_expired: 'Document Expired',
  rejected: 'Rejected',
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  limited_company: 'Limited Company',
  plc: 'PLC',
  llp: 'LLP',
  incorporated_trustee: 'Incorporated Trustee',
};

// Defensive map covering enum values that may legitimately appear in legacy
// data even though they're not in the EntityType union (sole_trader,
// partnership, other). Use this everywhere Entity Type is rendered.
const ENTITY_TYPE_FALLBACK_LABELS: Record<string, string> = {
  sole_trader: 'Sole Trader',
  partnership: 'Partnership',
  other: 'Other',
};

export function formatEntityType(value: string | null | undefined): string {
  if (!value) return '—';
  if (value in ENTITY_TYPE_LABELS) return ENTITY_TYPE_LABELS[value as EntityType];
  if (value in ENTITY_TYPE_FALLBACK_LABELS) return ENTITY_TYPE_FALLBACK_LABELS[value];
  // Fallback: prettify snake_case
  return value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const COMMODITY_TYPE_LABELS: Record<CommodityType, string> = {
  solid_minerals: 'Solid Minerals',
  scrap_metal: 'Scrap Metal',
  manufactured_goods: 'Manufactured Goods',
  textiles: 'Textiles',
};

export const CURRENCY_SYMBOLS: Record<InvoiceCurrency, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  NGN: '₦',
};

export const BUYER_COUNTRY_WHITELIST = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
  'Iceland', 'Ireland', 'Italy', 'Latvia', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Malta', 'Netherlands', 'Norway', 'Poland', 'Portugal',
  'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland',
  'United Kingdom',
] as const;

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin_manager: 'Admin Manager',
  deal_manager: 'Deal Manager',
  exporter: 'Exporter',
  partner_admin: 'Partner Admin',
  partner_staff: 'Partner Staff',
};

export type OnboardingStatus = 'invited' | 'password_set' | 'onboarding_in_progress' | 'onboarding_submitted' | 'onboarding_approved' | 'onboarding_rejected';

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  invited: 'Invite Pending',
  password_set: 'Password Set',
  onboarding_in_progress: 'Onboarding In Progress',
  onboarding_submitted: 'Onboarding Submitted',
  onboarding_approved: 'Approved',
  onboarding_rejected: 'Rejected',
};

export const ONBOARDING_STATUS_COLORS: Record<OnboardingStatus, string> = {
  invited: 'bg-warning/10 text-warning',
  password_set: 'bg-primary/10 text-primary',
  onboarding_in_progress: 'bg-primary/10 text-primary',
  onboarding_submitted: 'bg-warning/10 text-warning',
  onboarding_approved: 'bg-success/10 text-success',
  onboarding_rejected: 'bg-destructive/10 text-destructive',
};
