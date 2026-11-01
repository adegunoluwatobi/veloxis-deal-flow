import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('drizzle/migrations/0007_allow_onboarding_review_notifications.sql', 'utf8');
const allowedTypes = [...sql.matchAll(/'([a-z_]+)'::text/g)].map((match) => match[1]);

describe('submission notification constraint', () => {
  it('accepts the onboarding_review type emitted during final submission', () => {
    expect(allowedTypes.includes('onboarding_review')).toBe(true);
  });

  it.each(['info', 'success', 'warning', 'action_required'])('keeps existing %s notifications valid', (type) => {
    expect(allowedTypes.includes(type)).toBe(true);
  });
});