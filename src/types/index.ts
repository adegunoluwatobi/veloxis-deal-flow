// Veloxis Deal Room — TypeScript Types

export type AppRole = 'super_admin' | 'partner_admin' | 'partner_staff' | 'deal_manager' | 'exporter';

export type EntityType = 'limited_company' | 'plc' | 'llp' | 'incorporated_trustee';

export type CommodityType = 'solid_minerals' | 'scrap_metal' | 'manufactured_goods' | 'textiles';

export type DealStatus =
  | 'draft' | 'submitted' | 'under_review' | 'docs_requested'
  | 'ready_for_final_approval' | 'approved'
  | 'rejected' | 'ipu_sent' | 'ipu_expired' | 'ipu_signed_awaiting_funding'
  | 'funded_active' | 'repayment_due' | 'overdue'
  | 'closed_repaid' | 'closed_partial';

export type KycStatus =
  | 'pending_documents' | 'documents_uploaded' | 'under_review'
  | 'verified' | 'kyc_document_expired' | 'rejected';

export type ExpiryStatus = 'valid' | 'expiring_soon_60' | 'expiring_soon_30' | 'expiring_soon_7' | 'expired' | 'no_expiry';

export type SubscriptionTier = 'pay_as_you_go' | 'veloxis_pro';

export type InvoiceCurrency = 'GBP' | 'USD' | 'EUR';

export type ExporterDocumentType = 'cac_certificate' | 'director_id' | 'nepc_certificate' | 'other';

export type DealDocumentType = 'commercial_invoice' | 'bill_of_lading' | 'other';

export type AuditAction =
  | 'deal_created' | 'deal_submitted' | 'document_uploaded' | 'deal_moved_to_under_review'
  | 'document_requested' | 'deal_approved' | 'deal_rejected' | 'ipu_generated' | 'ipu_sent'
  | 'ipu_signed' | 'ipu_expired' | 'ipu_resent' | 'funding_recorded' | 'repayment_recorded'
  | 'demurrage_updated' | 'internal_note_added' | 'deal_closed' | 'deal_status_changed'
  | 'pricing_recalculated' | 'document_superseded' | 'exporter_created' | 'kyc_verified'
  | 'kyc_rejected' | 'upload_token_generated' | 'exporter_document_uploaded'
  | 'exporter_document_verified';

// UI Label Maps
export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  docs_requested: 'Documents Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  ipu_sent: 'IPU Sent',
  ipu_expired: 'IPU Expired',
  ipu_signed_awaiting_funding: 'IPU Signed — Awaiting Funding',
  funded_active: 'Funded (Active)',
  repayment_due: 'Repayment Due',
  overdue: 'Overdue',
  closed_repaid: 'Closed (Repaid)',
  closed_partial: 'Closed (Partial)',
};

export const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  docs_requested: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  ipu_sent: 'bg-primary/10 text-primary',
  ipu_expired: 'bg-destructive/10 text-destructive',
  ipu_signed_awaiting_funding: 'bg-success/10 text-success',
  funded_active: 'bg-success/10 text-success',
  repayment_due: 'bg-warning/10 text-warning',
  overdue: 'bg-destructive/10 text-destructive',
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
  partner_admin: 'Partner Admin',
  partner_staff: 'Partner Staff',
  deal_manager: 'Deal Manager',
  exporter: 'Exporter',
};
