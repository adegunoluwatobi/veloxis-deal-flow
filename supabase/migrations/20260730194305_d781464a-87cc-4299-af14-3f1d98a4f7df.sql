-- =========================================================
-- 1. FREEZE MATURITY DATE
-- =========================================================
ALTER TABLE public.v2_invoices
  ADD COLUMN IF NOT EXISTS maturity_date_overridden_by uuid,
  ADD COLUMN IF NOT EXISTS maturity_date_overridden_at timestamptz,
  ADD COLUMN IF NOT EXISTS maturity_date_override_reason text;

CREATE OR REPLACE FUNCTION public.v2_invoice_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.fee_percent := CASE NEW.terms_days
    WHEN 30 THEN 3.5 WHEN 45 THEN 4.5 WHEN 60 THEN 5.5
    ELSE NEW.fee_percent END;

  -- Maturity is derived only while the application is still editable by the exporter.
  IF NEW.status::text IN ('draft','returned_for_revision') THEN
    IF NEW.shipment_date IS NOT NULL THEN
      NEW.maturity_date := NEW.shipment_date + (NEW.terms_days || ' days')::interval;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Frozen after submission: never recompute here.
    NEW.maturity_date := OLD.maturity_date;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_invoice_maturity_date(
  p_invoice_id uuid,
  p_new_maturity_date date,
  p_reason text
) RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old date;
  v_exporter uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.v2_can_review_documents(v_uid) THEN
    RAISE EXCEPTION 'Only Credit & Compliance reviewers may change the expected payment date'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_new_maturity_date IS NULL THEN
    RAISE EXCEPTION 'A new expected payment date is required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason is required to change the expected payment date'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT maturity_date, exporter_id INTO v_old, v_exporter
  FROM public.v2_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.v2_invoices
  SET maturity_date = p_new_maturity_date,
      maturity_date_overridden_by = v_uid,
      maturity_date_overridden_at = now(),
      maturity_date_override_reason = btrim(p_reason)
  WHERE id = p_invoice_id;

  INSERT INTO public.document_audit_log
    (entity_type, entity_id, invoice_id, exporter_id, action, actor_id, metadata)
  VALUES ('invoice', p_invoice_id, p_invoice_id, v_exporter, 'maturity_date_changed', v_uid,
          jsonb_build_object('from', v_old, 'to', p_new_maturity_date, 'reason', btrim(p_reason)));

  RETURN p_new_maturity_date;
END $$;

REVOKE ALL ON FUNCTION public.set_invoice_maturity_date(uuid, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_invoice_maturity_date(uuid, date, text) TO authenticated;

-- =========================================================
-- 2. BLOCK PLACEHOLDER FX
-- =========================================================
ALTER TABLE public.fx_rates
  ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false;

UPDATE public.fx_rates
SET is_placeholder = true
WHERE source ILIKE 'placeholder%';

CREATE OR REPLACE FUNCTION public.v2_stamp_invoice_fx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_cur text := NEW.invoice_currency::text;
  r RECORD;
BEGIN
  IF NEW.status::text = 'draft' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.fx_rate_to_gbp IS NOT NULL THEN
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

  SELECT f.rate, f.source, f.is_placeholder INTO r
  FROM public.fx_rates f
  WHERE f.from_currency = v_cur AND f.to_currency = 'GBP'
    AND f.effective_from <= now()
  ORDER BY f.effective_from DESC
  LIMIT 1;

  IF NOT FOUND OR r.is_placeholder THEN
    RAISE EXCEPTION 'We cannot accept this invoice until an exchange rate is set for %. Please contact Veloxis.', v_cur
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.fx_rate_to_gbp := r.rate;
  NEW.fx_rate_source := r.source;
  NEW.fx_rate_captured_at := now();
  RETURN NEW;
END $$;

-- =========================================================
-- 3. WORKING DAY CALENDAR
-- =========================================================
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'NG',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_holidays TO authenticated;
GRANT ALL ON public.public_holidays TO service_role;

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read public holidays"
ON public.public_holidays FOR SELECT TO authenticated
USING (public.is_v2_staff(auth.uid()));

CREATE POLICY "Super admins manage public holidays"
ON public.public_holidays FOR ALL TO authenticated
USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role))
WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));

CREATE TRIGGER trg_public_holidays_updated
BEFORE UPDATE ON public.public_holidays
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.public_holidays (holiday_date, name, jurisdiction) VALUES
  ('2026-01-01','New Year''s Day','NG'),
  ('2026-03-20','Eid al-Fitr','NG'),
  ('2026-03-23','Eid al-Fitr holiday','NG'),
  ('2026-04-03','Good Friday','NG'),
  ('2026-04-06','Easter Monday','NG'),
  ('2026-05-01','Workers'' Day','NG'),
  ('2026-05-27','Eid al-Adha','NG'),
  ('2026-05-28','Eid al-Adha holiday','NG'),
  ('2026-06-12','Democracy Day','NG'),
  ('2026-08-25','Eid al-Mawlid','NG'),
  ('2026-10-01','Independence Day','NG'),
  ('2026-12-25','Christmas Day','NG'),
  ('2026-12-26','Boxing Day','NG'),
  ('2027-01-01','New Year''s Day','NG'),
  ('2027-03-10','Eid al-Fitr','NG'),
  ('2027-03-11','Eid al-Fitr holiday','NG'),
  ('2027-03-26','Good Friday','NG'),
  ('2027-03-29','Easter Monday','NG'),
  ('2027-05-01','Workers'' Day','NG'),
  ('2027-05-17','Eid al-Adha','NG'),
  ('2027-05-18','Eid al-Adha holiday','NG'),
  ('2027-06-12','Democracy Day','NG'),
  ('2027-08-15','Eid al-Mawlid','NG'),
  ('2027-10-01','Independence Day','NG'),
  ('2027-12-25','Christmas Day','NG'),
  ('2027-12-27','Boxing Day (observed)','NG')
ON CONFLICT (holiday_date) DO NOTHING;

CREATE OR REPLACE FUNCTION public.add_working_days(p_from timestamptz, p_days integer)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ts timestamptz := p_from;
  v_added integer := 0;
  v_d date;
BEGIN
  IF p_days IS NULL OR p_days <= 0 THEN RETURN p_from; END IF;
  WHILE v_added < p_days LOOP
    v_ts := v_ts + interval '1 day';
    v_d := (v_ts AT TIME ZONE 'UTC')::date;
    CONTINUE WHEN EXTRACT(ISODOW FROM v_d) IN (6, 7);
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.public_holidays h
      WHERE h.holiday_date = v_d AND h.active
    );
    v_added := v_added + 1;
  END LOOP;
  RETURN v_ts;
END $$;

INSERT INTO public.v2_system_config (key, value)
VALUES ('decision_sla_working_days', '3'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- decision_due_at is set in working days at submission and never in calendar days.
CREATE OR REPLACE FUNCTION public.v2_set_decision_due_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days integer;
BEGIN
  IF NEW.status::text = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM 'submitted')
     AND NEW.decision_due_at IS NULL THEN
    SELECT COALESCE((SELECT value::text::integer FROM public.v2_system_config WHERE key = 'decision_sla_working_days'), 3)
      INTO v_days;
    NEW.decision_due_at := public.add_working_days(now(), v_days);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_set_decision_due_at ON public.v2_invoices;
CREATE TRIGGER trg_v2_set_decision_due_at
BEFORE INSERT OR UPDATE OF status ON public.v2_invoices
FOR EACH ROW EXECUTE FUNCTION public.v2_set_decision_due_at();