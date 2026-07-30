-- 1. DAYS PAST MATURITY -> view
DROP TRIGGER IF EXISTS v2_invoice_maturity_fields_trg ON public.v2_invoices;
DROP TRIGGER IF EXISTS trg_v2_invoice_maturity_fields ON public.v2_invoices;
DROP FUNCTION IF EXISTS public.v2_invoice_maturity_fields() CASCADE;
ALTER TABLE public.v2_invoices DROP COLUMN IF EXISTS days_past_maturity;

CREATE OR REPLACE VIEW public.v2_invoices_with_ageing
WITH (security_invoker = on) AS
SELECT i.*,
  CASE
    WHEN i.maturity_date IS NOT NULL
     AND i.status::text NOT IN ('settled','rejected','draft','returned_for_revision')
    THEN GREATEST(0, (CURRENT_DATE - i.maturity_date)::int)
    ELSE 0
  END AS days_past_maturity
FROM public.v2_invoices i;

GRANT SELECT ON public.v2_invoices_with_ageing TO authenticated;
GRANT ALL ON public.v2_invoices_with_ageing TO service_role;

-- 2. ESCALATION LADDER
ALTER TABLE public.document_audit_log DROP CONSTRAINT IF EXISTS document_audit_log_action_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_action_check
  CHECK (action = ANY (ARRAY['uploaded','replaced','verified','rejected','requested','fulfilled','withdrawn','expired','override_applied','viewed','created','updated','superseded','reference_data_changed','escalation_advanced']));
ALTER TABLE public.document_audit_log DROP CONSTRAINT IF EXISTS document_audit_log_entity_type_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_entity_type_check
  CHECK (entity_type = ANY (ARRAY['invoice_document','company_document','document_request','board_resolution','document_type','commodity','regulated_commodity','system_config','invoice']));

CREATE OR REPLACE FUNCTION public.advance_escalation_ladder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv RECORD;
  v_days int;
  v_new_stage text;
  v_new_status text;
  v_rank_old int;
  v_rank_new int;
BEGIN
  FOR inv IN
    SELECT id, exporter_id, status::text AS status, escalation_stage, maturity_date
    FROM public.v2_invoices
    WHERE maturity_date IS NOT NULL
      AND maturity_date < CURRENT_DATE
      AND status::text IN ('funded','monitoring','overdue')
  LOOP
    v_days := (CURRENT_DATE - inv.maturity_date)::int;

    v_new_stage := CASE
      WHEN v_days >= 30 THEN 'counsel_instructed'
      WHEN v_days >= 14 THEN 'demand_issued'
      WHEN v_days >= 7  THEN 'ap_contacted'
      WHEN v_days >= 3  THEN 'reminder_sent'
      ELSE NULL END;

    v_new_status := CASE
      WHEN v_days >= 30 THEN 'in_recovery'
      WHEN inv.status IN ('funded','monitoring') THEN 'overdue'
      ELSE NULL END;

    v_rank_old := CASE COALESCE(inv.escalation_stage,'')
      WHEN 'counsel_instructed' THEN 4 WHEN 'demand_issued' THEN 3
      WHEN 'ap_contacted' THEN 2 WHEN 'reminder_sent' THEN 1 ELSE 0 END;
    v_rank_new := CASE COALESCE(v_new_stage,'')
      WHEN 'counsel_instructed' THEN 4 WHEN 'demand_issued' THEN 3
      WHEN 'ap_contacted' THEN 2 WHEN 'reminder_sent' THEN 1 ELSE 0 END;

    IF v_rank_new <= v_rank_old THEN v_new_stage := NULL; END IF;
    IF v_new_status IS NOT NULL AND v_new_status = inv.status THEN v_new_status := NULL; END IF;

    IF v_new_stage IS NULL AND v_new_status IS NULL THEN CONTINUE; END IF;

    UPDATE public.v2_invoices
    SET escalation_stage = COALESCE(v_new_stage, escalation_stage),
        status = COALESCE(v_new_status::public.v2_invoice_status, status)
    WHERE id = inv.id;

    INSERT INTO public.document_audit_log (entity_type, entity_id, invoice_id, exporter_id, action, actor_id, metadata)
    VALUES ('invoice', inv.id, inv.id, inv.exporter_id, 'escalation_advanced', NULL,
      jsonb_build_object(
        'days_past_maturity', v_days,
        'from_stage', inv.escalation_stage,
        'to_stage', COALESCE(v_new_stage, inv.escalation_stage),
        'from_status', inv.status,
        'to_status', COALESCE(v_new_status, inv.status)));
  END LOOP;
