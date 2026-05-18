// Display helpers for verification statuses.
export type ProviderStatus = 'not_started' | 'submitted' | 'provider_pending' | 'provider_verified' | 'provider_failed' | 'action_required';
export type ReviewStatus = 'not_started' | 'under_review' | 'approved' | 'rejected' | 'action_required';
export type AccessStatus = 'access_locked' | 'access_unlocked' | 'manually_checked';

const TONE = {
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  warn: 'bg-amber-100 text-amber-800 border-amber-300',
  bad: 'bg-red-100 text-red-800 border-red-300',
  neutral: 'bg-slate-100 text-slate-800 border-slate-300',
  info: 'bg-blue-100 text-blue-800 border-blue-300',
} as const;

export function providerStatusLabel(s: string) {
  return ({
    not_started: 'Not started',
    submitted: 'Submitted',
    provider_pending: 'Provider pending',
    provider_verified: 'Provider verified',
    provider_failed: 'Provider failed',
    action_required: 'Action required',
  } as Record<string, string>)[s] ?? s;
}

export function providerStatusTone(s: string): string {
  if (s === 'provider_verified') return TONE.ok;
  if (s === 'provider_failed') return TONE.bad;
  if (s === 'action_required') return TONE.warn;
  if (s === 'provider_pending' || s === 'submitted') return TONE.info;
  return TONE.neutral;
}

export function reviewStatusLabel(s: string) {
  return ({
    not_started: 'Not started',
    under_review: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected',
    action_required: 'Action required',
  } as Record<string, string>)[s] ?? s;
}

export function reviewStatusTone(s: string): string {
  if (s === 'approved') return TONE.ok;
  if (s === 'rejected') return TONE.bad;
  if (s === 'action_required') return TONE.warn;
  if (s === 'under_review') return TONE.info;
  return TONE.neutral;
}

export function accessStatusLabel(s: string) {
  return ({
    access_locked: 'Access locked',
    access_unlocked: 'Access unlocked',
    manually_checked: 'Manually checked',
  } as Record<string, string>)[s] ?? s;
}

export function accessStatusTone(s: string): string {
  if (s === 'access_unlocked') return TONE.ok;
  if (s === 'manually_checked') return TONE.warn;
  return TONE.neutral;
}

// Safe (exporter-facing) display from internal job
export function safeDisplayStatus(j: { final_access_status: string; provider_status: string; partner_review_status: string; super_admin_review_status: string }) {
  if (j.final_access_status === 'access_unlocked') return 'Verified';
  if (j.provider_status === 'provider_failed' || j.partner_review_status === 'rejected' || j.super_admin_review_status === 'rejected') return 'Rejected';
  if (j.provider_status === 'action_required' || j.partner_review_status === 'action_required' || j.super_admin_review_status === 'action_required') return 'Action Required';
  return 'Under Review';
}
