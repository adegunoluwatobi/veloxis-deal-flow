import { describe, it, expect } from 'vitest';
import { computeOnboardingLock } from './onboardingLock';

const T0 = '2026-08-20T10:00:00.000Z'; // first submission
const T1 = '2026-08-21T10:00:00.000Z'; // return by reviewer
const T2 = '2026-08-22T10:00:00.000Z'; // resubmission

describe('onboarding lock lifecycle', () => {
  it('is unlocked for a brand new exporter', () => {
    const s = computeOnboardingLock({ onboarding_status: 'pending' });
    expect(s.formLocked).toBe(false);
    expect(s.submitted).toBe(false);
    expect(s.bdRejected).toBe(false);
  });

  it('is unlocked when nothing has been saved yet (null record)', () => {
    expect(computeOnboardingLock(null).formLocked).toBe(false);
  });

  it('locks once submitted and awaiting Business Developer review', () => {
    const s = computeOnboardingLock({
      onboarding_status: 'pending',
      onboarding_submitted_at: T0,
    });
    expect(s.formLocked).toBe(true);
    expect(s.bdApproved).toBe(false);
  });

  it('stays locked after BD approval while Credit & Compliance reviews', () => {
    const s = computeOnboardingLock({
      onboarding_status: 'pending',
      onboarding_submitted_at: T0,
      bd_approved_at: T1,
    });
    expect(s.formLocked).toBe(true);
    expect(s.bdApproved).toBe(true);
  });

  it('unlocks when returned to the exporter after submission', () => {
    const s = computeOnboardingLock({
      onboarding_status: 'pending',
      onboarding_submitted_at: T0,
      bd_rejected_at: T1,
    });
    expect(s.bdRejected).toBe(true);
    expect(s.formLocked).toBe(false);
  });

  it('re-locks on resubmission even if the old rejection timestamp is still present', () => {
    const s = computeOnboardingLock({
      onboarding_status: 'pending',
      onboarding_submitted_at: T2,
      bd_rejected_at: T1,
    });
    expect(s.bdRejected).toBe(false);
    expect(s.formLocked).toBe(true);
  });

  it('re-locks on resubmission when the rejection fields were cleared', () => {
    const s = computeOnboardingLock({
      onboarding_status: 'pending',
      onboarding_submitted_at: T2,
      bd_rejected_at: null,
    });
    expect(s.formLocked).toBe(true);
  });

  it('unlocks again on a second rejection after the resubmission', () => {
    const s = computeOnboardingLock({
      onboarding_status: 'pending',
      onboarding_submitted_at: T2,
      bd_rejected_at: '2026-08-23T10:00:00.000Z',
    });
    expect(s.bdRejected).toBe(true);
    expect(s.formLocked).toBe(false);
  });

  it('treats a rejection with no submission on record as open', () => {
    const s = computeOnboardingLock({ onboarding_status: 'pending', bd_rejected_at: T1 });
    expect(s.bdRejected).toBe(true);
    expect(s.formLocked).toBe(false);
  });

  it('locks permanently once the exporter is active, even with a stale rejection', () => {
    const s = computeOnboardingLock({
      onboarding_status: 'active',
      onboarding_submitted_at: T0,
      bd_rejected_at: T1,
    });
    expect(s.isActive).toBe(true);
    expect(s.formLocked).toBe(true);
  });

  it('full lifecycle: submit -> return -> resubmit -> approve', () => {
    const steps = [
      { input: { onboarding_status: 'pending' }, locked: false },
      { input: { onboarding_status: 'pending', onboarding_submitted_at: T0 }, locked: true },
      { input: { onboarding_status: 'pending', onboarding_submitted_at: T0, bd_rejected_at: T1 }, locked: false },
      { input: { onboarding_status: 'pending', onboarding_submitted_at: T2 }, locked: true },
      { input: { onboarding_status: 'active', onboarding_submitted_at: T2, bd_approved_at: T2 }, locked: true },
    ];
    expect(steps.map((s) => computeOnboardingLock(s.input).formLocked)).toEqual(
      steps.map((s) => s.locked),
    );
  });
});
