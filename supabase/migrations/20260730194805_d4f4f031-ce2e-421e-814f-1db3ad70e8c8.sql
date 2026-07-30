UPDATE public.v2_system_config SET value = '2'::jsonb WHERE key = 'decision_sla_working_days';

UPDATE public.v2_invoices SET shipment_date = bl_date WHERE shipment_date IS NULL AND bl_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.v2_invoice_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base date;
BEGIN
  NEW.fee_percent := CASE NEW.terms_days
    WHEN 30 THEN 3.5 WHEN 45 THEN 4.5 WHEN 60 THEN 5.5
    ELSE NEW.fee_percent END;

  IF NEW.bl_date IS NOT NULL AND NEW.shipment_date IS NULL THEN
    NEW.shipment_date := NEW.bl_date;
  END IF;

  v_base := COALESCE(NEW.bl_date, NEW.shipment_date);

  IF NEW.status::text IN ('draft','returned_for_revision') THEN
    IF v_base IS NOT NULL THEN
      NEW.maturity_date := v_base + (NEW.terms_days || ' days')::interval;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.maturity_date := OLD.maturity_date;
  END IF;

  RETURN NEW;
END $function$;

DROP VIEW IF EXISTS public.v2_invoices_with_ageing;
CREATE VIEW public.v2_invoices_with_ageing AS
SELECT i.*,
  CASE WHEN i.maturity_date IS NOT NULL
        AND (i.status::text <> ALL (ARRAY['settled','rejected','draft','returned_for_revision']))
    THEN GREATEST(0, ((now() AT TIME ZONE 'Africa/Lagos')::date - i.maturity_date))
    ELSE 0 END AS days_past_maturity
FROM public.v2_invoices i;
GRANT SELECT ON public.v2_invoices_with_ageing TO authenticated;
GRANT ALL ON public.v2_invoices_with_ageing TO service_role;

CREATE OR REPLACE FUNCTION public.add_working_days(p_from timestamp with time zone, p_days integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ts timestamptz := p_from;
  v_added integer := 0;
  v_d date;
BEGIN
  IF p_days IS NULL OR p_days <= 0 THEN RETURN p_from; END IF;
  WHILE v_added < p_days LOOP
    v_ts := v_ts + interval '1 day';
    v_d := (v_ts AT TIME ZONE 'Africa/Lagos')::date;
    CONTINUE WHEN EXTRACT(ISODOW FROM v_d) IN (6, 7);
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.public_holidays h
      WHERE h.holiday_date = v_d AND h.active
    );
    v_added := v_added + 1;
  END LOOP;
  RETURN v_ts;
END $function$;

CREATE OR REPLACE FUNCTION public.advance_escalation_ladder()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv RECORD;
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
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
      AND maturity_date < v_today
      AND status::text IN ('funded','monitoring','overdue')
  LOOP
    v_days := (v_today - inv.maturity_date)::int;

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
        'timezone', 'Africa/Lagos',
        'from_stage', inv.escalation_stage,
        'to_stage', COALESCE(v_new_stage, inv.escalation_stage),
        'from_status', inv.status,
        'to_status', COALESCE(v_new_status, inv.status)));
  END LOOP;
END $function$;

DO $$
BEGIN
  PERFORM cron.unschedule('advance-escalation-ladder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('advance-escalation-ladder', '15 1 * * *', $$ SELECT public.advance_escalation_ladder(); $$);