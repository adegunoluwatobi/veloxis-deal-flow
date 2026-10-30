import { describe, expect, it } from 'vitest';
import { packFormSchema, recipientList } from './packSharing';

const input = { to: ['reviewer@example.com'], cc: [], subject: 'KYB pack', message: 'Please review.', pack_type: 'full' };
describe('Pack recipients', () => {
  it('requires at least one To email', () => expect(packFormSchema.safeParse({ ...input, to: [] }).success).toBe(false));
  it('requires email addresses with @ and a domain', () => expect(packFormSchema.safeParse({ ...input, to: ['not-an-email'] }).success).toBe(false));
  it('rejects multiple To recipients', () => expect(packFormSchema.safeParse({ ...input, to: ['one@example.com', 'two@example.com'] }).success).toBe(false));
  it('accepts exactly one recipient without CC', () => expect(packFormSchema.parse(input).to).toEqual(['reviewer@example.com']));
  it('rejects CC even when the address is valid', () => expect(packFormSchema.safeParse({ ...input, cc: ['cc@example.com'] }).success).toBe(false));
  it('accepts full or summary only', () => {
    expect(packFormSchema.safeParse({ ...input, pack_type: 'summary' }).success).toBe(true);
    expect(packFormSchema.safeParse({ ...input, pack_type: 'zip' }).success).toBe(false);
  });
  it('parses multiple email separators', () => expect(recipientList('one@example.com; two@example.com,three@example.com')).toEqual(['one@example.com', 'two@example.com', 'three@example.com']));
});