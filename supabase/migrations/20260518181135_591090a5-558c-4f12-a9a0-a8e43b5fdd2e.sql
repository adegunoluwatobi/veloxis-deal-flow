ALTER TABLE public.pricing_discount_tiers
  ADD COLUMN IF NOT EXISTS platform_fee_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_penalty_rate_pct_daily numeric NOT NULL DEFAULT 0;