import type { ExporterDocumentType } from '@/types';

export interface KycDocumentLike {
  exporter_id?: string | null;
  document_type: string;
  document_status: string;
  expiry_status?: string | null;
}

export type ComputedKycStatus =
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'awaiting_admin_approval'
  | 'under_review'
  | 'pending_documents';

export interface ComputedKyc {
  status: ComputedKycStatus;
  label: string;
  badgeLabel: string;
  description: string;
  color: string;
  borderColor: string;
  icon: 'success' | 'warning' | 'destructive' | 'muted';
}

// Registered Address is captured as structured fields on the exporters row, not a document upload.
// Pass `addressComplete = false` to signal that the exporter has not filled in their address yet.
const MANDATORY: ExporterDocumentType[] = ['cac_certificate', 'director_id', 'nepc_certificate'];
const ADDRESS_LABEL = 'Registered Address';

export function groupDocumentsByExporter<T extends { exporter_id?: string | null }>(docs: T[]) {
  const grouped = new Map<string, T[]>();

  for (const doc of docs) {
    if (!doc.exporter_id) continue;
    const existing = grouped.get(doc.exporter_id) ?? [];
    existing.push(doc);
    grouped.set(doc.exporter_id, existing);
  }

  return grouped;
}

/**
 * Derive KYC status live from the active (non-superseded) documents list.
 *
 * Approval gate (Prompt 4): an exporter is only "verified" once a Super Admin or
 * Deal Manager has explicitly approved the file (we read this from the exporter
 * row's `kyc_verified_at`). When all documents are uploaded + verified at the
 * document level but no admin sign-off is recorded, status is
 * `awaiting_admin_approval` ("Pending KYC Approval").
 *
 * Priority: outstanding requests > rejected > expired > pending_review > pending upload >
 *           awaiting admin approval > verified
 */
export function computeKycStatus(
  activeDocs: KycDocumentLike[],
  pendingRequestCount = 0,
  addressComplete = true,
  adminApprovedAt: string | null = null,
): ComputedKyc {
  if (pendingRequestCount > 0) {
    return {
      status: 'rejected',
      label: 'Action Required',
      badgeLabel: 'Action Required',
      description: 'Additional documents have been requested. Please log in to upload them.',
      color: 'bg-destructive/10 text-destructive',
      borderColor: 'border-destructive/30 bg-destructive/5',
      icon: 'destructive',
    };
  }

  const docLabel = (t: string) =>
    t === 'cac_certificate' ? 'CAC Certificate'
      : t === 'director_id' ? 'Director ID'
      : t === 'nepc_certificate' ? 'Export Licence'
      : t;

  const byType = new Map<string, KycDocumentLike>();

  for (const doc of activeDocs) {
    if (!byType.has(doc.document_type)) {
      byType.set(doc.document_type, doc);
    }
  }

  const mandatoryDocs = MANDATORY.map((type) => ({ type, doc: byType.get(type) }));
  const missing = mandatoryDocs.filter((item) => !item.doc);
  const rejected = mandatoryDocs.filter((item) => item.doc?.document_status === 'rejected');
  const expired = mandatoryDocs.filter(
    (item) => item.doc?.expiry_status === 'expired' || item.doc?.document_status === 'expired'
  );
  const pending = mandatoryDocs.filter((item) => item.doc?.document_status === 'pending_review');
  const verified = mandatoryDocs.filter((item) => item.doc?.document_status === 'verified');

  if (rejected.length > 0) {
    return {
      status: 'rejected',
      label: 'Action Required',
      badgeLabel: 'Action Required',
      description: 'One or more documents were rejected. Please re-upload.',
      color: 'bg-destructive/10 text-destructive',
      borderColor: 'border-destructive/30 bg-destructive/5',
      icon: 'destructive',
    };
  }

  if (expired.length > 0) {
    return {
      status: 'expired',
      label: 'Documents Expired',
      badgeLabel: 'Expired',
      description: 'Please renew your expired documents.',
      color: 'bg-warning/10 text-warning',
      borderColor: 'border-warning/30 bg-warning/5',
      icon: 'warning',
    };
  }

  if (pending.length > 0 && missing.length === 0 && addressComplete) {
    return {
      status: 'under_review',
      label: 'Under Review',
      badgeLabel: 'Under Review',
      description: 'Your documents are being reviewed.',
      color: 'bg-warning/10 text-warning',
      borderColor: 'border-warning/30 bg-warning/5',
      icon: 'warning',
    };
  }

  if (missing.length > 0 || !addressComplete) {
    const parts = [
      ...missing.map((m) => m.type === 'cac_certificate' ? 'CAC Certificate' : m.type === 'director_id' ? 'Director ID' : 'Export Licence'),
      ...(!addressComplete ? [ADDRESS_LABEL] : []),
    ];
    return {
      status: 'pending_documents',
      label: 'Pending Documents',
      badgeLabel: 'Pending Documents',
      description: `Please complete: ${parts.join(', ')}.`,
      color: 'bg-muted text-muted-foreground',
      borderColor: 'border-muted bg-muted/30',
      icon: 'muted',
    };
  }

  // All documents verified at the doc level + address complete.
  // The final 'Complete' status requires an explicit admin approval.
  if (verified.length === MANDATORY.length && addressComplete) {
    if (!adminApprovedAt) {
      return {
        status: 'awaiting_admin_approval',
        label: 'Pending KYC Approval',
        badgeLabel: 'Pending KYC Approval',
        description: 'Your documents are verified and awaiting final sign-off by Veloxis.',
        color: 'bg-primary/10 text-primary',
        borderColor: 'border-primary/30 bg-primary/5',
        icon: 'warning',
      };
    }
    return {
      status: 'verified',
      label: 'Complete',
      badgeLabel: 'KYC Complete',
      description: 'All mandatory documents verified and approved by Veloxis.',
      color: 'bg-success/10 text-success',
      borderColor: 'border-success/30 bg-success/5',
      icon: 'success',
    };
  }

  return {
    status: 'pending_documents',
    label: 'Pending Documents',
    badgeLabel: 'Pending Documents',
    description: 'Please upload your CAC Certificate, Director ID, Export Licence, and Registered Address Proof.',
    color: 'bg-muted text-muted-foreground',
    borderColor: 'border-muted bg-muted/30',
    icon: 'muted',
  };
}
