
-- 1. TEMPLATES ---------------------------------------------------------------
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  label text NOT NULL,
  description text,
  body text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);
CREATE UNIQUE INDEX document_templates_one_active_per_code
  ON public.document_templates (code) WHERE active;

GRANT SELECT ON public.document_templates TO authenticated;
GRANT INSERT, UPDATE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read templates" ON public.document_templates
  FOR SELECT TO authenticated USING (public.is_v2_staff(auth.uid()));
CREATE POLICY "Super admin can create templates" ON public.document_templates
  FOR INSERT TO authenticated WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));
CREATE POLICY "Super admin can update templates" ON public.document_templates
  FOR UPDATE TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role))
  WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));

CREATE TRIGGER trg_document_templates_updated
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.document_templates (code, label, description, body) VALUES
('notice_of_assignment', 'Notice of assignment',
 'Addressed to the buyer. Signed by the exporter authorised signatory and countersigned by Veloxis.',
$T$Awaiting counsel approved wording. Do not use in production.

NOTICE OF ASSIGNMENT

Date: {{today_date}}

To: {{buyer_legal_name}}
{{buyer_registered_address}}
Company number: {{buyer_company_number}}

Invoice reference: {{invoice_reference}}
Invoice number: {{invoice_number}}
Gross invoice value: {{currency}} {{gross_invoice_value}}
Agreed deductions: {{currency}} {{agreed_deductions}}
Maturity date: {{maturity_date}}
Incoterm: {{incoterm}}
Commodity: {{commodity}}
Bill of lading: {{bl_number}} dated {{bl_date}}
Port of loading: {{port_of_loading}}
Port of discharge: {{port_of_discharge}}

We, {{exporter_legal_name}} (RC {{exporter_rc_number}}) of {{exporter_registered_address}}, give you notice that all present and future rights to payment under the invoice above have been assigned. All payment must be made to the account below and to no other account.

{{domiciliary_account_details}}

Signed for and on behalf of {{exporter_legal_name}}

{{signatory_name}}
{{signatory_position}}
$T$),
('deed_of_assignment', 'Deed of assignment',
 'Executed between the exporter and Veloxis. Signed by the exporter authorised signatory and the Veloxis approver.',
$T$Awaiting counsel approved wording. Do not use in production.

DEED OF ASSIGNMENT

Date: {{today_date}}

Assignor: {{exporter_legal_name}} (RC {{exporter_rc_number}}) of {{exporter_registered_address}}
Assignee: Veloxis

Invoice reference: {{invoice_reference}}
Invoice number: {{invoice_number}}
Buyer: {{buyer_legal_name}}, {{buyer_registered_address}}, company number {{buyer_company_number}}
Gross invoice value: {{currency}} {{gross_invoice_value}}
Agreed deductions: {{currency}} {{agreed_deductions}}
Advance amount: {{currency}} {{advance_amount}}
Holdback amount: {{currency}} {{holdback_amount}}
Maturity date: {{maturity_date}}
Commodity: {{commodity}}, incoterm {{incoterm}}
Bill of lading: {{bl_number}} dated {{bl_date}}, {{port_of_loading}} to {{port_of_discharge}}

The assignor assigns absolutely to the assignee all rights, title and interest in the receivable described above.

Executed as a deed by {{exporter_legal_name}}

{{signatory_name}}
{{signatory_position}}

Executed by Veloxis
$T$),
('domiciliation_instruction', 'Domiciliation instruction',
 'Addressed to the bank. Signed by the exporter authorised signatory.',
$T$Awaiting counsel approved wording. Do not use in production.

DOMICILIATION INSTRUCTION

Date: {{today_date}}

To: The Manager

From: {{exporter_legal_name}} (RC {{exporter_rc_number}})
{{exporter_registered_address}}

Invoice reference: {{invoice_reference}}
Invoice number: {{invoice_number}}
Buyer: {{buyer_legal_name}}
Gross invoice value: {{currency}} {{gross_invoice_value}}
Maturity date: {{maturity_date}}
Bill of lading: {{bl_number}} dated {{bl_date}}

We irrevocably instruct you to domicile the proceeds of the export transaction described above to the account below and to accept no contrary instruction without the written consent of the assignee.

{{domiciliary_account_details}}

Signed for and on behalf of {{exporter_legal_name}}

{{signatory_name}}
{{signatory_position}}
$T$);

-- 2. GENERATED DOCUMENT PROVENANCE -------------------------------------------
ALTER TABLE public.invoice_documents
  ADD COLUMN source text NOT NULL DEFAULT 'exporter_upload'
    CHECK (source IN ('exporter_upload','veloxis_generated')),
  ADD COLUMN template_id uuid REFERENCES public.document_templates(id),
  ADD COLUMN template_version integer;

ALTER TABLE public.document_types
  ADD COLUMN IF NOT EXISTS generated boolean NOT NULL DEFAULT false;

UPDATE public.document_types SET generated = true
  WHERE level = 'invoice' AND code IN ('notice_of_assignment','deed_of_assignment','domiciliation_instruction');

-- the exporter no longer supplies the buyer acknowledgement
UPDATE public.document_types SET requirement = 'optional'
  WHERE level = 'invoice' AND code = 'buyer_acknowledgement';

