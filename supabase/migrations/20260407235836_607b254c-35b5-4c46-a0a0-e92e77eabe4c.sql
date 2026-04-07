-- Global pricing configuration (single-row)
CREATE TABLE public.pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_rate_pct numeric NOT NULL DEFAULT 80,
  platform_fee_pct numeric NOT NULL DEFAULT 1,
  discount_fee_pct_monthly numeric NOT NULL DEFAULT 2,
  late_penalty_rate_pct_daily numeric NOT NULL DEFAULT 0.067,
  min_payment_terms_days integer NOT NULL DEFAULT 30,
  max_payment_terms_days integer NOT NULL DEFAULT 90,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view pricing config"
  ON public.pricing_config FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Super admins can update pricing config"
  ON public.pricing_config FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Also allow exporters to read (for fee calculator)
CREATE POLICY "Authenticated users can view pricing config"
  ON public.pricing_config FOR SELECT
  TO authenticated
  USING (true);

-- Seed default row
INSERT INTO public.pricing_config (advance_rate_pct, platform_fee_pct, discount_fee_pct_monthly, late_penalty_rate_pct_daily, min_payment_terms_days, max_payment_terms_days)
VALUES (80, 1, 2, 0.067, 30, 90);

-- Pricing rate history (append-only audit)
CREATE TABLE public.pricing_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid NOT NULL REFERENCES public.users(id),
  field_name text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view rate history"
  ON public.pricing_rate_history FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Super admins can insert rate history"
  ON public.pricing_rate_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Block updates and deletes on rate history
CREATE TRIGGER prevent_rate_history_update
  BEFORE UPDATE ON public.pricing_rate_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_update();

CREATE TRIGGER prevent_rate_history_delete
  BEFORE DELETE ON public.pricing_rate_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_delete();

-- Add pricing snapshot columns to deals
ALTER TABLE public.deals
  ADD COLUMN snapshot_advance_rate_pct numeric,
  ADD COLUMN snapshot_platform_fee_pct numeric,
  ADD COLUMN snapshot_discount_fee_pct numeric,
  ADD COLUMN snapshot_late_penalty_rate_pct numeric,
  ADD COLUMN fee_acceptance_at timestamptz,
  ADD COLUMN fee_acceptance_by uuid REFERENCES public.users(id);

-- Create updated_at trigger for pricing_config
CREATE TRIGGER update_pricing_config_updated_at
  BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();