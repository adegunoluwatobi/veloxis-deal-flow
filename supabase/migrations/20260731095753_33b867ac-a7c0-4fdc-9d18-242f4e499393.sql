
-- ============ 1. AUDIT ACTIONS ============
ALTER TABLE public.document_audit_log DROP CONSTRAINT IF EXISTS document_audit_log_action_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_action_check CHECK (action = ANY (ARRAY[
  'uploaded','replaced','verified','rejected','requested','documents_requested','fulfilled','withdrawn',
  'request_withdrawn','expired','override_applied','viewed','created','updated','superseded',
  'reference_data_changed','escalation_advanced','maturity_date_changed','limit_breach_blocked',
  'duplicate_blocked','signatory_mismatch_flagged','resolution_created','resolution_replaced',
  'status_changed','sla_paused','sla_resumed','retention_set','notification_sent',
  'scan_status_changed','notification_failed'
]));

-- ============ 2. QUARANTINE STATE ============
ALTER TABLE public.invoice_documents
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending_scan',
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_detail text;
ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending_scan',
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_detail text;

ALTER TABLE public.invoice_documents DROP CONSTRAINT IF EXISTS invoice_documents_scan_status_check;
ALTER TABLE public.invoice_documents ADD CONSTRAINT invoice_documents_scan_status_check
  CHECK (scan_status IN ('pending_scan','clean','flagged','scan_failed'));
ALTER TABLE public.company_documents DROP CONSTRAINT IF EXISTS company_documents_scan_status_check;
ALTER TABLE public.company_documents ADD CONSTRAINT company_documents_scan_status_check
  CHECK (scan_status IN ('pending_scan','clean','flagged','scan_failed'));

-- existing rows predate the scanner; treat as clean so nothing disappears from review
UPDATE public.invoice_documents SET scan_status = 'clean', scanned_at = now(), scan_detail = 'legacy upload, pre scanner' WHERE scan_status = 'pending_scan';
UPDATE public.company_documents SET scan_status = 'clean', scanned_at = now(), scan_detail = 'legacy upload, pre scanner' WHERE scan_status = 'pending_scan';

CREATE OR REPLACE FUNCTION public.log_scan_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_exporter uuid; v_invoice uuid; v_entity text;
BEGIN
  IF NEW.scan_status IS NOT DISTINCT FROM OLD.scan_status THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'invoice_documents' THEN
    v_entity := 'invoice_document'; v_invoice := NEW.invoice_id;
    SELECT exporter_id INTO v_exporter FROM public.v2_invoices WHERE id = NEW.invoice_id;
  ELSE
    v_entity := 'company_document'; v_exporter := NEW.exporter_id;
  END IF;
  PERFORM public.v2_audit_write(v_entity, NEW.id, 'scan_status_changed', v_invoice, v_exporter, NEW.scan_detail,
    jsonb_build_object('before', jsonb_build_object('scan_status', OLD.scan_status),
                       'after',  jsonb_build_object('scan_status', NEW.scan_status, 'scanned_at', NEW.scanned_at)));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_inv_doc_scan_log ON public.invoice_documents;
CREATE TRIGGER trg_inv_doc_scan_log AFTER UPDATE ON public.invoice_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_scan_transition();
DROP TRIGGER IF EXISTS trg_co_doc_scan_log ON public.company_documents;
CREATE TRIGGER trg_co_doc_scan_log AFTER UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_scan_transition();

-- reviewers cannot see, nor verify, documents that have not passed the check
DROP POLICY IF EXISTS inv_docs_select ON public.invoice_documents;
CREATE POLICY inv_docs_select ON public.invoice_documents FOR SELECT TO authenticated
  USING ((public.is_v2_staff(auth.uid()) AND scan_status = 'clean') OR public.v2_owns_invoice(auth.uid(), invoice_id));
DROP POLICY IF EXISTS co_docs_select ON public.company_documents;
CREATE POLICY co_docs_select ON public.company_documents FOR SELECT TO authenticated
  USING ((public.is_v2_staff(auth.uid()) AND scan_status = 'clean') OR public.v2_owns_exporter(auth.uid(), exporter_id));