-- 3. SIGNATURE ROUTING --------------------------------------------------------
CREATE TABLE public.invoice_signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.v2_invoices(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.invoice_documents(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'hellosign',
  provider_request_id text,
  signer_role text NOT NULL,
  signer_name text,
  signer_email text,
  status text NOT NULL DEFAULT 'not_sent'
    CHECK (status IN ('not_sent','sent','viewed','signed','declined','expired')),
  sent_at timestamptz,
  completed_at timestamptz,
  certificate_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_isr_invoice ON public.invoice_signature_requests(invoice_id);
CREATE INDEX idx_isr_provider_request ON public.invoice_signature_requests(provider_request_id);

GRANT SELECT ON public.invoice_signature_requests TO authenticated;
GRANT ALL ON public.invoice_signature_requests TO service_role;
ALTER TABLE public.invoice_signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read signature requests" ON public.invoice_signature_requests
  FOR SELECT TO authenticated USING (public.is_v2_staff(auth.uid()));
CREATE POLICY "Exporter can read own signature requests" ON public.invoice_signature_requests
  FOR SELECT TO authenticated USING (public.v2_owns_invoice(auth.uid(), invoice_id));

CREATE TRIGGER trg_isr_updated
  BEFORE UPDATE ON public.invoice_signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. NOTICE SERVICE -----------------------------------------------------------
ALTER TABLE public.v2_invoices
  ADD COLUMN notice_served_at timestamptz,
  ADD COLUMN notice_served_method text,
  ADD COLUMN notice_served_by uuid;

-- 5. AUDIT ACTIONS ------------------------------------------------------------
ALTER TABLE public.document_audit_log DROP CONSTRAINT document_audit_log_action_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'uploaded','replaced','verified','rejected','requested','documents_requested','fulfilled',
    'withdrawn','request_withdrawn','expired','override_applied','viewed','created','updated',
    'superseded','reference_data_changed','escalation_advanced','maturity_date_changed',
    'limit_breach_blocked','duplicate_blocked','signatory_mismatch_flagged','resolution_created',
    'resolution_replaced','status_changed','sla_paused','sla_resumed','retention_set',
    'notification_sent','scan_status_changed','notification_failed',
    'document_generated','signature_requested','signature_completed','signature_declined',
    'notice_served','template_version_created']));

ALTER TABLE public.document_audit_log DROP CONSTRAINT document_audit_log_entity_type_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_entity_type_check
  CHECK (entity_type = ANY (ARRAY[
    'invoice_document','company_document','document_request','board_resolution','document_type',
    'commodity','regulated_commodity','system_config','invoice','exporter','notification',
    'document_template','signature_request']));

-- 6. TEMPLATE VERSIONING RPC --------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_template_version(p_code text, p_body text, p_label text DEFAULT NULL, p_description text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); cur RECORD; v_new uuid; v_ver integer;
BEGIN
  IF v_uid IS NULL OR NOT public.has_app_role(v_uid,'super_admin'::public.v2_app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin may edit document templates' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_body IS NULL OR length(btrim(p_body)) < 20 THEN
    RAISE EXCEPTION 'The template body is too short' USING ERRCODE='check_violation';
  END IF;

  SELECT * INTO cur FROM public.document_templates WHERE code = p_code AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template not found' USING ERRCODE='no_data_found'; END IF;

  SELECT COALESCE(max(version),0) + 1 INTO v_ver FROM public.document_templates WHERE code = p_code;

  UPDATE public.document_templates SET active = false WHERE id = cur.id;

  INSERT INTO public.document_templates (code, label, description, body, version, active, created_by)
  VALUES (p_code, COALESCE(p_label, cur.label), COALESCE(p_description, cur.description), p_body, v_ver, true, v_uid)
  RETURNING id INTO v_new;

  INSERT INTO public.document_audit_log (entity_type, entity_id, action, actor_id, actor_role, metadata)
  VALUES ('document_template', v_new, 'template_version_created', v_uid, public.v2_actor_role(v_uid),
    jsonb_build_object('code', p_code,
      'before', jsonb_build_object('version', cur.version),
      'after',  jsonb_build_object('version', v_ver)));

  RETURN v_new;
END $$;

-- 7. MARK NOTICE SERVED -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_mark_notice_served(p_invoice_id uuid, p_method text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_exporter uuid;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_app_role(v_uid,'approver'::public.v2_app_role)
      OR public.has_app_role(v_uid,'super_admin'::public.v2_app_role)
      OR public.has_app_role(v_uid,'credit_officer'::public.v2_app_role)) THEN
    RAISE EXCEPTION 'You are not permitted to record service of the notice' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_method IS NULL OR length(btrim(p_method)) < 3 THEN
    RAISE EXCEPTION 'Record how the notice was served' USING ERRCODE='check_violation';
  END IF;

  UPDATE public.v2_invoices
  SET notice_served_at = now(), notice_served_method = btrim(p_method), notice_served_by = v_uid
  WHERE id = p_invoice_id
  RETURNING exporter_id INTO v_exporter;

  IF v_exporter IS NULL THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='no_data_found'; END IF;

  INSERT INTO public.document_audit_log (entity_type, entity_id, invoice_id, exporter_id, action, actor_id, actor_role, metadata)
  VALUES ('invoice', p_invoice_id, p_invoice_id, v_exporter, 'notice_served', v_uid, public.v2_actor_role(v_uid),
    jsonb_build_object('after', jsonb_build_object('served_method', btrim(p_method), 'served_at', now())));
END $$;

-- 8. AUTOMATIC GENERATION ON APPROVAL -----------------------------------------
CREATE OR REPLACE FUNCTION public.v2_generate_instruments_on_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.status::text = 'approved' AND OLD.status::text IS DISTINCT FROM 'approved' THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://mesvzeqhqdokyysyfknn.supabase.co/functions/v1/generate-instruments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Lovable-Context', 'trigger',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')),
        body := jsonb_build_object('invoice_id', NEW.id));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'instrument generation dispatch failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_v2_generate_instruments
  AFTER UPDATE ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.v2_generate_instruments_on_approval();
