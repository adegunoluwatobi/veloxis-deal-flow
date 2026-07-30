-- ============ 1. AUDIT COMPLETENESS ============

ALTER TABLE public.document_audit_log DROP CONSTRAINT IF EXISTS document_audit_log_action_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_action_check CHECK (action = ANY (ARRAY[
  'uploaded','replaced','verified','rejected','requested','documents_requested','fulfilled','withdrawn',
  'request_withdrawn','expired','override_applied','viewed','created','updated','superseded',
  'reference_data_changed','escalation_advanced','maturity_date_changed','limit_breach_blocked',
  'duplicate_blocked','signatory_mismatch_flagged','resolution_created','resolution_replaced',
  'status_changed','sla_paused','sla_resumed','retention_set','notification_sent'
]));

ALTER TABLE public.document_audit_log DROP CONSTRAINT IF EXISTS document_audit_log_entity_type_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_entity_type_check CHECK (entity_type = ANY (ARRAY[
  'invoice_document','company_document','document_request','board_resolution','document_type',
  'commodity','regulated_commodity','system_config','invoice','exporter','notification'
]));

CREATE INDEX IF NOT EXISTS idx_doc_audit_invoice ON public.document_audit_log(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_audit_exporter ON public.document_audit_log(exporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_audit_action ON public.document_audit_log(action, created_at DESC);

-- actor role resolver
CREATE OR REPLACE FUNCTION public.v2_actor_role(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(string_agg(role::text, ','), 'system')
  FROM public.app_user_roles WHERE user_id = _user_id
$$;

-- central writer
CREATE OR REPLACE FUNCTION public.v2_audit_write(
  p_entity_type text, p_entity_id uuid, p_action text,
  p_invoice_id uuid DEFAULT NULL, p_exporter_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_actor uuid := COALESCE(p_actor, auth.uid()); v_id uuid;
BEGIN
  INSERT INTO public.document_audit_log
    (entity_type, entity_id, invoice_id, exporter_id, action, actor_id, actor_role, reason, metadata)
  VALUES (p_entity_type, p_entity_id, p_invoice_id, p_exporter_id, p_action, v_actor,
          CASE WHEN v_actor IS NULL THEN 'system' ELSE public.v2_actor_role(v_actor) END,
          p_reason, COALESCE(p_metadata,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- richer capture trigger
CREATE OR REPLACE FUNCTION public.doc_audit_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_entity text; v_action text; v_invoice uuid; v_exporter uuid;
  v_reason text; v_before jsonb := '{}'::jsonb; v_after jsonb := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'invoice_documents' THEN
    v_entity := 'invoice_document'; v_invoice := NEW.invoice_id;
    SELECT i.exporter_id INTO v_exporter FROM public.v2_invoices i WHERE i.id = NEW.invoice_id;
    v_reason := NEW.rejection_reason;
    IF TG_OP = 'INSERT' THEN
      v_action := CASE WHEN NEW.version > 1 THEN 'replaced' ELSE 'uploaded' END;
      v_after := jsonb_build_object('status', NEW.status, 'version', NEW.version, 'filename', NEW.original_filename);
    ELSE
      v_before := jsonb_build_object('status', OLD.status, 'rejection_reason', OLD.rejection_reason, 'superseded_by', OLD.superseded_by);
      v_after  := jsonb_build_object('status', NEW.status, 'rejection_reason', NEW.rejection_reason, 'superseded_by', NEW.superseded_by);
      v_action := CASE
        WHEN NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN 'verified'
        WHEN NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN 'rejected'
        WHEN NEW.superseded_by IS NOT NULL AND OLD.superseded_by IS NULL THEN 'superseded'
        ELSE 'updated' END;
    END IF;

  ELSIF TG_TABLE_NAME = 'company_documents' THEN
    v_entity := 'company_document'; v_exporter := NEW.exporter_id;
    v_reason := NEW.rejection_reason;
    IF TG_OP = 'INSERT' THEN
      v_action := 'uploaded';
      v_after := jsonb_build_object('status', NEW.status, 'valid_until', NEW.valid_until, 'filename', NEW.original_filename);
    ELSE
      v_before := jsonb_build_object('status', OLD.status, 'valid_until', OLD.valid_until, 'rejection_reason', OLD.rejection_reason);
      v_after  := jsonb_build_object('status', NEW.status, 'valid_until', NEW.valid_until, 'rejection_reason', NEW.rejection_reason);
      v_action := CASE
        WHEN NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN 'verified'
        WHEN NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN 'rejected'
        WHEN NEW.status = 'expired'  AND OLD.status IS DISTINCT FROM 'expired'  THEN 'expired'
        ELSE 'updated' END;
    END IF;

  ELSIF TG_TABLE_NAME = 'invoice_document_requests' THEN
    v_entity := 'document_request'; v_invoice := NEW.invoice_id; v_reason := NEW.reason;
    SELECT i.exporter_id INTO v_exporter FROM public.v2_invoices i WHERE i.id = NEW.invoice_id;
    IF TG_OP = 'INSERT' THEN
      v_action := 'requested';
      v_after := jsonb_build_object('status', NEW.status, 'due_date', NEW.due_date, 'document_type_id', NEW.document_type_id);
    ELSE
      v_before := jsonb_build_object('status', OLD.status);
      v_after  := jsonb_build_object('status', NEW.status, 'fulfilled_by_document_id', NEW.fulfilled_by_document_id);
      v_action := CASE
        WHEN NEW.status = 'fulfilled' AND OLD.status IS DISTINCT FROM 'fulfilled' THEN 'fulfilled'
        WHEN NEW.status = 'withdrawn' AND OLD.status IS DISTINCT FROM 'withdrawn' THEN 'withdrawn'
        ELSE 'updated' END;
    END IF;

  ELSE -- board_resolutions
    v_entity := 'board_resolution'; v_exporter := NEW.exporter_id;
    IF TG_OP = 'INSERT' THEN
      v_action := 'resolution_created';
      v_after := jsonb_build_object('authorised_limit', NEW.authorised_limit, 'limit_currency', NEW.limit_currency,
                                    'limit_basis', NEW.limit_basis, 'valid_from', NEW.valid_from, 'valid_until', NEW.valid_until,
                                    'verification_status', NEW.verification_status);
    ELSE
      v_before := jsonb_build_object('authorised_limit', OLD.authorised_limit, 'limit_basis', OLD.limit_basis,
                                     'valid_until', OLD.valid_until, 'verification_status', OLD.verification_status, 'superseded_by', OLD.superseded_by);
      v_after  := jsonb_build_object('authorised_limit', NEW.authorised_limit, 'limit_basis', NEW.limit_basis,
                                     'valid_until', NEW.valid_until, 'verification_status', NEW.verification_status, 'superseded_by', NEW.superseded_by);
      v_action := CASE
        WHEN NEW.superseded_by IS NOT NULL AND OLD.superseded_by IS NULL THEN 'resolution_replaced'
        WHEN NEW.verification_status = 'verified' AND OLD.verification_status IS DISTINCT FROM 'verified' THEN 'verified'
        WHEN NEW.verification_status = 'rejected' AND OLD.verification_status IS DISTINCT FROM 'rejected' THEN 'rejected'
        WHEN NEW.verification_status = 'expired'  AND OLD.verification_status IS DISTINCT FROM 'expired'  THEN 'expired'
        ELSE 'updated' END;
    END IF;
  END IF;

  PERFORM public.v2_audit_write(v_entity, NEW.id, v_action, v_invoice, v_exporter, v_reason,
    jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME, 'before', v_before, 'after', v_after));
  RETURN NEW;
END $$;

-- ============ 2. NOTIFICATION TEMPLATES ============

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','in_app')),
  subject text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'exporter' CHECK (audience IN ('exporter','staff')),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_tpl_select_staff" ON public.notification_templates FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()));
CREATE POLICY "notif_tpl_write_super" ON public.notification_templates FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(),'super_admin'::public.v2_app_role))
  WITH CHECK (public.has_app_role(auth.uid(),'super_admin'::public.v2_app_role));

CREATE TRIGGER trg_notification_templates_updated BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- template renderer
CREATE OR REPLACE FUNCTION public.v2_render_template(p_text text, p_vars jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE k text; out text := COALESCE(p_text,'');
BEGIN
  FOR k IN SELECT jsonb_object_keys(COALESCE(p_vars,'{}'::jsonb)) LOOP
    out := replace(out, '{{' || k || '}}', COALESCE(p_vars->>k, ''));
  END LOOP;
  RETURN regexp_replace(out, '\{\{[a-zA-Z0-9_]+\}\}', '', 'g');
END $$;

CREATE OR REPLACE FUNCTION public.v2_email_shell(p_title text, p_body_html text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT '<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Helvetica,Arial,sans-serif;">'
    || '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    || '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;">'
    || '<tr><td style="background:#0B3D2E;padding:24px 32px;text-align:center;"><span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.02em;">VELOXIS</span></td></tr>'
    || '<tr><td style="padding:32px;color:#1a1a1a;font-size:16px;line-height:24px;">'
    || '<h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">' || COALESCE(p_title,'') || '</h1>'
    || COALESCE(p_body_html,'')
    || '</td></tr>'
    || '<tr><td style="background:#f3f4f6;padding:24px 32px;text-align:center;color:#6b7280;font-size:12px;line-height:18px;">'
    || 'Veloxis Ltd, Exeter Business Park, 1 Emperor Way, Exeter, EX1 3QS<br/>support@veloxis.co.uk</td></tr>'
    || '</table></td></tr></table></body></html>'
$$;

-- send via template: in app notification plus queued branded email
CREATE OR REPLACE FUNCTION public.v2_send_notification(
  p_key text, p_user_id uuid, p_vars jsonb DEFAULT '{}'::jsonb,
  p_link text DEFAULT NULL, p_type text DEFAULT 'info',
  p_invoice_id uuid DEFAULT NULL, p_exporter_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t RECORD; v_email text; v_subject text; v_body text; v_msg uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO t FROM public.notification_templates WHERE key = p_key AND channel = 'in_app' AND active LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_user_id,
            public.v2_render_template(t.subject, p_vars),
            public.v2_render_template(t.body, p_vars),
            p_type, p_link);
  END IF;

  SELECT * INTO t FROM public.notification_templates WHERE key = p_key AND channel = 'email' AND active LIMIT 1;
  IF FOUND THEN
    SELECT email INTO v_email FROM public.profiles WHERE user_id = p_user_id;
    IF v_email IS NOT NULL AND v_email <> ''
       AND NOT EXISTS (SELECT 1 FROM public.suppressed_emails WHERE email = lower(v_email)) THEN
      v_subject := public.v2_render_template(t.subject, p_vars);
      v_body := public.v2_email_shell(v_subject, public.v2_render_template(t.body, p_vars));
      v_msg := gen_random_uuid();
      BEGIN
        PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
          'message_id', v_msg, 'to', v_email,
          'from', 'Veloxis <noreply@notify.www.veloxis.co.uk>',
          'sender_domain', 'notify.www.veloxis.co.uk',
          'subject', v_subject, 'html', v_body, 'text', v_subject,
          'purpose', 'transactional', 'label', p_key,
          'idempotency_key', v_msg::text, 'queued_at', now()
        ));
        INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status)
        VALUES (v_msg, p_key, v_email, 'pending');
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'v2_send_notification email enqueue failed for %: %', p_key, SQLERRM;
      END;
    END IF;
  END IF;

  PERFORM public.v2_audit_write('notification', COALESCE(p_invoice_id, p_user_id), 'notification_sent',
    p_invoice_id, p_exporter_id, NULL, jsonb_build_object('template_key', p_key, 'vars', p_vars));
END $$;

-- helper: staff recipients by role
CREATE OR REPLACE FUNCTION public.v2_users_with_role(_role v2_app_role)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT user_id FROM public.app_user_roles WHERE role = _role
$$;

CREATE OR REPLACE FUNCTION public.v2_notify_role(
  _role v2_app_role, p_key text, p_vars jsonb, p_link text DEFAULT NULL, p_type text DEFAULT 'info',
  p_invoice_id uuid DEFAULT NULL, p_exporter_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT public.v2_users_with_role(_role) LOOP
    PERFORM public.v2_send_notification(p_key, u, p_vars, p_link, p_type, p_invoice_id, p_exporter_id);
  END LOOP;
END $$;

-- ============ 3. STATUS / SLA / GUARD AUDIT + NOTIFICATIONS ============

CREATE OR REPLACE FUNCTION public.v2_invoice_audit_and_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_owner uuid; v_ref text; v_docs text; v_sig_ok boolean; v_res RECORD;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  v_ref := COALESCE(NEW.reference, NEW.invoice_number);
  SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = NEW.exporter_id;

  PERFORM public.v2_audit_write('invoice', NEW.id, 'status_changed', NEW.id, NEW.exporter_id, NULL,
    jsonb_build_object('before', jsonb_build_object('status', OLD.status),
                       'after',  jsonb_build_object('status', NEW.status)));

  IF NEW.status::text = 'submitted' AND OLD.status::text IN ('draft','returned_for_revision') THEN
    SELECT COALESCE(string_agg(dt.label, ', ' ORDER BY dt.label), 'no documents')
      INTO v_docs
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

    -- signatory mismatch check
    IF NEW.signatory_id IS NOT NULL AND NEW.board_resolution_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.authorised_signatories s
                     WHERE s.id = NEW.signatory_id AND s.board_resolution_id = NEW.board_resolution_id)
        INTO v_sig_ok;
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
      jsonb_build_object('reference', v_ref, 'outcome', replace(NEW.status::text,'_',' ')),
      '/portal/invoices/' || NEW.id::text,
      CASE WHEN NEW.status::text IN ('verified','approved') THEN 'success' ELSE 'warning' END,
      NEW.id, NEW.exporter_id);
  END IF;

  IF NEW.status::text = 'verified' AND OLD.status::text IS DISTINCT FROM 'verified' THEN
    SELECT COALESCE(string_agg(dt.label, ', ' ORDER BY dt.label), 'the remaining documents') INTO v_docs
    FROM public.document_types dt WHERE dt.stage = 2 AND dt.is_mandatory AND dt.active;
    PERFORM public.v2_send_notification('stage1_approved', v_owner,
      jsonb_build_object('reference', v_ref, 'stage2_documents', v_docs),
      '/portal/invoices/' || NEW.id::text, 'action_required', NEW.id, NEW.exporter_id);
  END IF;

  IF NEW.status::text = 'overdue' AND OLD.status::text IS DISTINCT FROM 'overdue' THEN
    PERFORM public.v2_notify_role('credit_officer'::public.v2_app_role, 'staff_invoice_overdue',
      jsonb_build_object('reference', v_ref), '/app/invoices/' || NEW.id::text, 'warning', NEW.id, NEW.exporter_id);
  END IF;

  -- retention stamp on settlement
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

-- duplicate + headroom guards
CREATE OR REPLACE FUNCTION public.v2_invoice_guards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_dupe uuid; h RECORD; v_gbp numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_dupe FROM public.v2_invoices
      WHERE exporter_id = NEW.exporter_id AND invoice_number = NEW.invoice_number AND id <> NEW.id LIMIT 1;
    IF v_dupe IS NOT NULL THEN
      PERFORM public.v2_audit_write('invoice', COALESCE(NEW.id, v_dupe), 'duplicate_blocked', v_dupe, NEW.exporter_id,
        'An application with this invoice number already exists',
        jsonb_build_object('invoice_number', NEW.invoice_number, 'existing_invoice_id', v_dupe));
      RAISE EXCEPTION 'An application with invoice number % already exists for this exporter', NEW.invoice_number
        USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status::text = 'submitted' AND OLD.status::text IS DISTINCT FROM 'submitted' THEN
    SELECT * INTO h FROM public.exporter_headroom(NEW.exporter_id);
    IF h.authorised_limit IS NOT NULL THEN
      v_gbp := NEW.invoice_amount * COALESCE(NEW.fx_rate_to_gbp, 1) * (NEW.advance_rate / 100.0);
      IF v_gbp > COALESCE(h.headroom, 0) THEN
        PERFORM public.v2_audit_write('invoice', NEW.id, 'limit_breach_blocked', NEW.id, NEW.exporter_id,
          'Requested advance exceeds the authorised limit remaining on the board resolution',
          jsonb_build_object('requested_gbp', v_gbp, 'headroom_gbp', h.headroom, 'authorised_limit', h.authorised_limit));
        PERFORM public.v2_notify_role('credit_officer'::public.v2_app_role, 'staff_headroom_breach',
          jsonb_build_object('reference', COALESCE(NEW.reference, NEW.invoice_number)),
          '/app/invoices/' || NEW.id::text, 'warning', NEW.id, NEW.exporter_id);
        RAISE EXCEPTION 'This application exceeds the authorised limit remaining on the board resolution'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_invoice_audit_notify ON public.v2_invoices;
CREATE TRIGGER trg_v2_invoice_audit_notify AFTER UPDATE ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.v2_invoice_audit_and_notify();

DROP TRIGGER IF EXISTS trg_v2_invoice_guards ON public.v2_invoices;
CREATE TRIGGER trg_v2_invoice_guards BEFORE INSERT OR UPDATE ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.v2_invoice_guards();

-- SLA pause / resume audit
CREATE OR REPLACE FUNCTION public.v2_sla_pause(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD; v_started timestamptz;
BEGIN
  SELECT * INTO r FROM public.v2_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR r.sla_paused_at IS NOT NULL THEN RETURN; END IF;
  v_started := COALESCE(r.sla_clock_started_at, r.created_at);
  UPDATE public.v2_invoices
  SET sla_elapsed_seconds = COALESCE(sla_elapsed_seconds,0) + GREATEST(0, EXTRACT(EPOCH FROM (now() - v_started))::int),
      sla_paused_at = now()
  WHERE id = p_invoice_id;
  PERFORM public.v2_audit_write('invoice', p_invoice_id, 'sla_paused', p_invoice_id, r.exporter_id,
    'Decision clock paused while information is outstanding',
    jsonb_build_object('before', jsonb_build_object('sla_paused_at', r.sla_paused_at, 'sla_elapsed_seconds', r.sla_elapsed_seconds),
                       'after', jsonb_build_object('sla_paused_at', now())));
END $$;

CREATE OR REPLACE FUNCTION public.v2_sla_resume(p_invoice_id uuid)
RETURNS timestamp with time zone LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  PERFORM public.v2_audit_write('invoice', p_invoice_id, 'sla_resumed', p_invoice_id, r.exporter_id,
    'Decision clock resumed',
    jsonb_build_object('before', jsonb_build_object('decision_due_at', r.decision_due_at, 'sla_paused_at', r.sla_paused_at),
                       'after', jsonb_build_object('decision_due_at', v_due, 'sla_paused_at', NULL)));
  RETURN v_due;
END $$;

-- ============ 4. RETENTION ============
ALTER TABLE public.invoice_documents ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz;
ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz;

-- ============ 5. EXPIRY JOB ============
CREATE OR REPLACE FUNCTION public.run_document_expiry_job()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  rec RECORD; v_owner uuid;
  v_docs int := 0; v_res int := 0; v_warn int := 0; v_flag int := 0;
BEGIN
  -- expire company documents
  FOR rec IN
    SELECT cd.id, cd.exporter_id, cd.valid_until, dt.label
    FROM public.company_documents cd JOIN public.document_types dt ON dt.id = cd.document_type_id
    WHERE cd.valid_until IS NOT NULL AND cd.valid_until < v_today AND cd.status <> 'expired'
  LOOP
    UPDATE public.company_documents SET status = 'expired' WHERE id = rec.id;
    v_docs := v_docs + 1;
  END LOOP;

  -- expire board resolutions
  FOR rec IN
    SELECT br.id, br.exporter_id, br.valid_until
    FROM public.board_resolutions br
    WHERE br.valid_until IS NOT NULL AND br.valid_until < v_today
      AND br.verification_status <> 'expired'
  LOOP
    UPDATE public.board_resolutions SET verification_status = 'expired' WHERE id = rec.id;
    v_res := v_res + 1;

    FOR v_owner IN
      SELECT i.id FROM public.v2_invoices i
      WHERE i.board_resolution_id = rec.id AND i.status::text NOT IN ('funded','monitoring','settled','rejected','defaulted')
    LOOP
      PERFORM public.v2_audit_write('invoice', v_owner, 'expired', v_owner, rec.exporter_id,
        'Board resolution relied on by this application has expired',
        jsonb_build_object('board_resolution_id', rec.id, 'valid_until', rec.valid_until));
      v_flag := v_flag + 1;
    END LOOP;

    SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = rec.exporter_id;
    PERFORM public.v2_send_notification('resolution_expired', v_owner,
      jsonb_build_object('expiry_date', to_char(rec.valid_until,'DD Mon YYYY')),
      '/portal/profile', 'action_required', NULL, rec.exporter_id);
  END LOOP;

  -- warnings at 30 and 7 days
  FOR rec IN
    SELECT br.id, br.exporter_id, br.valid_until, (br.valid_until - v_today) AS days
    FROM public.board_resolutions br
    WHERE br.verification_status = 'verified'
      AND br.valid_until IS NOT NULL
      AND (br.valid_until - v_today) IN (30, 7)
  LOOP
    SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = rec.exporter_id;
    PERFORM public.v2_send_notification('resolution_expiring', v_owner,
      jsonb_build_object('days', rec.days::text, 'expiry_date', to_char(rec.valid_until,'DD Mon YYYY')),
      '/portal/profile', 'warning', NULL, rec.exporter_id);
    PERFORM public.v2_audit_write('board_resolution', rec.id, 'updated', NULL, rec.exporter_id,
      'Expiry warning issued', jsonb_build_object('days_remaining', rec.days));
    v_warn := v_warn + 1;
  END LOOP;

  RETURN jsonb_build_object('documents_expired', v_docs, 'resolutions_expired', v_res,
                            'invoices_flagged', v_flag, 'warnings_sent', v_warn, 'ran_for', v_today);
END $$;

SELECT cron.schedule('document-expiry-job', '0 2 * * *', $cron$ SELECT public.run_document_expiry_job(); $cron$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'document-expiry-job');

-- ============ 6. SEED TEMPLATES ============
INSERT INTO public.notification_templates (key, channel, audience, subject, body, description) VALUES
('submission_received','in_app','exporter','Application {{reference}} received','We have received your application {{reference}}. Expected payment date {{maturity_date}}. Decision due by {{decision_due}}. Documents uploaded: {{documents}}.','Exporter submission acknowledgement'),
('submission_received','email','exporter','We have received application {{reference}}','<p>Thank you. Your application <strong>{{reference}}</strong> has been received.</p><p>Expected payment date: <strong>{{maturity_date}}</strong><br/>Decision due by: <strong>{{decision_due}}</strong></p><p>Documents uploaded with this application: {{documents}}.</p>','Exporter submission acknowledgement'),
('document_rejected','in_app','exporter','A document was returned','{{document_label}} on {{reference}} was not accepted. Reviewer reason: "{{reason}}". Please upload a replacement.','Document rejected'),
('document_rejected','email','exporter','Action needed on {{document_label}}','<p>The <strong>{{document_label}}</strong> supplied with application <strong>{{reference}}</strong> was not accepted.</p><p>Reviewer reason, quoted in full: "{{reason}}"</p><p><a href="{{link}}">Upload a replacement document</a></p>','Document rejected'),
('documents_requested','in_app','exporter','Documents requested on {{reference}}','{{document_list}} Your decision clock is paused until these are supplied. Once you upload them, we will issue a decision within the remaining time on your review window.','Documents requested'),
('documents_requested','email','exporter','Documents requested on {{reference}}','<p>We need the following before we can continue with <strong>{{reference}}</strong>:</p>{{document_list}}<p>Your decision clock is paused until these are supplied. Once you upload them, we will issue a decision within the remaining time on your review window.</p><p><a href="{{link}}">Upload documents</a></p>','Documents requested'),
('stage1_approved','in_app','exporter','Stage 1 approved on {{reference}}','Stage 1 is approved and Stage 2 is now unlocked. Documents now required: {{stage2_documents}}.','Stage 1 approved'),
('stage1_approved','email','exporter','Stage 1 approved on {{reference}}','<p>Stage 1 of application <strong>{{reference}}</strong> has been approved and Stage 2 is now unlocked.</p><p>Documents now required: {{stage2_documents}}.</p>','Stage 1 approved'),
('resolution_verified','in_app','exporter','Board resolution verified','Authorised limit {{limit}} on a {{basis}} basis, expiring {{expiry}}. If any of these details are wrong, tell us before you submit an invoice.','Board resolution verified'),
('resolution_verified','email','exporter','Your board resolution has been verified','<p>We have transcribed your board resolution as follows.</p><p>Authorised limit: <strong>{{limit}}</strong><br/>Basis: <strong>{{basis}}</strong><br/>Expires: <strong>{{expiry}}</strong></p><p>If any of these details are wrong, tell us before you submit an invoice.</p>','Board resolution verified'),
('resolution_expiring','in_app','exporter','Board resolution expires in {{days}} days','Your board resolution expires on {{expiry_date}}. Please supply a refreshed resolution.','Board resolution expiry warning'),
('resolution_expiring','email','exporter','Your board resolution expires in {{days}} days','<p>Your board resolution expires on <strong>{{expiry_date}}</strong>, {{days}} days from today.</p><p>Please supply a refreshed resolution so your account stays in good standing.</p>','Board resolution expiry warning'),
('resolution_expired','in_app','exporter','Board resolution expired','Your board resolution expired on {{expiry_date}}. New applications cannot proceed until a refreshed resolution is verified.','Board resolution expired'),
('resolution_expired','email','exporter','Your board resolution has expired','<p>Your board resolution expired on <strong>{{expiry_date}}</strong>.</p><p>New applications cannot proceed until a refreshed resolution is supplied and verified.</p>','Board resolution expired'),
('decision_issued','in_app','exporter','Decision issued on {{reference}}','A decision has been issued on {{reference}}. Outcome: {{outcome}}.','Decision issued'),
('decision_issued','email','exporter','Decision issued on {{reference}}','<p>A decision has been issued on application <strong>{{reference}}</strong>.</p><p>Outcome: <strong>{{outcome}}</strong>.</p><p><a href="{{link}}">View your application</a></p>','Decision issued'),
('staff_new_submission','in_app','staff','New submission ready for review','{{reference}} is ready for review. Decision due by {{decision_due}}.','Internal, new submission'),
('staff_new_submission','email','staff','New submission ready for review: {{reference}}','<p><strong>{{reference}}</strong> has been submitted and is ready for review.</p><p>Decision due by {{decision_due}}.</p>','Internal, new submission'),
('staff_request_fulfilled','in_app','staff','Requested documents fulfilled','All documents you requested on {{reference}} have been supplied.','Internal, request fulfilled'),
('staff_request_fulfilled','email','staff','Requested documents fulfilled on {{reference}}','<p>All documents you requested on <strong>{{reference}}</strong> have now been supplied and the decision clock has resumed.</p>','Internal, request fulfilled'),
('staff_sla_at_risk','in_app','staff','SLA at risk on {{reference}}','Under four working hours remain on {{reference}}. Decision due {{decision_due}}.','Internal, SLA at risk'),
('staff_sla_at_risk','email','staff','SLA at risk on {{reference}}','<p>Under four working hours remain on <strong>{{reference}}</strong>.</p><p>Decision due {{decision_due}}.</p>','Internal, SLA at risk'),
('staff_signatory_mismatch','in_app','staff','Signatory mismatch on {{reference}}','The signatory selected on {{reference}} is not named on the verified board resolution.','Internal, signatory mismatch'),
('staff_signatory_mismatch','email','staff','Signatory mismatch on {{reference}}','<p>The signatory selected on <strong>{{reference}}</strong> is not named on the verified board resolution.</p>','Internal, signatory mismatch'),
('staff_headroom_breach','in_app','staff','Headroom breach attempt on {{reference}}','An attempt to submit {{reference}} exceeded the authorised limit remaining on the board resolution.','Internal, headroom breach'),
('staff_headroom_breach','email','staff','Headroom breach attempt on {{reference}}','<p>An attempt to submit <strong>{{reference}}</strong> exceeded the authorised limit remaining on the board resolution.</p>','Internal, headroom breach'),
('staff_invoice_overdue','in_app','staff','{{reference}} is overdue','{{reference}} has passed its expected payment date and is now overdue.','Internal, overdue'),
('staff_invoice_overdue','email','staff','{{reference}} is overdue','<p><strong>{{reference}}</strong> has passed its expected payment date and is now overdue.</p>','Internal, overdue'),
('staff_escalation_advanced','in_app','staff','Escalation advanced on {{reference}}','{{reference}} has moved to escalation stage {{stage}} at {{days}} days past the expected payment date.','Internal, escalation'),
('staff_escalation_advanced','email','staff','Escalation advanced on {{reference}}','<p><strong>{{reference}}</strong> has moved to escalation stage <strong>{{stage}}</strong> at {{days}} days past the expected payment date.</p>','Internal, escalation')
ON CONFLICT (key, channel) DO NOTHING;