CREATE OR REPLACE FUNCTION public.guard_unscanned_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' AND NEW.scan_status <> 'clean' THEN
    RAISE EXCEPTION 'This document is still being checked and cannot be approved yet.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_inv_doc_scan_guard ON public.invoice_documents;
CREATE TRIGGER trg_inv_doc_scan_guard BEFORE UPDATE ON public.invoice_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_unscanned_verification();
DROP TRIGGER IF EXISTS trg_co_doc_scan_guard ON public.company_documents;
CREATE TRIGGER trg_co_doc_scan_guard BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_unscanned_verification();

-- ============ 3. NOTIFICATION DELIVERIES ============
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','in_app')),
  recipient text NOT NULL,
  recipient_user_id uuid,
  entity_type text,
  entity_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','suppressed')),
  provider_response text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  message_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nd_select_admin ON public.notification_deliveries;
CREATE POLICY nd_select_admin ON public.notification_deliveries FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));
CREATE INDEX IF NOT EXISTS idx_nd_status ON public.notification_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_nd_created ON public.notification_deliveries (created_at DESC);

-- alert Credit and Compliance when a message about an SLA paused invoice cannot be delivered
CREATE OR REPLACE FUNCTION public.notification_delivery_failure_alert(p_delivery_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d RECORD; v_paused boolean; v_ref text; u uuid;
BEGIN
  SELECT * INTO d FROM public.notification_deliveries WHERE id = p_delivery_id;
  IF NOT FOUND OR d.entity_type <> 'invoice' OR d.entity_id IS NULL THEN RETURN; END IF;
  SELECT (sla_paused_at IS NOT NULL), COALESCE(reference, invoice_number)
    INTO v_paused, v_ref FROM public.v2_invoices WHERE id = d.entity_id;
  IF NOT COALESCE(v_paused, false) THEN RETURN; END IF;
  FOR u IN SELECT public.v2_users_with_role('credit_officer'::public.v2_app_role) LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (u, 'Exporter could not be contacted',
      'A message about application ' || COALESCE(v_ref,'') || ' was ' || d.status ||
      '. The decision clock is paused, so this application will stall until the exporter is reached.',
      'action_required', '/app/invoices/' || d.entity_id::text);
  END LOOP;
  PERFORM public.v2_audit_write('invoice', d.entity_id, 'notification_failed', d.entity_id, NULL,
    d.provider_response, jsonb_build_object('template_key', d.template_key, 'channel', d.channel, 'status', d.status));
END $$;

-- rewritten sender: audit write is never swallowed, every attempt is logged
CREATE OR REPLACE FUNCTION public.v2_send_notification(p_key text, p_user_id uuid, p_vars jsonb DEFAULT '{}'::jsonb, p_link text DEFAULT NULL::text, p_type text DEFAULT 'info'::text, p_invoice_id uuid DEFAULT NULL::uuid, p_exporter_id uuid DEFAULT NULL::uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t RECORD; v_email text; v_subject text; v_body text; v_msg uuid; v_del uuid;
  v_entity_type text; v_entity_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  v_entity_type := CASE WHEN p_invoice_id IS NOT NULL THEN 'invoice'
                        WHEN p_exporter_id IS NOT NULL THEN 'exporter' ELSE NULL END;
  v_entity_id := COALESCE(p_invoice_id, p_exporter_id);

  SELECT * INTO t FROM public.notification_templates WHERE key = p_key AND channel = 'in_app' AND active LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_user_id, public.v2_render_template(t.subject, p_vars), public.v2_render_template(t.body, p_vars), p_type, p_link);
    INSERT INTO public.notification_deliveries (template_key, channel, recipient, recipient_user_id, entity_type, entity_id, status, attempts, sent_at)
    VALUES (p_key, 'in_app', p_user_id::text, p_user_id, v_entity_type, v_entity_id, 'sent', 1, now());
  END IF;

  SELECT * INTO t FROM public.notification_templates WHERE key = p_key AND channel = 'email' AND active LIMIT 1;
  IF FOUND THEN
    SELECT email INTO v_email FROM public.profiles WHERE user_id = p_user_id;
    IF v_email IS NULL OR v_email = '' THEN
      INSERT INTO public.notification_deliveries (template_key, channel, recipient, recipient_user_id, entity_type, entity_id, status, provider_response, attempts)
      VALUES (p_key, 'email', '', p_user_id, v_entity_type, v_entity_id, 'failed', 'No email address on file', 1)
      RETURNING id INTO v_del;
      PERFORM public.notification_delivery_failure_alert(v_del);
    ELSIF EXISTS (SELECT 1 FROM public.suppressed_emails WHERE email = lower(v_email)) THEN
      INSERT INTO public.notification_deliveries (template_key, channel, recipient, recipient_user_id, entity_type, entity_id, status, provider_response, attempts)
      VALUES (p_key, 'email', v_email, p_user_id, v_entity_type, v_entity_id, 'suppressed', 'Address is on the suppression list', 0)
      RETURNING id INTO v_del;
      PERFORM public.notification_delivery_failure_alert(v_del);
    ELSE
      v_subject := public.v2_render_template(t.subject, p_vars);
      v_body := public.v2_email_shell(v_subject, public.v2_render_template(t.body, p_vars));
      v_msg := gen_random_uuid();
      INSERT INTO public.notification_deliveries (template_key, channel, recipient, recipient_user_id, entity_type, entity_id, status, attempts, message_id, payload)
      VALUES (p_key, 'email', v_email, p_user_id, v_entity_type, v_entity_id, 'queued', 1, v_msg,
              jsonb_build_object('subject', v_subject, 'html', v_body))
      RETURNING id INTO v_del;
      BEGIN
        PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
          'message_id', v_msg, 'to', v_email,
          'from', 'Veloxis <noreply@notify.veloxis.co.uk>',
          'sender_domain', 'notify.veloxis.co.uk',
          'subject', v_subject, 'html', v_body, 'text', v_subject,
          'purpose', 'transactional', 'label', p_key,
          'idempotency_key', v_msg::text, 'queued_at', now()));
        INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status)
        VALUES (v_msg, p_key, v_email, 'pending');
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.notification_deliveries
        SET status = 'failed', provider_response = SQLERRM, next_attempt_at = now() + interval '5 minutes'
        WHERE id = v_del;
        PERFORM public.notification_delivery_failure_alert(v_del);
      END;
    END IF;
  END IF;

  PERFORM public.v2_audit_write('notification', COALESCE(p_invoice_id, p_user_id), 'notification_sent',
    p_invoice_id, p_exporter_id, NULL, jsonb_build_object('template_key', p_key, 'vars', p_vars));
