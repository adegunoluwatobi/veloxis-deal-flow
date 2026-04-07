import type { ExporterDocumentType } from '@/types';

const DOC_TYPE_LABELS: Record<ExporterDocumentType, string> = {
  cac_certificate: 'CAC Certificate',
  director_id: 'Director ID',
  nepc_certificate: 'NEPC Certificate',
  other: 'Other',
};

export type DocOption = {
  value: ExporterDocumentType;
  label: string;
  disabled: boolean;
};

/**
 * Build dropdown options based on existing active (non-superseded) documents.
 * - pending_review / verified → disabled
 * - rejected / expired → enabled with suffix
 * - no upload → enabled
 */
export function buildDocTypeOptions(activeDocs: Array<{ document_type: string; document_status: string; expiry_status?: string }>): DocOption[] {
  const MANDATORY: ExporterDocumentType[] = ['cac_certificate', 'director_id', 'nepc_certificate'];

  return MANDATORY.map((type) => {
    const existing = activeDocs.find((d) => d.document_type === type);
    if (!existing) {
      return { value: type, label: DOC_TYPE_LABELS[type], disabled: false };
    }
    if (existing.document_status === 'rejected') {
      return { value: type, label: `${DOC_TYPE_LABELS[type]} — Rejected, re-upload required`, disabled: false };
    }
    if (existing.expiry_status === 'expired') {
      return { value: type, label: `${DOC_TYPE_LABELS[type]} — Expired, renewal required`, disabled: false };
    }
    if (existing.document_status === 'pending_review') {
      return { value: type, label: `${DOC_TYPE_LABELS[type]} — Pending Review`, disabled: true };
    }
    if (existing.document_status === 'verified') {
      return { value: type, label: `${DOC_TYPE_LABELS[type]} — Uploaded`, disabled: true };
    }
    return { value: type, label: DOC_TYPE_LABELS[type], disabled: false };
  });
}

export { DOC_TYPE_LABELS };
