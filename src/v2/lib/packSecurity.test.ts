import { describe, expect, it } from 'vitest';
import { canSendPack, linkAvailable, PACK_LIFETIME_SECONDS } from '../../../supabase/functions/_shared/pack-lifecycle';

describe('Pack security rules', () => {
  it('only permits approved applications', () => {
    expect(canSendPack('active')).toBe(true);
    for (const status of ['pending', 'suspended', 'rejected', 'draft']) expect(canSendPack(status)).toBe(false);
  });
  it('expires after exactly seven days', () => expect(PACK_LIFETIME_SECONDS).toBe(604800));
  it('revocation immediately blocks a previously valid link', () => {
    const link = { revoked_at: null, expires_at: '2026-11-04T12:00:00Z', delivery_status: 'sent' };
    expect(linkAvailable(link, Date.parse('2026-10-28T12:00:00Z'))).toBe(true);
    expect(linkAvailable({ ...link, revoked_at: '2026-10-28T12:00:00Z' }, Date.parse('2026-10-28T12:00:00Z'))).toBe(false);
  });
  it('blocks links at expiry', () => expect(linkAvailable({ revoked_at: null, expires_at: '2026-11-04T12:00:00Z', delivery_status: 'sent' }, Date.parse('2026-11-04T12:00:00Z'))).toBe(false));
  it('does not activate unsent or failed links', () => {
    for (const status of ['pending', 'failed']) expect(linkAvailable({ revoked_at: null, expires_at: '2026-11-04T12:00:00Z', delivery_status: status }, Date.parse('2026-10-28T12:00:00Z'))).toBe(false);
  });
});