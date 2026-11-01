export const PACK_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
export const canSendPack = (status: string) => status === 'active';
export const packDownloadFormat = (packType: string) => packType === 'bundle'
  ? { extension: 'zip', contentType: 'application/zip', filename: 'Exporter_KYB_Full_Pack.zip' }
  : { extension: 'pdf', contentType: 'application/pdf', filename: 'Exporter_KYB_Pack.pdf' };
export const linkAvailable = (link: { revoked_at: string | null; expires_at: string; delivery_status: string }, now = Date.now()) =>
  ['sent', 'ready'].includes(link.delivery_status) && link.revoked_at === null && Date.parse(link.expires_at) > now;