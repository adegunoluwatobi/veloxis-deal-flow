-- allow expired resolutions
ALTER TABLE public.board_resolutions DROP CONSTRAINT IF EXISTS board_resolutions_verification_status_check;
ALTER TABLE public.board_resolutions ADD CONSTRAINT board_resolutions_verification_status_check
  CHECK (verification_status = ANY (ARRAY['pending','verified','rejected','expired']));

-- fix stage 2 list (document_types uses `requirement`, not is_mandatory)
CREATE OR REPLACE FUNCTION public.v2_invoice_audit_and_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_owner uuid; v_ref text; v_docs text; v_sig_ok boolean; v_inv uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_ref := COALESCE(NEW.reference, NEW.invoice_number);
  SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = NEW.exporter_id;

  PERFORM public.v2_audit_write('invoice', NEW.id, 'status_changed', NEW.id, NEW.exporter_id, NULL,
    jsonb_build_object('before', jsonb_build_object('status', OLD.status),
                       'after',  jsonb_build_object('status', NEW.status)));

  IF NEW.status::text = 'submitted' AND OLD.status::text IN ('draft','returned_for_revision') THEN
    SELECT COALESCE(string_agg(dt.label, ', ' ORDER BY dt.label), 'no documents') INTO v_docs
    FROM public.invoice_documents d JOIN public.document_types dt ON dt.id = d.document_type_id
    WHERE d.invoice_id = NEW.id AND d.superseded_by IS NULL;

    PERFORM public.v2_send_notification('submission_received', v_owner,
      jsonb_build_object('reference', v_ref,
        'maturity_date', to_char(NEW.maturity_date,'DD Mon YYYY'),
        'decision_due', to_char(NEW.decision_due_at,'DD Mon YYYY HH24:MI'),
        'documents', v_docs),
      '/portal/invoices/' || NEW.id::text, 'success', NEW.id, NEW.exporter_id);

    PERFORM public.v2_notify_role('credit_officer'::public.v2_app_role, 'staff_new_submission',
      jsonb_build_object('reference', v_ref, 'decision_due', to_char(NEW.decision_due_at,'DD Mon YYYY HH24:MI')),
      '/app/invoices/' || NEW.id::text, 'action_required', NEW.id, NEW.exporter_id);

    IF NEW.signatory_id IS NOT NULL AND NEW.board_resolution_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.authorised_signatories s
                     WHERE s.id = NEW.signatory_id AND s.board_resolution_id = NEW.board_resolution_id) INTO v_sig_ok;
      IF NOT v_sig_ok THEN
        PERFORM public.v2_audit_write('invoice', NEW.id, 'signatory_mismatch_flagged', NEW.id, NEW.exporter_id,
          'Selected signatory is not named on the board resolution',
          jsonb_build_object('signatory_id', NEW.signatory_id, 'board_resolution_id', NEW.board_resolution_id));
        PERFORM public.v2_notify_role('credit_officer'::public.v2_app_role, 'staff_signatory_mismatch',
          jsonb_build_object('reference', v_ref), '/app/invoices/' || NEW.id::text, 'warning', NEW.id, NEW.exporter_id);
      END IF;
    END IF;
  END IF;

  IF NEW.status::text IN ('verified','approved','rejected','returned_for_revision') THEN
    PERFORM public.v2_send_notification('decision_issued', v_owner,
      jsonb_build_object('reference', v_ref, 'outcome', replace(NEW.status::text,'_',' '),
                         'link', '/portal/invoices/' || NEW.id::text),
      '/portal/invoices/' || NEW.id::text,
      CASE WHEN NEW.status::text IN ('verified','approved') THEN 'success' ELSE 'warning' END,
      NEW.id, NEW.exporter_id);
  END IF;

  IF NEW.status::text = 'verified' AND OLD.status::text IS DISTINCT FROM 'verified' THEN
    SELECT COALESCE(string_agg(dt.label, ', ' ORDER BY dt.sort_order), 'the remaining documents') INTO v_docs
    FROM public.document_types dt
    WHERE dt.stage = 2 AND dt.level = 'invoice' AND dt.requirement = 'mandatory' AND dt.active;
    PERFORM public.v2_send_notification('stage1_approved', v_owner,
      jsonb_build_object('reference', v_ref, 'stage2_documents', v_docs),
      '/portal/invoices/' || NEW.id::text, 'action_required', NEW.id, NEW.exporter_id);
  END IF;

  IF NEW.status::text = 'overdue' AND OLD.status::text IS DISTINCT FROM 'overdue' THEN
    PERFORM public.v2_notify_role('credit_officer'::public.v2_app_role, 'staff_invoice_overdue',
      jsonb_build_object('reference', v_ref), '/app/invoices/' || NEW.id::text, 'warning', NEW.id, NEW.exporter_id);
  END IF;

  IF NEW.status::text = 'settled' AND OLD.status::text IS DISTINCT FROM 'settled' THEN
    UPDATE public.invoice_documents
      SET retention_expires_at = (COALESCE(NEW.settled_date, (now() AT TIME ZONE 'Africa/Lagos')::date) + interval '7 years')
      WHERE invoice_id = NEW.id;
    UPDATE public.company_documents
      SET retention_expires_at = GREATEST(COALESCE(retention_expires_at, '-infinity'::timestamptz),
            (COALESCE(NEW.settled_date, (now() AT TIME ZONE 'Africa/Lagos')::date) + interval '7 years'))
      WHERE exporter_id = NEW.exporter_id;
    PERFORM public.v2_audit_write('invoice', NEW.id, 'retention_set', NEW.id, NEW.exporter_id, NULL,
      jsonb_build_object('retention_expires_at', COALESCE(NEW.settled_date, current_date) + interval '7 years'));
  END IF;

  RETURN NEW;
