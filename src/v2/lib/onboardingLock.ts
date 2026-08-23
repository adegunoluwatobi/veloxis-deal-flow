export type OnboardingLockInput = {
  onboarding_status?: string | null;
  onboarding_submitted_at?: string | null;
  bd_approved_at?: string | null;
  bd_rejected_at?: string | null;
} | null | undefined;

export type OnboardingLockState = {
  status: string;
  submitted: boolean;
  bdApproved: boolean;
  /** A return is only "open" if it happened after the latest submission. */
  bdRejected: boolean;
  isActive: boolean;
  /** True when the exporter may not edit the onboarding form. */
  formLocked: boolean;
};

export function computeOnboardingLock(exp: OnboardingLockInput): OnboardingLockState {
  const status = exp?.onboarding_status ?? 'pending';
  const submittedAt = exp?.onboarding_submitted_at ?? null;
  const rejectedAt = exp?.bd_rejected_at ?? null;

  const submitted = !!submittedAt;
  const bdApproved = !!exp?.bd_approved_at;
  const isActive = status === 'active';

  const bdRejected =
    !!rejectedAt &&
    (!submittedAt || new Date(rejectedAt).getTime() > new Date(submittedAt).getTime());

  const formLocked = isActive || (submitted && !bdRejected);

  return { status, submitted, bdApproved, bdRejected, isActive, formLocked };
}
