import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OnboardInvite from './OnboardInvite';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), signIn: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: mocks.invoke }, auth: { signInWithPassword: mocks.signIn },
} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('confirmed invite registration', () => {
  it.each([false, true])('signs in and opens onboarding, existing account: %s', async (existing) => {
    mocks.invoke.mockResolvedValueOnce({ data: { valid: true, email: 'invited@example.com', company_name: 'Test Company' } })
      .mockResolvedValueOnce({ data: { success: true, email: 'invited@example.com', existing_account: existing } });
    mocks.signIn.mockResolvedValue({ error: null });
    render(<MemoryRouter initialEntries={['/onboard/test-token']}><Routes>
      <Route path="/onboard/:token" element={<OnboardInvite />} />
      <Route path="/portal/onboarding" element={<div>Onboarding destination</div>} />
    </Routes></MemoryRouter>);
    await screen.findByLabelText('Password');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPassword123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'TestPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith({ email: 'invited@example.com', password: 'TestPassword123' }));
    await screen.findByText('Onboarding destination');
    expect(mocks.invoke).toHaveBeenLastCalledWith('register-with-invite', { body: { token: 'test-token', password: 'TestPassword123' } });
  });
});