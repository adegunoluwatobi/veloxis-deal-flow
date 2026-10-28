import { describe, it, expect } from 'vitest';
import { passwordError, effectiveStatus } from './kybInvite';

describe('KYB invite password rule', () => {
  it('rejects passwords under 10 characters', () => expect(passwordError('abc12345')).not.toBeNull());
  it('rejects passwords without a number', () => expect(passwordError('abcdefghijk')).not.toBeNull());
  it('rejects passwords without a letter', () => expect(passwordError('12345678901')).not.toBeNull());
  it('accepts 10+ chars with letter and number', () => expect(passwordError('abcdefghi1')).toBeNull());
});

describe('KYB invite status', () => {
  const past = '2020-01-01T00:00:00Z';
  const future = '2999-01-01T00:00:00Z';
  it('pending past expiry is expired', () => expect(effectiveStatus('pending', past)).toBe('expired'));
  it('opened past expiry is expired', () => expect(effectiveStatus('opened', past)).toBe('expired'));
  it('registered stays registered after expiry', () => expect(effectiveStatus('registered', past)).toBe('registered'));
  it('pending before expiry stays pending', () => expect(effectiveStatus('pending', future)).toBe('pending'));
});
