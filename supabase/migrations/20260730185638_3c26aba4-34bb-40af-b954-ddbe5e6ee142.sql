-- 1. BOARD RESOLUTIONS -------------------------------------------------
ALTER TABLE public.board_resolutions
  ALTER COLUMN company_document_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.board_resolutions
  ADD CONSTRAINT board_resolutions_verification_status_check
  CHECK (verification_status IN ('pending','verified','rejected'));

DROP POLICY IF EXISTS board_res_insert ON public.board_resolutions;
CREATE POLICY board_res_insert_staff ON public.board_resolutions
  FOR INSERT TO authenticated
  WITH CHECK (public.v2_can_review_documents(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS uq_board_res_verified_per_exporter
  ON public.board_resolutions (exporter_id)
  WHERE verification_status = 'verified' AND superseded_by IS NULL;

CREATE OR REPLACE FUNCTION public.guard_board_resolution_controls()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.v2_can_review_documents(auth.uid()) THEN
      RAISE EXCEPTION 'Only Credit & Compliance reviewers may set board resolution controls'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.authorised_limit IS DISTINCT FROM OLD.authorised_limit
      OR NEW.limit_currency IS DISTINCT FROM OLD.limit_currency
      OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status)
     AND NOT public.v2_can_review_documents(auth.uid()) THEN
    RAISE EXCEPTION 'Only Credit & Compliance reviewers may change the authorised limit or verification status'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_board_resolution_controls ON public.board_resolutions;
CREATE TRIGGER trg_guard_board_resolution_controls
  BEFORE INSERT OR UPDATE ON public.board_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.guard_board_resolution_controls();

-- 2. AUTHORISED SIGNATORIES ---------------------------------------------
DROP POLICY IF EXISTS auth_sig_insert ON public.authorised_signatories;
CREATE POLICY auth_sig_insert_staff ON public.authorised_signatories
  FOR INSERT TO authenticated
  WITH CHECK (public.v2_can_review_documents(auth.uid()));

-- 3. STORAGE -------------------------------------------------------------
DROP POLICY IF EXISTS "Veloxis staff can delete documents" ON storage.objects;

DROP POLICY IF EXISTS "Deal managers can update docs" ON storage.objects;
CREATE POLICY "Deal managers can update v1 deal docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'veloxis-documents'
    AND (storage.foldername(name))[1] = 'deals'
    AND public.has_role(auth.uid(), 'deal_manager'::public.app_role)
  );

-- legacy v1 read policy must never reach a v2 exporter folder
DROP POLICY IF EXISTS "Owners and staff can view veloxis documents" ON storage.objects;
CREATE POLICY "Owners and staff can view veloxis documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'veloxis-documents'
    AND (storage.foldername(name))[1] IN ('deals','exporters')
    AND (
      public.is_veloxis_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.exporter_documents ed JOIN public.exporters e ON e.id = ed.exporter_id
                 WHERE ed.file_path = objects.name AND e.exporter_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.deal_documents dd JOIN public.deals d ON d.id = dd.deal_id
                 JOIN public.exporters e ON e.id = d.exporter_id
                 WHERE dd.file_path = objects.name AND e.exporter_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.exporter_documents ed JOIN public.exporters e ON e.id = ed.exporter_id
                 WHERE ed.file_path = objects.name AND public.is_partner(auth.uid())
                   AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id)))
      OR EXISTS (SELECT 1 FROM public.deal_documents dd JOIN public.deals d ON d.id = dd.deal_id
                 JOIN public.exporters e ON e.id = d.exporter_id
                 WHERE dd.file_path = objects.name AND public.is_partner(auth.uid())
                   AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id)))
    )
  );

-- v1 scoped upload policy must not be usable to write into a v2 exporter folder
DROP POLICY IF EXISTS "Scoped uploads to veloxis-documents" ON storage.objects;
CREATE POLICY "Scoped uploads to veloxis-documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'veloxis-documents'
    AND (storage.foldername(name))[1] IN ('deals','exporters')
    AND (
      public.is_veloxis_staff(auth.uid())
      OR ((storage.foldername(name))[1] = 'deals' AND EXISTS (
            SELECT 1 FROM public.deals d JOIN public.exporters e ON e.id = d.exporter_id
            WHERE d.id::text = (storage.foldername(objects.name))[2]
              AND (e.exporter_user_id = auth.uid() OR d.originator_id = auth.uid()
                   OR (public.is_partner(auth.uid()) AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))))))
      OR ((storage.foldername(name))[1] = 'exporters' AND EXISTS (
            SELECT 1 FROM public.exporters e
            WHERE e.id::text = (storage.foldername(objects.name))[2]
              AND (e.exporter_user_id = auth.uid() OR e.originator_id = auth.uid()
                   OR (public.is_partner(auth.uid()) AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))))))
    )
  );

