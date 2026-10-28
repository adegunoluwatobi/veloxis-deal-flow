export const PASSWORD_RULE_TEXT = 'At least 10 characters, including a letter and a number.';

export function passwordError(pw: string): string | null {
  if (pw.length < 10) return 'Password must be at least 10 characters.';
  if (!/[A-Za-z]/.test(pw)) return 'Password must include at least one letter.';
  if (!/\d/.test(pw)) return 'Password must include at least one number.';
  return null;
}

export type KybInviteStatus = 'pending' | 'opened' | 'registered' | 'expired' | 'revoked';

/** Expired is derived: a pending/opened invite past its expiry. */
export function effectiveStatus(status: string, expiresAt: string, now = Date.now()): KybInviteStatus {
  if ((status === 'pending' || status === 'opened') && new Date(expiresAt).getTime() < now) return 'expired';
  return status as KybInviteStatus;
}

export const KYB_STATUS_LABEL: Record<KybInviteStatus, string> = {
  pending: 'Pending', opened: 'Opened', registered: 'Registered', expired: 'Expired', revoked: 'Revoked',
};
