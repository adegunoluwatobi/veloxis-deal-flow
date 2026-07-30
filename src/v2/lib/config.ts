import { supabase } from '@/integrations/supabase/client';

const DEFAULT_ADVANCE_RATE = 0.8;
let cached: number | null = null;

/** Advance rate as a fraction (e.g. 0.80), read from v2_system_config. */
export async function getAdvanceRate(): Promise<number> {
  if (cached !== null) return cached;
  const { data } = await supabase
    .from('v2_system_config')
    .select('value')
    .eq('key', 'advance_rate')
    .maybeSingle();
  const parsed = Number(data?.value);
  cached = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ADVANCE_RATE;
  return cached;
}

/** Advance rate as a percentage (e.g. 80). */
export async function getAdvanceRatePct(): Promise<number> {
  return (await getAdvanceRate()) * 100;
}
