
-- Sequence for tranche references
CREATE SEQUENCE IF NOT EXISTS public.tranche_reference_seq START 1;

-- Capital tranches table
CREATE TABLE public.capital_tranches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL,
  source_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date_received DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.capital_tranches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to capital tranches"
  ON public.capital_tranches FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Deal managers can view capital tranches"
  ON public.capital_tranches FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'deal_manager'));

-- Capital pool history table
CREATE TABLE public.capital_pool_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL, -- 'manual_update' or 'tranche_added'
  amount_change NUMERIC NOT NULL,
  new_total NUMERIC NOT NULL,
  actor_id UUID NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.capital_pool_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to capital pool history"
  ON public.capital_pool_history FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Deal managers can view capital pool history"
  ON public.capital_pool_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'deal_manager'));

-- Prevent updates/deletes on pool history (append-only)
CREATE OR REPLACE FUNCTION public.prevent_pool_history_modify()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Capital pool history cannot be modified';
END;
$$;

CREATE TRIGGER prevent_pool_history_update
  BEFORE UPDATE ON public.capital_pool_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_pool_history_modify();

CREATE TRIGGER prevent_pool_history_delete
  BEFORE DELETE ON public.capital_pool_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_pool_history_modify();

-- Auto-generate tranche reference
CREATE OR REPLACE FUNCTION public.generate_tranche_reference()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'TRN-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('public.tranche_reference_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_tranche_ref
  BEFORE INSERT ON public.capital_tranches
  FOR EACH ROW EXECUTE FUNCTION public.generate_tranche_reference();

-- Add columns to partner_organisations
ALTER TABLE public.partner_organisations
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Nigeria',
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspended_by UUID,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
