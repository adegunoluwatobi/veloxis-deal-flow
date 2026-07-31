
-- 1. Collapse alias actions onto the canonical names in the writers
CREATE OR REPLACE FUNCTION public.v2_request_documents(p_invoice_id uuid, p_document_type_ids uuid[], p_reason text, p_due_date date DEFAULT NULL::date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

    PERFORM public.v2_audit_write('invoice', p_invoice_id, 'requested', p_invoice_id, v_exporter, btrim(p_reason),
      jsonb_build_object('count', v_count, 'due_date', p_due_date, 'document_type_ids', to_jsonb(p_document_type_ids)));
  END IF;
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.v2_withdraw_document_request(p_request_id uuid, p_reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  VALUES ('document_request', p_request_id, r.invoice_id, v_exporter, 'withdrawn', v_uid,
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
END $function$;

-- 2. Narrow the CHECK constraint
ALTER TABLE public.document_audit_log DROP CONSTRAINT document_audit_log_action_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_action_check
CHECK (action = ANY (ARRAY[
  -- the specified list
  'uploaded','replaced','verified','rejected','requested','fulfilled','withdrawn','expired',
  'override_applied','viewed','escalation_advanced','maturity_date_changed','reference_data_changed',
  'limit_breach_blocked','duplicate_blocked','signatory_mismatch_flagged','resolution_created',
  'resolution_replaced','status_changed','sla_paused','sla_resumed',
  -- actions added by features built after that list, all of which have live writers
  'created','updated','superseded','retention_set','notification_sent','notification_failed',
  'scan_status_changed','document_generated','signature_requested','signature_completed',
  'signature_declined','notice_served','template_version_created'
]));
