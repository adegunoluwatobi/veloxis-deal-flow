import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Status = Database['public']['Enums']['v2_invoice_status'];

export async function logAudit(params: {
  invoice_id?: string | null;
  action: string;
  from_status?: Status | null;
  to_status?: Status | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('v2_audit_log').insert({
    invoice_id: params.invoice_id ?? null,
    actor_user_id: user.id,
    action: params.action,
    from_status: params.from_status ?? null,
    to_status: params.to_status ?? null,
    note: params.note ?? null,
    metadata: (params.metadata ?? {}) as any,
  });
}
