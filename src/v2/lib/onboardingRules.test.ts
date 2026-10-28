import { describe, it, expect } from 'vitest';
import {
  rcError, issueDateError, ngPhoneError, nubanError, bvnError, ageError, idExpiryError,
  shareError, peopleListError, fileError, maskTail, wizardStatus, pastDateError,
} from './onboardingRules';

const today = new Date('2026-10-28T12:00:00Z');

describe('onboarding wizard rules', () => {
  it('RC number accepts digits with optional RC prefix', () => {
    expect(rcError('1234567')).toBeNull();
    expect(rcError('RC1234567')).toBeNull();
    expect(rcError('BN-12AB')).not.toBeNull();
  });
  it('incorporation date cannot be in the future', () => expect(pastDateError('2027-01-01', 'Date', today)).not.toBeNull());
  it('address proof older than 3 months is rejected', () => {
    expect(issueDateError('2026-07-01', today)).not.toBeNull();
    expect(issueDateError('2026-09-15', today)).toBeNull();
  });
  it('phone must be +234 format', () => {
    expect(ngPhoneError('+234 801 234 5678')).toBeNull();
    expect(ngPhoneError('08012345678')).not.toBeNull();
  });
  it('NUBAN is exactly 10 digits', () => { expect(nubanError('0123456789')).toBeNull(); expect(nubanError('012345678')).not.toBeNull(); });
  it('BVN is exactly 11 digits', () => { expect(bvnError('12345678901')).toBeNull(); expect(bvnError('1234567890')).not.toBeNull(); });
  it('person must be 18+', () => { expect(ageError('2010-01-01', today)).not.toBeNull(); expect(ageError('1990-01-01', today)).toBeNull(); });
  it('ID expiry required and not expired, except NIN', () => {
    expect(idExpiryError('International Passport', '2025-01-01', today)).not.toBeNull();
    expect(idExpiryError('International Passport', '', today)).not.toBeNull();
    expect(idExpiryError('National ID (NIN)', '', today)).toBeNull();
  });
  it('shareholding required for shareholders, 0-100', () => {
    expect(shareError('shareholder', '')).not.toBeNull();
    expect(shareError('both', 101)).not.toBeNull();
    expect(shareError('director', '')).toBeNull();
  });
  it('needs at least one director', () => expect(peopleListError([{ person_role: 'shareholder', shareholding_pct: 50 }])).not.toBeNull());
  it('total shareholding cannot exceed 100%', () => {
    expect(peopleListError([{ person_role: 'both', shareholding_pct: 60 }, { person_role: 'shareholder', shareholding_pct: 50 }])).not.toBeNull();
    expect(peopleListError([{ person_role: 'both', shareholding_pct: 60 }, { person_role: 'shareholder', shareholding_pct: 40 }])).toBeNull();
  });
  it('uploads limited to PDF/JPG/PNG up to 10MB; photo JPG/PNG only', () => {
    const mk = (type: string, size: number) => ({ type, size } as File);
    expect(fileError(mk('application/pdf', 1000))).toBeNull();
    expect(fileError(mk('application/msword', 1000))).not.toBeNull();
    expect(fileError(mk('application/pdf', 11 * 1024 * 1024))).not.toBeNull();
    expect(fileError(mk('application/pdf', 1000), { photoOnly: true })).not.toBeNull();
  });
  it('masks to last 4 digits', () => expect(maskTail('12345678901').endsWith('8901')).toBe(true));
  it('status mapping', () => {
    expect(wizardStatus(null)).toBe('draft');
    expect(wizardStatus({ onboarding_submitted_at: '2026-10-01' })).toBe('submitted');
    expect(wizardStatus({ onboarding_submitted_at: '2026-10-01', bd_approved_at: '2026-10-02' })).toBe('under_review');
    expect(wizardStatus({ onboarding_submitted_at: '2026-10-01', bd_rejected_at: '2026-10-03' })).toBe('more_info');
    expect(wizardStatus({ onboarding_status: 'active' })).toBe('approved');
  });
});
