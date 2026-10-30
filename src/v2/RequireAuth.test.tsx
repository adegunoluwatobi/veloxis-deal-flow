import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './RequireAuth';

vi.mock('./useAuth', () => ({ useAuth: () => ({
  user: { id: 'test-exporter' }, roles: ['exporter'], profile: { password_set_at: '2026-10-30' },
  exporterOnboarding: { onboarding_status: 'pending' }, ready: true, error: null,
}) }));
afterEach(cleanup);
describe('pending exporter access', () => {
  it('allows the full notification list before approval', () => {
    render(<MemoryRouter initialEntries={['/portal/notifications']}><Routes>
      <Route path="/portal/notifications" element={<RequireAuth allow="exporter"><div>Notification destination</div></RequireAuth>} />
      <Route path="/portal/onboarding" element={<div>Onboarding destination</div>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText('Notification destination')).toBeInTheDocument();
  });
  it('still blocks invoice access before approval', () => {
    render(<MemoryRouter initialEntries={['/portal/invoices']}><Routes>
      <Route path="/portal/invoices" element={<RequireAuth allow="exporter"><div>Invoice destination</div></RequireAuth>} />
      <Route path="/portal/onboarding" element={<div>Onboarding destination</div>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText('Onboarding destination')).toBeInTheDocument();
  });
});