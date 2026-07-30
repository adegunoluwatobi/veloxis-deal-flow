ALTER TYPE public.v2_invoice_status ADD VALUE IF NOT EXISTS 'information_requested';

-- working seconds per working day
CREATE OR REPLACE FUNCTION public.v2_working_day_seconds()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE((SELECT value::text::integer FROM public.v2_system_config WHERE key='working_day_seconds'), 28800) $$;

INSERT INTO public.v2_system_config (key, value)
SELECT 'working_day_seconds', '28800'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.v2_system_config WHERE key='working_day_seconds');

CREATE OR REPLACE FUNCTION public.v2_sla_pause(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r RECORD; v_started timestamptz;
BEGIN
  SELECT * INTO r FROM public.v2_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR r.sla_paused_at IS NOT NULL THEN RETURN; END IF;
  v_started := COALESCE(r.sla_clock_started_at, r.created_at);
  UPDATE public.v2_invoices
  SET sla_elapsed_seconds = COALESCE(sla_elapsed_seconds,0) + GREATEST(0, EXTRACT(EPOCH FROM (now() - v_started))::int),
      sla_paused_at = now()
  WHERE id = p_invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.v2_sla_resume(p_invoice_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  r RECORD; v_days integer; v_wd integer; v_total integer; v_remaining integer;
  v_full integer; v_rem integer; v_due timestamptz;
BEGIN
  SELECT * INTO r FROM public.v2_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE((SELECT value::text::integer FROM public.v2_system_config WHERE key='decision_sla_working_days'), 2) INTO v_days;
  v_wd := public.v2_working_day_seconds();
  v_total := v_days * v_wd;
  v_remaining := GREATEST(0, v_total - COALESCE(r.sla_elapsed_seconds, 0));
  v_full := v_remaining / v_wd;
  v_rem := v_remaining - (v_full * v_wd);
  v_due := public.add_working_days(now(), v_full) + (v_rem || ' seconds')::interval;
  UPDATE public.v2_invoices
  SET sla_paused_at = NULL, sla_clock_started_at = now(), decision_due_at = v_due
  WHERE id = p_invoice_id;
  RETURN v_due;
END $$;

CREATE OR REPLACE FUNCTION public.v2_notify_exporter(p_invoice_id uuid, p_title text, p_message text, p_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user uuid;
BEGIN
  SELECT e.owner_user_id INTO v_user
  FROM public.v2_invoices i JOIN public.v2_exporters e ON e.id = i.exporter_id
  WHERE i.id = p_invoice_id;
  IF v_user IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (v_user, p_title, p_message, p_type, '/portal/invoices/' || p_invoice_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.v2_request_documents(
  p_invoice_id uuid, p_document_type_ids uuid[], p_reason text, p_due_date date DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_count integer := 0; t uuid; v_exporter uuid; v_ref text;
BEGIN
  IF v_uid IS NULL OR NOT public.v2_can_review_documents(v_uid) THEN
    RAISE EXCEPTION 'Only Credit and Compliance reviewers may request documents' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason is required and is shown to the exporter' USING ERRCODE='check_violation';
  END IF;
  IF p_document_type_ids IS NULL OR array_length(p_document_type_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Select at least one document' USING ERRCODE='check_violation';
  END IF;

  SELECT exporter_id, COALESCE(reference, invoice_number) INTO v_exporter, v_ref
  FROM public.v2_invoices WHERE id = p_invoice_id;
  IF v_exporter IS NULL THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='no_data_found'; END IF;

  FOREACH t IN ARRAY p_document_type_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.invoice_document_requests
      WHERE invoice_id = p_invoice_id AND document_type_id = t AND status = 'outstanding'
    ) THEN
      INSERT INTO public.invoice_document_requests (invoice_id, document_type_id, requested_by, reason, due_date, status)
      VALUES (p_invoice_id, t, v_uid, btrim(p_reason), p_due_date, 'outstanding');
      v_count := v_count + 1;
    END IF;
  END LOOP;

  IF v_count > 0 THEN
    PERFORM public.v2_sla_pause(p_invoice_id);
    UPDATE public.v2_invoices SET status = 'information_requested'::public.v2_invoice_status WHERE id = p_invoice_id;
    PERFORM public.v2_notify_exporter(p_invoice_id,
      'Documents requested on ' || COALESCE(v_ref,'your application'),
      btrim(p_reason) || ' Your decision clock is paused while we wait for these documents. Once you upload them, we will issue a decision within the remaining time on your two working day window.',
      'action_required');
    INSERT INTO public.document_audit_log (entity_type, entity_id, invoice_id, exporter_id, action, actor_id, metadata)
    VALUES ('invoice', p_invoice_id, p_invoice_id, v_exporter, 'documents_requested', v_uid,
      jsonb_build_object('count', v_count, 'reason', btrim(p_reason), 'due_date', p_due_date));
  END IF;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.v2_withdraw_document_request(p_request_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); r RECORD; v_exporter uuid; v_outstanding integer;
BEGIN
  SELECT * INTO r FROM public.invoice_document_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='no_data_found'; END IF;
  IF v_uid IS NULL OR NOT (r.requested_by = v_uid OR public.has_app_role(v_uid,'super_admin'::public.v2_app_role)) THEN
    RAISE EXCEPTION 'Only the requester or a Super Admin may withdraw this request' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason is required to withdraw a request' USING ERRCODE='check_violation';
  END IF;

  UPDATE public.invoice_document_requests
  SET status = 'withdrawn', withdrawn_by = v_uid, withdrawn_at = now()
  WHERE id = p_request_id;

  SELECT exporter_id INTO v_exporter FROM public.v2_invoices WHERE id = r.invoice_id;
  INSERT INTO public.document_audit_log (entity_type, entity_id, invoice_id, exporter_id, action, actor_id, metadata)
  VALUES ('document_request', p_request_id, r.invoice_id, v_exporter, 'request_withdrawn', v_uid,
    jsonb_build_object('reason', btrim(p_reason)));

  SELECT count(*) INTO v_outstanding FROM public.invoice_document_requests
  WHERE invoice_id = r.invoice_id AND status = 'outstanding';

  IF v_outstanding = 0 THEN
    PERFORM public.v2_sla_resume(r.invoice_id);
    UPDATE public.v2_invoices SET status = 'submitted'::public.v2_invoice_status
    WHERE id = r.invoice_id AND status = 'information_requested'::public.v2_invoice_status;
    PERFORM public.v2_notify_exporter(r.invoice_id, 'Document request withdrawn',
      'A document request has been withdrawn and your decision clock has resumed.', 'info');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.v2_fulfil_document_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r RECORD; v_outstanding integer; v_exporter uuid; v_ref text;
BEGIN
  SELECT * INTO r FROM public.invoice_document_requests
  WHERE invoice_id = NEW.invoice_id AND document_type_id = NEW.document_type_id AND status = 'outstanding'
  ORDER BY requested_at LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE public.invoice_document_requests
  SET status = 'fulfilled', fulfilled_by_document_id = NEW.id
  WHERE id = r.id;

  IF r.requested_by IS NOT NULL THEN
    SELECT COALESCE(reference, invoice_number) INTO v_ref FROM public.v2_invoices WHERE id = NEW.invoice_id;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (r.requested_by, 'Requested document uploaded',
      'A document you requested on ' || COALESCE(v_ref,'an application') || ' has been uploaded and is ready for review.',
      'info', '/app/invoices/' || NEW.invoice_id::text);
  END IF;

  SELECT count(*) INTO v_outstanding FROM public.invoice_document_requests
  WHERE invoice_id = NEW.invoice_id AND status = 'outstanding';

  IF v_outstanding = 0 THEN
    PERFORM public.v2_sla_resume(NEW.invoice_id);
    UPDATE public.v2_invoices SET status = 'submitted'::public.v2_invoice_status
    WHERE id = NEW.invoice_id AND status = 'information_requested'::public.v2_invoice_status;
    SELECT exporter_id INTO v_exporter FROM public.v2_invoices WHERE id = NEW.invoice_id;
    PERFORM public.v2_notify_exporter(NEW.invoice_id, 'Your application is back under review',
      'Thank you. All requested documents are in and your decision clock has resumed.', 'success');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_fulfil_document_request ON public.invoice_documents;
CREATE TRIGGER trg_v2_fulfil_document_request
AFTER INSERT ON public.invoice_documents
FOR EACH ROW EXECUTE FUNCTION public.v2_fulfil_document_request();

CREATE OR REPLACE FUNCTION public.v2_set_inspection_required(p_invoice_id uuid, p_required boolean, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_exporter uuid; v_old boolean;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_app_role(v_uid,'credit_officer'::public.v2_app_role)
      OR public.has_app_role(v_uid,'super_admin'::public.v2_app_role)) THEN
    RAISE EXCEPTION 'Only Credit and Compliance or a Super Admin may change the inspection requirement'
      USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE='check_violation';
  END IF;
  SELECT exporter_id, inspection_required INTO v_exporter, v_old FROM public.v2_invoices WHERE id = p_invoice_id;
  IF v_exporter IS NULL THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='no_data_found'; END IF;

  UPDATE public.v2_invoices
  SET inspection_required = p_required,
      inspection_override_by = v_uid,
      inspection_override_reason = btrim(p_reason)
  WHERE id = p_invoice_id;

  INSERT INTO public.document_audit_log (entity_type, entity_id, invoice_id, exporter_id, action, actor_id, metadata)
  VALUES ('invoice', p_invoice_id, p_invoice_id, v_exporter, 'override_applied', v_uid,
    jsonb_build_object('field','inspection_required','from', v_old, 'to', p_required, 'reason', btrim(p_reason)));
  RETURN p_required;
END $$;