END $$;

SELECT cron.unschedule('advance-escalation-ladder')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'advance-escalation-ladder');

SELECT cron.schedule('advance-escalation-ladder', '15 2 * * *', $cron$ SELECT public.advance_escalation_ladder(); $cron$);

-- 3. FX placeholder seeds
INSERT INTO public.fx_rates (from_currency, to_currency, rate, source, effective_from)
SELECT 'USD','GBP',0.79,'placeholder, replace before first live invoice', now()
WHERE NOT EXISTS (SELECT 1 FROM public.fx_rates WHERE from_currency='USD' AND to_currency='GBP');
INSERT INTO public.fx_rates (from_currency, to_currency, rate, source, effective_from)
SELECT 'EUR','GBP',0.85,'placeholder, replace before first live invoice', now()
WHERE NOT EXISTS (SELECT 1 FROM public.fx_rates WHERE from_currency='EUR' AND to_currency='GBP');

-- 4. LIMIT CURRENCY = GBP
UPDATE public.board_resolutions SET limit_currency = 'GBP' WHERE limit_currency IS DISTINCT FROM 'GBP';
ALTER TABLE public.board_resolutions DROP CONSTRAINT IF EXISTS board_resolutions_limit_currency_gbp;
ALTER TABLE public.board_resolutions ADD CONSTRAINT board_resolutions_limit_currency_gbp CHECK (limit_currency = 'GBP');

CREATE OR REPLACE FUNCTION public.exporter_headroom(p_exporter_id uuid)
RETURNS TABLE(authorised_limit numeric, limit_currency text, limit_basis text, committed_exposure numeric, headroom numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    -- Limits are always recorded in GBP.
    IF inv.cur = 'GBP' THEN
      v_total := v_total + v_base;
    ELSE
      IF inv.fx_rate_to_gbp IS NULL THEN
        RAISE EXCEPTION 'Invoice % has no stored FX rate; headroom cannot be computed', COALESCE(inv.reference, inv.id::text)
          USING ERRCODE = 'data_exception';
      END IF;
      v_total := v_total + (v_base * inv.fx_rate_to_gbp);
    END IF;
  END LOOP;

  RETURN QUERY SELECT r.authorised_limit, 'GBP'::text, r.limit_basis, v_total, r.authorised_limit - v_total;
END $$;

-- 5. DEACTIVATION GUARD
CREATE OR REPLACE FUNCTION public.guard_document_type_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_refs text; v_drafts text;
BEGIN
  IF OLD.active = true AND NEW.active = false THEN
    SELECT string_agg(DISTINCT COALESCE(i.reference, i.id::text), ', ')
      INTO v_refs
    FROM public.invoice_document_requests r
    JOIN public.v2_invoices i ON i.id = r.invoice_id
    WHERE r.document_type_id = OLD.id AND r.status = 'outstanding';
    IF v_refs IS NOT NULL THEN
      RAISE EXCEPTION 'This document type cannot be deactivated while it is still requested on %.', v_refs
        USING ERRCODE = 'check_violation';
    END IF;

    IF OLD.requirement = 'mandatory' AND OLD.stage IN (1, 2) THEN
      SELECT string_agg(DISTINCT COALESCE(i.reference, i.id::text), ', ')
        INTO v_drafts
      FROM public.v2_invoices i
      WHERE i.status::text IN ('draft','returned_for_revision');
      IF v_drafts IS NOT NULL THEN
        RAISE EXCEPTION 'This document type is mandatory at stage % and cannot be deactivated while these applications are still open: %.', OLD.stage, v_drafts
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;