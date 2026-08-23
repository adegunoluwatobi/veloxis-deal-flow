
INSERT INTO public.notification_templates (key, channel, subject, body, active)
VALUES
 ('staff_buyer_verification_pending','in_app','Buyer verification pending','{{company_name}} is awaiting {{stage}}.',true),
 ('staff_buyer_verification_pending','email','Buyer verification pending: {{company_name}}','<p>{{company_name}} is awaiting {{stage}}.</p><p>Open the buyer record in the Veloxis portal to complete the review.</p>',true),
 ('staff_document_review_pending','in_app','Document awaiting approval','{{company_name}} submitted {{document_label}} for approval.',true),
 ('staff_document_review_pending','email','Document awaiting approval: {{company_name}}','<p>{{company_name}} submitted <strong>{{document_label}}</strong> for approval.</p><p>Open the exporter record in the Veloxis portal to review it.</p>',true)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.v2_notify_buyer_review_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_stage text; v_vars jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_stage := 'KYB verification';
  ELSIF NEW.kyb_status IS DISTINCT FROM OLD.kyb_status
        AND NEW.kyb_status::text IN ('pending','in_review') THEN
    v_stage := 'KYB verification';
  ELSIF NEW.kyb_status::text = 'verified'
        AND (NEW.credit_status::text IS DISTINCT FROM 'clear' OR NEW.sanctions_status::text IS DISTINCT FROM 'clear')
        AND (OLD.kyb_status::text IS DISTINCT FROM 'verified') THEN
    v_stage := 'credit and sanctions clearance';
  ELSE
    RETURN NEW;
  END IF;

  v_vars := jsonb_build_object('company_name', COALESCE(NEW.company_name,'A buyer'), 'stage', v_stage);

  PERFORM public.v2_notify_role('credit_officer'::v2_app_role, 'staff_buyer_verification_pending', v_vars,
    '/app/buyers/' || NEW.id::text, 'warning', NULL, NULL);
  IF v_stage = 'KYB verification' THEN
    PERFORM public.v2_notify_role('originator'::v2_app_role, 'staff_buyer_verification_pending', v_vars,
      '/app/buyers/' || NEW.id::text, 'warning', NULL, NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_notify_buyer_review_pending ON public.v2_buyers;
CREATE TRIGGER trg_v2_notify_buyer_review_pending
AFTER INSERT OR UPDATE OF kyb_status, credit_status, sanctions_status ON public.v2_buyers
FOR EACH ROW EXECUTE FUNCTION public.v2_notify_buyer_review_pending();

CREATE OR REPLACE FUNCTION public.v2_notify_company_document_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_company text; v_label text; v_vars jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (NEW.status IS DISTINCT FROM OLD.status AND COALESCE(NEW.status,'pending') = 'pending') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.status,'pending') <> 'pending' THEN RETURN NEW; END IF;

  SELECT company_name INTO v_company FROM public.v2_exporters WHERE id = NEW.exporter_id;
  SELECT label INTO v_label FROM public.document_types WHERE id = NEW.document_type_id;

  v_vars := jsonb_build_object(
    'company_name', COALESCE(v_company,'An exporter'),
    'document_label', COALESCE(v_label, NEW.original_filename, 'a document'));

  PERFORM public.v2_notify_role('originator'::v2_app_role, 'staff_document_review_pending', v_vars,
    '/app/exporters/' || NEW.exporter_id::text, 'info', NULL, NEW.exporter_id);
  PERFORM public.v2_notify_role('credit_officer'::v2_app_role, 'staff_document_review_pending', v_vars,
    '/app/exporters/' || NEW.exporter_id::text, 'info', NULL, NEW.exporter_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_notify_company_document_pending ON public.company_documents;
CREATE TRIGGER trg_v2_notify_company_document_pending
AFTER INSERT OR UPDATE OF status ON public.company_documents
FOR EACH ROW EXECUTE FUNCTION public.v2_notify_company_document_pending();
