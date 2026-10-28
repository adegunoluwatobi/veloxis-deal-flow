import { z } from 'npm:zod@3.25.76';

export const PACK_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
export const canSendPack = (status: string) => status === 'active';
export const linkAvailable = (link: { revoked_at: string | null; expires_at: string; delivery_status: string }, now = Date.now()) =>
  link.delivery_status === 'sent' && link.revoked_at === null && Date.parse(link.expires_at) > now;
export const sendPackSchema = z.object({
  action: z.literal('send'), exporter_id: z.string().uuid(),
  to: z.array(z.string().trim().email()).min(1).max(50),
  cc: z.array(z.string().trim().email()).max(50).default([]),
  subject: z.string().trim().min(1).max(255).refine(v => !/[\r\n]/.test(v)),
  message: z.string().trim().min(1).max(10000),
  pack_type: z.enum(['full', 'summary']),
});