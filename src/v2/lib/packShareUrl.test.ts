import { describe, expect, it } from 'vitest';
import { packShareUrl } from '../../../supabase/functions/_shared/pack-share-url';

describe('Confidential social share links', () => {
  it('keeps the confidential token in the fragment, not the crawler request', () => {
    const token = 'a'.repeat(64);
    const url = new URL(packShareUrl(token));
    expect(url.origin).toBe('https://app.veloxis.co.uk');
    expect(url.pathname).toBe('/pack-share.html');
    expect(url.search).toBe('');
    expect(url.hash).toBe(`#token=${token}`);
  });
  it('rejects malformed tokens', () => {
    expect(() => packShareUrl('invalid')).toThrow('Invalid pack token');
  });
});