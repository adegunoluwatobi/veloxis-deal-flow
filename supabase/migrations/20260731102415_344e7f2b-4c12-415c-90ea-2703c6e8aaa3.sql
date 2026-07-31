
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS counsel_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS counsel_approved_by uuid,
  ADD COLUMN IF NOT EXISTS counsel_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS counsel_reference text;

-- audit vocabulary
ALTER TABLE public.document_audit_log DROP CONSTRAINT IF EXISTS document_audit_log_action_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_action_check CHECK (action = ANY (ARRAY[
 'uploaded','replaced','verified','rejected','requested','fulfilled','withdrawn','expired','override_applied','viewed',
 'escalation_advanced','maturity_date_changed','reference_data_changed','limit_breach_blocked','duplicate_blocked',
 'signatory_mismatch_flagged','resolution_created','resolution_replaced','status_changed','sla_paused','sla_resumed',
 'created','updated','superseded','retention_set','notification_sent','notification_failed','scan_status_changed',
 'document_generated','signature_requested','signature_completed','signature_declined','notice_served',
 'template_version_created','template_counsel_approved','esignature_mode_changed','webhook_rejected']));

ALTER TABLE public.document_audit_log DROP CONSTRAINT IF EXISTS document_audit_log_entity_type_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_entity_type_check CHECK (entity_type = ANY (ARRAY[
 'invoice_document','company_document','document_request','board_resolution','document_type','commodity',
 'regulated_commodity','system_config','invoice','exporter','notification','document_template','signature_request',
 'security_event']));

-- config
INSERT INTO public.v2_system_config (key, value, description)
VALUES ('esignature_mode', '"test"'::jsonb, 'Electronic signature mode: test or production')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.v2_system_config (key, value, description)
VALUES ('esignature_test_email', '""'::jsonb, 'Internal email address that receives all signature requests while in test mode')
ON CONFLICT (key) DO NOTHING;

-- counsel approval RPC
CREATE OR REPLACE FUNCTION public.approve_template_counsel(p_template_id uuid, p_counsel_reference text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin may record counsel approval';
  END IF;
  IF coalesce(btrim(p_counsel_reference), '') = '' THEN
    RAISE EXCEPTION 'A counsel reference is required to record counsel approval';
  END IF;

  UPDATE public.document_templates
     SET counsel_approved = true,
         counsel_approved_by = auth.uid(),
         counsel_approved_at = now(),
         counsel_reference = btrim(p_counsel_reference)
   WHERE id = p_template_id
   RETURNING code INTO v_code;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  INSERT INTO public.document_audit_log (entity_type, entity_id, action, actor_id, actor_role, metadata)
  VALUES ('document_template', p_template_id, 'template_counsel_approved', auth.uid(), 'super_admin',
          jsonb_build_object('code', v_code, 'counsel_reference', btrim(p_counsel_reference)));
END;
$$;

REVOKE ALL ON FUNCTION public.approve_template_counsel(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_template_counsel(uuid, text) TO authenticated;

-- e-signature mode RPC
CREATE OR REPLACE FUNCTION public.set_esignature_mode(p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pending int; v_before text;
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin may change the electronic signature mode';
  END IF;
  IF p_mode NOT IN ('test','production') THEN
    RAISE EXCEPTION 'Mode must be test or production';
  END IF;

  IF p_mode = 'production' THEN
    SELECT count(*) INTO v_pending FROM public.document_templates
      WHERE active AND NOT counsel_approved;
    IF v_pending > 0 THEN
      RAISE EXCEPTION 'Every template must be approved by counsel before production signing can be enabled';
    END IF;
  END IF;

  SELECT trim(both '"' from value::text) INTO v_before FROM public.v2_system_config WHERE key = 'esignature_mode';

  INSERT INTO public.v2_system_config (key, value, description)
  VALUES ('esignature_mode', to_jsonb(p_mode), 'Electronic signature mode: test or production')
  ON CONFLICT (key) DO UPDATE SET value = excluded.value;

  INSERT INTO public.document_audit_log (entity_type, entity_id, action, actor_id, actor_role, metadata)
  VALUES ('system_config', gen_random_uuid(), 'esignature_mode_changed', auth.uid(), 'super_admin',
          jsonb_build_object('before', jsonb_build_object('mode', v_before), 'after', jsonb_build_object('mode', p_mode)));
END;
$$;

REVOKE ALL ON FUNCTION public.set_esignature_mode(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_esignature_mode(text) TO authenticated;

-- new template versions must be re-approved by counsel
CREATE OR REPLACE FUNCTION public.reset_counsel_on_new_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.counsel_approved := false;
  NEW.counsel_approved_by := NULL;
  NEW.counsel_approved_at := NULL;
  NEW.counsel_reference := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_counsel_on_new_version ON public.document_templates;
CREATE TRIGGER trg_reset_counsel_on_new_version
BEFORE INSERT ON public.document_templates
FOR EACH ROW EXECUTE FUNCTION public.reset_counsel_on_new_version();