END $$;

-- documents requested notification through templates
CREATE OR REPLACE FUNCTION public.v2_request_documents(p_invoice_id uuid, p_document_type_ids uuid[], p_reason text, p_due_date date DEFAULT NULL::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_count integer := 0; t uuid; v_exporter uuid; v_ref text; v_owner uuid; v_list text;
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
    IF NOT EXISTS (SELECT 1 FROM public.invoice_document_requests
                   WHERE invoice_id = p_invoice_id AND document_type_id = t AND status = 'outstanding') THEN
      INSERT INTO public.invoice_document_requests (invoice_id, document_type_id, requested_by, reason, due_date, status)
      VALUES (p_invoice_id, t, v_uid, btrim(p_reason), p_due_date, 'outstanding');
      v_count := v_count + 1;
    END IF;
  END LOOP;

  IF v_count > 0 THEN
    PERFORM public.v2_sla_pause(p_invoice_id);
    UPDATE public.v2_invoices SET status = 'information_requested'::public.v2_invoice_status WHERE id = p_invoice_id;

    SELECT COALESCE(string_agg('<li><strong>' || dt.label || '</strong>: ' || btrim(p_reason)
             || COALESCE('. Due by ' || to_char(p_due_date,'DD Mon YYYY'), '') || '</li>', ''), '')
      INTO v_list
    FROM public.document_types dt WHERE dt.id = ANY(p_document_type_ids);
    v_list := '<ul>' || v_list || '</ul>';

    SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = v_exporter;
    PERFORM public.v2_send_notification('documents_requested', v_owner,
      jsonb_build_object('reference', v_ref, 'document_list', v_list,
                         'link', '/portal/invoices/' || p_invoice_id::text),
      '/portal/invoices/' || p_invoice_id::text, 'action_required', p_invoice_id, v_exporter);

    PERFORM public.v2_audit_write('invoice', p_invoice_id, 'documents_requested', p_invoice_id, v_exporter, btrim(p_reason),
      jsonb_build_object('count', v_count, 'due_date', p_due_date, 'document_type_ids', to_jsonb(p_document_type_ids)));
  END IF;
  RETURN v_count;
END $$;

-- fulfilment notification to the original requester through templates
CREATE OR REPLACE FUNCTION public.v2_fulfil_document_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD; v_outstanding integer; v_exporter uuid; v_ref text; v_owner uuid;
BEGIN
  SELECT * INTO r FROM public.invoice_document_requests
  WHERE invoice_id = NEW.invoice_id AND document_type_id = NEW.document_type_id AND status = 'outstanding'
  ORDER BY requested_at LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE public.invoice_document_requests
  SET status = 'fulfilled', fulfilled_by_document_id = NEW.id WHERE id = r.id;

  SELECT exporter_id, COALESCE(reference, invoice_number) INTO v_exporter, v_ref
  FROM public.v2_invoices WHERE id = NEW.invoice_id;

  SELECT count(*) INTO v_outstanding FROM public.invoice_document_requests
  WHERE invoice_id = NEW.invoice_id AND status = 'outstanding';

  IF v_outstanding = 0 THEN
    PERFORM public.v2_sla_resume(NEW.invoice_id);
    UPDATE public.v2_invoices SET status = 'submitted'::public.v2_invoice_status
    WHERE id = NEW.invoice_id AND status = 'information_requested'::public.v2_invoice_status;
    IF r.requested_by IS NOT NULL THEN
      PERFORM public.v2_send_notification('staff_request_fulfilled', r.requested_by,
        jsonb_build_object('reference', v_ref), '/app/invoices/' || NEW.invoice_id::text, 'info',
        NEW.invoice_id, v_exporter);
    END IF;
    SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = v_exporter;
    PERFORM public.v2_notify_exporter(NEW.invoice_id, 'Your application is back under review',
      'Thank you. All requested documents are in and your decision clock has resumed.', 'success');
  END IF;
  RETURN NEW;
END $$;

-- board resolution verified notification
CREATE OR REPLACE FUNCTION public.v2_resolution_verified_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner uuid;
BEGIN
  IF NEW.verification_status = 'verified' AND OLD.verification_status IS DISTINCT FROM 'verified' THEN
    SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = NEW.exporter_id;
    PERFORM public.v2_send_notification('resolution_verified', v_owner,
      jsonb_build_object('limit', NEW.limit_currency || ' ' || to_char(NEW.authorised_limit,'FM999,999,999,990.00'),
                         'basis', replace(NEW.limit_basis,'_',' '),
                         'expiry', to_char(NEW.valid_until,'DD Mon YYYY')),
      '/portal/profile', 'info', NULL, NEW.exporter_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_resolution_verified_notify ON public.board_resolutions;
CREATE TRIGGER trg_resolution_verified_notify AFTER UPDATE ON public.board_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.v2_resolution_verified_notify();

-- escalation transitions notify Credit and Compliance
CREATE OR REPLACE FUNCTION public.advance_escalation_ladder()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  inv RECORD; v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_days int; v_new_stage text; v_new_status text; v_rank_old int; v_rank_new int; v_ref text;
BEGIN
  FOR inv IN
    SELECT id, exporter_id, status::text AS status, escalation_stage, maturity_date,
           COALESCE(reference, invoice_number) AS ref
    FROM public.v2_invoices
    WHERE maturity_date IS NOT NULL AND maturity_date < v_today
      AND status::text IN ('funded','monitoring','overdue')
  LOOP
    v_days := (v_today - inv.maturity_date)::int;
    v_new_stage := CASE WHEN v_days >= 30 THEN 'counsel_instructed'
                        WHEN v_days >= 14 THEN 'demand_issued'
                        WHEN v_days >= 7  THEN 'ap_contacted'
                        WHEN v_days >= 3  THEN 'reminder_sent' ELSE NULL END;
    v_new_status := CASE WHEN v_days >= 30 THEN 'in_recovery'
                         WHEN inv.status IN ('funded','monitoring') THEN 'overdue' ELSE NULL END;
    v_rank_old := CASE COALESCE(inv.escalation_stage,'') WHEN 'counsel_instructed' THEN 4 WHEN 'demand_issued' THEN 3
                       WHEN 'ap_contacted' THEN 2 WHEN 'reminder_sent' THEN 1 ELSE 0 END;
    v_rank_new := CASE COALESCE(v_new_stage,'') WHEN 'counsel_instructed' THEN 4 WHEN 'demand_issued' THEN 3
                       WHEN 'ap_contacted' THEN 2 WHEN 'reminder_sent' THEN 1 ELSE 0 END;
    IF v_rank_new <= v_rank_old THEN v_new_stage := NULL; END IF;
    IF v_new_status IS NOT NULL AND v_new_status = inv.status THEN v_new_status := NULL; END IF;
    IF v_new_stage IS NULL AND v_new_status IS NULL THEN CONTINUE; END IF;

    UPDATE public.v2_invoices
    SET escalation_stage = COALESCE(v_new_stage, escalation_stage),
        status = COALESCE(v_new_status::public.v2_invoice_status, status)
    WHERE id = inv.id;

    PERFORM public.v2_audit_write('invoice', inv.id, 'escalation_advanced', inv.id, inv.exporter_id, NULL,
      jsonb_build_object('days_past_maturity', v_days, 'timezone', 'Africa/Lagos',
        'before', jsonb_build_object('stage', inv.escalation_stage, 'status', inv.status),
        'after', jsonb_build_object('stage', COALESCE(v_new_stage, inv.escalation_stage),
                                    'status', COALESCE(v_new_status, inv.status))));

    IF v_new_stage IS NOT NULL THEN
      PERFORM public.v2_notify_role('credit_officer'::public.v2_app_role, 'staff_escalation_advanced',
        jsonb_build_object('reference', inv.ref, 'stage', replace(v_new_stage,'_',' '), 'days', v_days::text),
        '/app/invoices/' || inv.id::text, 'warning', inv.id, inv.exporter_id);
    END IF;
  END LOOP;
END $$;

-- SLA at risk sweep
CREATE OR REPLACE FUNCTION public.run_sla_at_risk_job()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv RECORD; v_threshold interval; n int := 0;
BEGIN
  v_threshold := ((public.v2_working_day_seconds() / 8) * 4 || ' seconds')::interval;
  FOR inv IN
    SELECT i.id, i.exporter_id, COALESCE(i.reference, i.invoice_number) AS ref, i.decision_due_at
    FROM public.v2_invoices i
    WHERE i.status::text = 'submitted' AND i.sla_paused_at IS NULL
      AND i.decision_due_at IS NOT NULL
      AND i.decision_due_at > now() AND i.decision_due_at <= now() + v_threshold
      AND NOT EXISTS (
        SELECT 1 FROM public.document_audit_log l
        WHERE l.invoice_id = i.id AND l.action = 'notification_sent'
          AND l.metadata->>'template_key' = 'staff_sla_at_risk'
          AND l.created_at > now() - interval '12 hours')
  LOOP
    PERFORM public.v2_notify_role('credit_officer'::public.v2_app_role, 'staff_sla_at_risk',
      jsonb_build_object('reference', inv.ref, 'decision_due', to_char(inv.decision_due_at,'DD Mon YYYY HH24:MI')),
      '/app/invoices/' || inv.id::text, 'action_required', inv.id, inv.exporter_id);
    PERFORM public.v2_notify_role('approver'::public.v2_app_role, 'staff_sla_at_risk',
      jsonb_build_object('reference', inv.ref, 'decision_due', to_char(inv.decision_due_at,'DD Mon YYYY HH24:MI')),
      '/app/invoices/' || inv.id::text, 'action_required', inv.id, inv.exporter_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

SELECT cron.schedule('sla-at-risk-job', '*/30 * * * *', $cron$ SELECT public.run_sla_at_risk_job(); $cron$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sla-at-risk-job');