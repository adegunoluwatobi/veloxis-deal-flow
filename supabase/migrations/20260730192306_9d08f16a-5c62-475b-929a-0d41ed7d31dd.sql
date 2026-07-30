-- 1. FX RATES
CREATE TABLE public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL CHECK (rate > 0),
  source text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  captured_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fx_rates_pair ON public.fx_rates (from_currency, to_currency, effective_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal roles read fx rates" ON public.fx_rates
  FOR SELECT TO authenticated USING (public.is_v2_staff(auth.uid()));
CREATE POLICY "Super admin writes fx rates" ON public.fx_rates
  FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role))
  WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));

-- 2. CONFIG TABLE (legacy public.system_config already exists with a different shape,
--    so the v2 config store is namespaced)
CREATE TABLE public.v2_system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_system_config TO authenticated;
GRANT ALL ON public.v2_system_config TO service_role;
ALTER TABLE public.v2_system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal roles read config" ON public.v2_system_config
  FOR SELECT TO authenticated USING (public.is_v2_staff(auth.uid()));
CREATE POLICY "Exporters read config" ON public.v2_system_config
  FOR SELECT TO authenticated USING (public.has_app_role(auth.uid(), 'exporter'::public.v2_app_role));
CREATE POLICY "Super admin writes config" ON public.v2_system_config
  FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role))
  WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));

CREATE TRIGGER trg_v2_system_config_updated_at BEFORE UPDATE ON public.v2_system_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.v2_system_config (key, value, description)
VALUES ('advance_rate', '0.80'::jsonb, 'Fraction of net invoice value advanced at funding');

CREATE OR REPLACE FUNCTION public.v2_advance_rate()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE((SELECT value::text::numeric FROM public.v2_system_config WHERE key='advance_rate'), 0.80) $$;

-- 3. INVOICE STATUS LADDER + MATURITY FIELDS
ALTER TYPE public.v2_invoice_status ADD VALUE IF NOT EXISTS 'overdue';
ALTER TYPE public.v2_invoice_status ADD VALUE IF NOT EXISTS 'in_recovery';
ALTER TYPE public.v2_invoice_status ADD VALUE IF NOT EXISTS 'written_off';

ALTER TABLE public.v2_invoices
  ADD COLUMN IF NOT EXISTS days_past_maturity integer,
  ADD COLUMN IF NOT EXISTS escalation_stage text;

CREATE OR REPLACE FUNCTION public.v2_invoice_maturity_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.maturity_date IS NOT NULL THEN
    NEW.days_past_maturity := GREATEST(0, (CURRENT_DATE - NEW.maturity_date)::int);
  ELSE
    NEW.days_past_maturity := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_invoice_maturity_fields ON public.v2_invoices;
CREATE TRIGGER trg_v2_invoice_maturity_fields
  BEFORE INSERT OR UPDATE ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.v2_invoice_maturity_fields();

-- 4. FX STAMPING AT SUBMISSION (write-once)
CREATE OR REPLACE FUNCTION public.v2_stamp_invoice_fx()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE
  v_cur text := NEW.invoice_currency::text;
  r RECORD;
BEGIN
  IF NEW.status::text = 'draft' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.fx_rate_to_gbp IS NOT NULL THEN
    -- write-once: never recompute
    NEW.fx_rate_to_gbp := OLD.fx_rate_to_gbp;
    NEW.fx_rate_captured_at := OLD.fx_rate_captured_at;
    NEW.fx_rate_source := OLD.fx_rate_source;
    RETURN NEW;
  END IF;
  IF NEW.fx_rate_to_gbp IS NOT NULL THEN RETURN NEW; END IF;

  IF v_cur = 'GBP' THEN
    NEW.fx_rate_to_gbp := 1.0;
    NEW.fx_rate_source := 'par';
    NEW.fx_rate_captured_at := now();
    RETURN NEW;
  END IF;

  SELECT f.rate, f.source INTO r
  FROM public.fx_rates f
  WHERE f.from_currency = v_cur AND f.to_currency = 'GBP'
    AND f.effective_from <= now()
  ORDER BY f.effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'We cannot accept this invoice until an exchange rate is set for %. Please contact Veloxis.', v_cur
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.fx_rate_to_gbp := r.rate;
  NEW.fx_rate_source := r.source;
  NEW.fx_rate_captured_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_stamp_invoice_fx ON public.v2_invoices;
CREATE TRIGGER trg_v2_stamp_invoice_fx
  BEFORE INSERT OR UPDATE ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.v2_stamp_invoice_fx();

-- 5. HEADROOM: config-driven advance rate + extended live statuses
CREATE OR REPLACE FUNCTION public.exporter_headroom(p_exporter_id uuid)
 RETURNS TABLE(authorised_limit numeric, limit_currency text, limit_basis text, committed_exposure numeric, headroom numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  inv RECORD;
  v_total numeric := 0;
  v_base numeric;
  v_advance numeric := public.v2_advance_rate();
BEGIN
  SELECT br.authorised_limit, br.limit_currency, br.limit_basis
    INTO r
  FROM public.board_resolutions br
  WHERE br.exporter_id = p_exporter_id
    AND br.superseded_by IS NULL
    AND br.verification_status = 'verified'
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  FOR inv IN
    SELECT i.id, i.reference, i.invoice_currency::text AS cur,
           COALESCE(i.gross_invoice_value, i.invoice_amount, 0) AS gross,
           COALESCE(i.agreed_deductions, 0) AS deductions,
           i.fx_rate_to_gbp
    FROM public.v2_invoices i
    WHERE i.exporter_id = p_exporter_id
      AND i.status::text IN ('submitted','verified','approved','funded','monitoring',
                             'overdue','in_recovery','defaulted','written_off')
  LOOP
    v_base := inv.gross - inv.deductions;
    IF r.limit_basis = 'advance_outstanding' THEN
      v_base := v_base * v_advance;
    END IF;

    IF inv.cur = r.limit_currency THEN
      v_total := v_total + v_base;
    ELSE
      IF inv.fx_rate_to_gbp IS NULL THEN
        RAISE EXCEPTION 'Invoice % has no stored FX rate; headroom cannot be computed', COALESCE(inv.reference, inv.id::text)
          USING ERRCODE = 'data_exception';
      END IF;
      IF r.limit_currency <> 'GBP' THEN
        RAISE EXCEPTION 'Invoice % is in % but the authorised limit is in %; no stored rate for that pair',
          COALESCE(inv.reference, inv.id::text), inv.cur, r.limit_currency
          USING ERRCODE = 'data_exception';
      END IF;
      v_total := v_total + (v_base * inv.fx_rate_to_gbp);
    END IF;
  END LOOP;

  RETURN QUERY SELECT r.authorised_limit, r.limit_currency, r.limit_basis, v_total, r.authorised_limit - v_total;
END $function$;

ALTER TABLE public.v2_invoices ALTER COLUMN advance_rate SET DEFAULT 80;