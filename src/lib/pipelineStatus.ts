// Single source of truth for the exporter Registration Pipeline status.
// Mirrors the public.pipeline_status enum in the database.

export type PipelineStatus =
  | 'invited'
  | 'onboarding_started'
  | 'pending_documents'
  | 'under_review'
  | 'pending_veloxis'
  | 'routed'
  | 'approved'
  | 'rejected'
  | 'expansion';

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  invited: 'Invited',
  onboarding_started: 'Onboarding Started',
  pending_documents: 'Pending Documents',
  under_review: 'Under Review',
  pending_veloxis: 'Pending Veloxis',
  routed: 'Routed',
  approved: 'Approved',
  rejected: 'Rejected',
  expansion: 'Expansion',
};

// Tailwind classes following the spec's colour taxonomy.
// Uses semantic + utility classes that read on both light and dark surfaces.
export const PIPELINE_STATUS_BADGE_CLASS: Record<PipelineStatus, string> = {
  invited: 'bg-muted text-muted-foreground border-border',
  onboarding_started: 'bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-300',
  pending_documents: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  under_review: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  pending_veloxis: 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300',
  routed: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300',
  approved: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  expansion: 'bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300',
};

export function pipelineStatusLabel(s: string | null | undefined): string {
  if (!s) return '—';
  return PIPELINE_STATUS_LABELS[s as PipelineStatus] ?? s;
}

export function pipelineStatusBadgeClass(s: string | null | undefined): string {
  if (!s) return PIPELINE_STATUS_BADGE_CLASS.invited;
  return PIPELINE_STATUS_BADGE_CLASS[s as PipelineStatus] ?? PIPELINE_STATUS_BADGE_CLASS.invited;
}

// Defensive check: pipeline status of "routed" requires a partner. The DB
// trigger downgrades these to pending_veloxis, but UIs may join legacy data
// where the pipeline_status column hasn't been refreshed.
export function isRoutedDataInconsistent(args: {
  pipeline_status?: string | null;
  assigned_partner_id?: string | null;
  originator_id?: string | null;
}): boolean {
  return args.pipeline_status === 'routed' && !args.assigned_partner_id && !args.originator_id;
}
