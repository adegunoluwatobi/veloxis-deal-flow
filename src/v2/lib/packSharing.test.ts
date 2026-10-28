import { describe, expect, it } from 'vitest';
import { packFormSchema, recipientList } from './packSharing';

const input = { to: ['reviewer@example.com'], cc: [], subject: 'KYB pack', message: 'Please review.', pack_type: 'full' };
describe('Pack recipients', () => {
  it('requires at least one To email', () => expect(packFormSchema.safeParse({ ...input, to: [] }).success).toBe(false));
  it('requires email addresses with @ and a domain', () => expect(packFormSchema.safeParse({ ...input, to: ['not-an-email'] }).success).toBe(false));
  it('allows multiple To recipients', () => expect(packFormSchema.parse({ ...input, to: ['one@example.com', 'two@example.com'] }).to).toHaveLength(2));
  it('allows optional CC', () => expect(packFormSchema.parse(input).cc).toEqual([]));
  it('validates CC addresses', () => expect(packFormSchema.safeParse({ ...input, cc: ['invalid'] }).success).toBe(false));
  it('accepts full or summary only', () => {
    expect(packFormSchema.safeParse({ ...input, pack_type: 'summary' }).success).toBe(true);
    expect(packFormSchema.safeParse({ ...input, pack_type: 'zip' }).success).toBe(false);
  });
  it('parses multiple email separators', () => expect(recipientList('one@example.com; two@example.com,three@example.com')).toEqual(['one@example.com', 'two@example.com', 'three@example.com']));
});