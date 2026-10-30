import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync('drizzle/migrations/0006_exporter_submission_alerts.sql', 'utf8');

describe('onboarding submission alert rules', () => {
  it('only triggers when a non-null submission timestamp changes', () => {
    expect(migration).toContain('p_new IS NOT NULL AND p_old IS DISTINCT FROM p_new');
  });
  it('limits Business Developer alerts to accessible exporters', () => {
    expect(migration).toContain("r.role::text='originator' AND public.v2_can_view_exporter(r.user_id,NEW.id)");
  });
  it('deduplicates reviewer accounts with multiple roles', () => {
    expect(migration).toContain('SELECT DISTINCT r.user_id');
  });
  it('includes Credit Officers and Super Admins', () => {
    expect(migration).toContain("r.role::text IN ('credit_officer','super_admin')");
  });
});