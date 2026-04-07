import type { ExporterDocumentType } from '@/types';

export type ComputedKycStatus = 'verified' | 'rejected' | 'expired' | 'under_review' | 'pending_documents';

export interface ComputedKyc {
  status: ComputedKycStatus;
  label: string;
  description: string;
  color: string;
  borderColor: string;
  icon: 'success' | 'warning' | 'destructive' | 'muted';
}

const MANDATORY: ExporterDocumentType[] = ['cac_certificate', 'director_id', 'nepc_certificate'];

/**
 * Derive KYC status live from the active (non-superseded) documents list.
 * Priority: rejected > expired > pending_review > pending upload > verified
 */
export function computeKycStatus(activeDocs: { document_type: string; document_status: string; expiry_status?: string }[]): ComputedKyc {
  const byType = new Map<string, { document_status: string; expiry_status?: string }>();
  for (const doc of activeDocs) {
    // Keep latest per type (activeDocs should already be non-superseded)
    if (!byType.has(doc.document_type)) {
      byType.set(doc.document_type, doc);
    }
  }

  const mandatoryDocs = MANDATORY.map(t => ({ type: t, doc: byType.get(t) }));

  // Check missing
  const missing = mandatoryDocs.filter(m => !m.doc);
  const rejected = mandatoryDocs.filter(m => m.doc?.document_status === 'rejected');
  const expired = mandatoryDocs.filter(m => m.doc?.expiry_status === 'expired');
  const pending = mandatoryDocs.filter(m => m.doc?.document_status === 'pending_review');
  const verified = mandatoryDocs.filter(m => m.doc?.document_status === 'verified');

  // Priority order
  if (rejected.length > 0) {
    return {
      status: 'rejected',
      label: 'Action Required',
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
      description: 'Please renew your expired documents.',
      color: 'bg-destructive/10 text-destructive',
      borderColor: 'border-destructive/30 bg-destructive/5',
      icon: 'destructive',
    };
  }

  if (pending.length > 0 && missing.length === 0) {
    return {
      status: 'under_review',
      label: 'Under Review',
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
      description: 'All mandatory documents verified.',
      color: 'bg-success/10 text-success',
      borderColor: 'border-success/30 bg-success/5',
      icon: 'success',
    };
  }

  // Fallback
  return {
    status: 'pending_documents',
    label: 'Pending Documents',
    description: 'Please upload your CAC Certificate, Director ID, and NEPC Certificate.',
    color: 'bg-muted text-muted-foreground',
    borderColor: 'border-muted bg-muted/30',
    icon: 'muted',
  };
}
