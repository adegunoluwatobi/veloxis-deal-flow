import { z } from 'npm:zod@3.25.76';

export { PACK_LIFETIME_SECONDS, canSendPack, linkAvailable } from './pack-lifecycle.ts';
export const sendPackSchema = z.object({
  action: z.literal('send'), exporter_id: z.string().uuid(),
  to: z.array(z.string().trim().email()).min(1).max(50),
  cc: z.array(z.string().trim().email()).max(50).default([]),
  subject: z.string().trim().min(1).max(255).refine(v => !/[\r\n]/.test(v)),
  message: z.string().trim().min(1).max(10000),
  pack_type: z.enum(['full', 'summary']),
});