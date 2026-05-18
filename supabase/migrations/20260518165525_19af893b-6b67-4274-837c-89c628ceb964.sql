
CREATE TABLE IF NOT EXISTS public.pricing_discount_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term_days INTEGER NOT NULL,
  discount_fee_pct NUMERIC NOT NULL,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE (term_days)
);

ALTER TABLE public.pricing_discount_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view discount tiers"
  ON public.pricing_discount_tiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can manage discount tiers"
  ON public.pricing_discount_tiers FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE TRIGGER update_pricing_discount_tiers_updated_at
  BEFORE UPDATE ON public.pricing_discount_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_discount_tiers (term_days, discount_fee_pct, label, sort_order) VALUES
  (30, 3.5, '30 days', 1),
  (60, 4.5, '60 days', 2),
  (90, 5.5, '90 days', 3)
ON CONFLICT (term_days) DO NOTHING;
