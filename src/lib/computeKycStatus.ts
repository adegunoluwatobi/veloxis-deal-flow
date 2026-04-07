import type { ExporterDocumentType } from '@/types';

export interface KycDocumentLike {
  exporter_id?: string | null;
  document_type: string;
  document_status: string;
  expiry_status?: string | null;
}

export type ComputedKycStatus = 'verified' | 'rejected' | 'expired' | 'under_review' | 'pending_documents';

export interface ComputedKyc {
  status: ComputedKycStatus;
  label: string;
  badgeLabel: string;
  description: string;
  color: string;
  borderColor: string;
  icon: 'success' | 'warning' | 'destructive' | 'muted';
}

const MANDATORY: ExporterDocumentType[] = ['cac_certificate', 'director_id', 'nepc_certificate'];

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
 * Priority: outstanding requests > rejected > expired > pending_review > pending upload > verified
 */
export function computeKycStatus(activeDocs: KycDocumentLike[], pendingRequestCount = 0): ComputedKyc {
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

  if (pending.length > 0 && missing.length === 0) {
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

  if (missing.length > 0) {
    return {
      status: 'pending_documents',
      label: 'Pending Documents',
      badgeLabel: 'Pending Documents',
      description: 'Please upload your CAC Certificate, Director ID, and NEPC Certificate.',
      color: 'bg-muted text-muted-foreground',
      borderColor: 'border-muted bg-muted/30',
      icon: 'muted',
    };
  }

  if (verified.length === MANDATORY.length) {
    return {
      status: 'verified',
      label: 'Complete',
      badgeLabel: 'KYC Complete',
      description: 'All mandatory documents verified.',
      color: 'bg-success/10 text-success',
      borderColor: 'border-success/30 bg-success/5',
      icon: 'success',
    };
  }

  return {
    status: 'pending_documents',
    label: 'Pending Documents',
    badgeLabel: 'Pending Documents',
    description: 'Please upload your CAC Certificate, Director ID, and NEPC Certificate.',
    color: 'bg-muted text-muted-foreground',
    borderColor: 'border-muted bg-muted/30',
    icon: 'muted',
  };
}