-- consolidate v2 on {exporter_id}/... : stop new writes under the 'v2/' prefix
DROP POLICY IF EXISTS "v2 exporters can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "v2 exporters can update own documents" ON storage.objects;
-- read policy for the 7 pre-existing 'v2/' objects is retained deliberately

-- 4. AUDIT LOG -----------------------------------------------------------
DROP POLICY IF EXISTS doc_audit_insert ON public.document_audit_log;
REVOKE INSERT ON public.document_audit_log FROM authenticated;
GRANT ALL ON public.document_audit_log TO service_role;

ALTER TABLE public.document_audit_log DROP CONSTRAINT IF EXISTS document_audit_log_action_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_action_check
  CHECK (action IN ('uploaded','replaced','verified','rejected','requested','fulfilled',
                    'withdrawn','expired','override_applied','viewed','created','updated','superseded'));

CREATE OR REPLACE FUNCTION public.doc_audit_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entity text;
  v_action text;
  v_invoice uuid;
  v_exporter uuid;
BEGIN
  IF TG_TABLE_NAME = 'invoice_documents' THEN
    v_entity := 'invoice_document'; v_invoice := NEW.invoice_id;
    SELECT i.exporter_id INTO v_exporter FROM public.v2_invoices i WHERE i.id = NEW.invoice_id;
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'uploaded'
                     WHEN NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN 'verified'
                     WHEN NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN 'rejected'
                     ELSE 'updated' END;
  ELSIF TG_TABLE_NAME = 'company_documents' THEN
    v_entity := 'company_document'; v_exporter := NEW.exporter_id;
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'uploaded'
                     WHEN NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN 'verified'
                     WHEN NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN 'rejected'
                     ELSE 'updated' END;
  ELSIF TG_TABLE_NAME = 'invoice_document_requests' THEN
    v_entity := 'document_request'; v_invoice := NEW.invoice_id;
    SELECT i.exporter_id INTO v_exporter FROM public.v2_invoices i WHERE i.id = NEW.invoice_id;
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'requested' ELSE 'updated' END;
  ELSE
    v_entity := 'board_resolution'; v_exporter := NEW.exporter_id;
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'created'
                     WHEN NEW.verification_status = 'verified' AND OLD.verification_status IS DISTINCT FROM 'verified' THEN 'verified'
                     WHEN NEW.verification_status = 'rejected' AND OLD.verification_status IS DISTINCT FROM 'rejected' THEN 'rejected'
                     WHEN NEW.superseded_by IS NOT NULL AND OLD.superseded_by IS NULL THEN 'superseded'
                     ELSE 'updated' END;
  END IF;

  INSERT INTO public.document_audit_log (entity_type, entity_id, invoice_id, exporter_id, action, actor_id, metadata)
  VALUES (v_entity, NEW.id, v_invoice, v_exporter, v_action, auth.uid(),
          jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_invoice_documents ON public.invoice_documents;
CREATE TRIGGER trg_audit_invoice_documents AFTER INSERT OR UPDATE ON public.invoice_documents
  FOR EACH ROW EXECUTE FUNCTION public.doc_audit_capture();
DROP TRIGGER IF EXISTS trg_audit_company_documents ON public.company_documents;
CREATE TRIGGER trg_audit_company_documents AFTER INSERT OR UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.doc_audit_capture();
DROP TRIGGER IF EXISTS trg_audit_invoice_doc_requests ON public.invoice_document_requests;
CREATE TRIGGER trg_audit_invoice_doc_requests AFTER INSERT OR UPDATE ON public.invoice_document_requests
  FOR EACH ROW EXECUTE FUNCTION public.doc_audit_capture();
DROP TRIGGER IF EXISTS trg_audit_board_resolutions ON public.board_resolutions;
CREATE TRIGGER trg_audit_board_resolutions AFTER INSERT OR UPDATE ON public.board_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.doc_audit_capture();