import { describe, expect, it } from 'vitest';
import { packPageLayout } from '../../../supabase/functions/_shared/pack-page-layout';

describe('original KYB attachment framing', () => {
  it('keeps a landscape director ID above the footer without distortion', () => {
    const frame = packPageLayout(612, 292);
    expect(frame.y).toBeGreaterThanOrEqual(50);
    expect(frame.width).toBe(555);
    expect(frame.width / frame.height).toBeCloseTo(612 / 292);
  });
  it('preserves a full portrait PDF within the A4 content area', () => {
    const frame = packPageLayout(595, 842);
    expect(frame.y).toBe(50);
    expect(frame.height).toBe(752);
    expect(frame.y + frame.height).toBe(802);
  });
});