END $$;

-- retry loop: three attempts, 5 / 25 / 125 minute backoff
CREATE OR REPLACE FUNCTION public.retry_failed_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d RECORD; v_msg uuid; v_count integer := 0;
BEGIN
  FOR d IN
    SELECT * FROM public.notification_deliveries
    WHERE status = 'failed' AND channel = 'email' AND attempts < 3
      AND COALESCE(next_attempt_at, now()) <= now()
    ORDER BY created_at LIMIT 100
  LOOP
    v_msg := gen_random_uuid();
    BEGIN
      PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
        'message_id', v_msg, 'to', d.recipient,
        'from', 'Veloxis <noreply@notify.veloxis.co.uk>',
        'sender_domain', 'notify.veloxis.co.uk',
        'subject', d.payload->>'subject', 'html', d.payload->>'html', 'text', d.payload->>'subject',
        'purpose', 'transactional', 'label', d.template_key,
        'idempotency_key', v_msg::text, 'queued_at', now()));
      UPDATE public.notification_deliveries
      SET status = 'queued', attempts = attempts + 1, message_id = v_msg,
          provider_response = NULL, next_attempt_at = NULL
      WHERE id = d.id;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.notification_deliveries
      SET attempts = attempts + 1, provider_response = SQLERRM,
          next_attempt_at = now() + (power(5, attempts + 1) || ' minutes')::interval
      WHERE id = d.id;
      PERFORM public.notification_delivery_failure_alert(d.id);
    END;
  END LOOP;
  RETURN v_count;
END $$;
