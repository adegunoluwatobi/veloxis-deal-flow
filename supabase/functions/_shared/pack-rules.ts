import { z } from 'npm:zod@3.25.76';

export { PACK_LIFETIME_SECONDS, canSendPack, linkAvailable } from './pack-lifecycle.ts';
export const sendPackSchema = z.object({
  action: z.literal('send'), exporter_id: z.string().uuid(),
  to: z.array(z.string().trim().email()).length(1),
  cc: z.array(z.string()).max(0).default([]),
  subject: z.string().trim().min(1).max(255).refine(v => !/[\r\n]/.test(v)),
  message: z.string().trim().min(1).max(10000),
  pack_type: z.enum(['full', 'summary']),
});
export const createPackLinkSchema = z.object({
  action: z.literal('create_link'), exporter_id: z.string().uuid(), pack_type: z.literal('bundle'),
});