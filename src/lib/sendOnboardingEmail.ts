import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-log helper for invoking send-transactional-email from the client.
 *
 * Email sending is best-effort: if the invoke fails we log to the console
 * but never throw, so the calling UI flow (e.g. a partner approval) is not
 * blocked by an email outage. The Edge Function itself is idempotent — the
 * same idempotencyKey will not produce duplicate sends.
 */
export async function sendOnboardingEmail(opts: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: opts.templateName,
        recipientEmail: opts.recipientEmail,
        idempotencyKey: opts.idempotencyKey,
        templateData: opts.templateData ?? {},
      },
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[email] ${opts.templateName} failed:`, error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[email] ${opts.templateName} threw:`, err);
  }
}

const APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ||
  'https://app.veloxis.co.uk';

export function appUrl(path: string = '/'): string {
  if (!path.startsWith('/')) path = '/' + path;
  return `${APP_URL.replace(/\/+$/, '')}${path}`;
}

/**
 * Resolve the partner organisation's notification email + name via the
 * `get_partner_admin_email` RPC. Returns null if no recipient is found.
 */
export async function resolvePartnerAdminRecipient(
  partnerOrganisationId: string | null | undefined,
): Promise<{ email: string; fullName: string } | null> {
  if (!partnerOrganisationId) return null;
  const { data, error } = await supabase.rpc('get_partner_admin_email' as any, {
    p_org_id: partnerOrganisationId,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.email) return null;
  return { email: row.email as string, fullName: (row.full_name as string) || '' };
}

export async function resolveAdminRecipient(): Promise<string> {
  const { data, error } = await supabase.rpc('get_notification_recipient_admin' as any);
  if (error || !data) return 'ops@veloxis.co.uk';
  return (data as string) || 'ops@veloxis.co.uk';
}
