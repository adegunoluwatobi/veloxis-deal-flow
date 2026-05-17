import type { SanctionsScreeningStatus } from '@/types';

interface Props {
  exporterId: string;
  sanctionsStatus: SanctionsScreeningStatus;
  eddRequired: boolean;
  eddCompleted: boolean;
  sourceOfFundsStatement: string | null;
  isVeloxis: boolean;
  onReload: () => void;
}

/**
 * Sanctions / PEP screening and EDD are now managed internally only.
 * The UI surface has been removed per product decision; the underlying
 * `exporters.sanctions_screening_status` / `edd_required` / `edd_completed`
 * columns are kept for backend reporting and Veloxis admin tooling.
 */
export default function ExporterComplianceSection(_props: Props) {
  return null;
}
