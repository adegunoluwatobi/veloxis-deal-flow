export const PACK_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
export const canSendPack = (status: string) => status === 'active';
export const linkAvailable = (link: { revoked_at: string | null; expires_at: string; delivery_status: string }, now = Date.now()) =>
  link.delivery_status === 'sent' && link.revoked_at === null && Date.parse(link.expires_at) > now;