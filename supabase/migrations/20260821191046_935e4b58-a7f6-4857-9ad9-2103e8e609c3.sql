-- =========================================================
-- 1. BUYERS: ownership + safe exporter self service
-- =========================================================
ALTER TABLE public.v2_buyers
  ADD COLUMN IF NOT EXISTS exporter_id uuid REFERENCES public.v2_exporters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_v2_buyers_exporter ON public.v2_buyers(exporter_id);

DROP POLICY IF EXISTS buyers_insert ON public.v2_buyers;
CREATE POLICY buyers_insert ON public.v2_buyers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_v2_staff(auth.uid())
    OR (
      exporter_id IS NOT NULL
      AND public.v2_owns_exporter(auth.uid(), exporter_id)
      AND kyb_status = 'pending'::public.v2_kyc_status
      AND credit_status = 'pending'::public.v2_verification_status
      AND sanctions_status = 'pending'::public.v2_verification_status
      AND verified_by IS NULL AND verified_at IS NULL AND credit_limit IS NULL
    )
  );

DROP POLICY IF EXISTS buyers_read ON public.v2_buyers;
CREATE POLICY buyers_read ON public.v2_buyers
  FOR SELECT TO authenticated
  USING (
    public.is_v2_staff(auth.uid())
    OR (exporter_id IS NOT NULL AND public.v2_owns_exporter(auth.uid(), exporter_id))
    OR public.v2_exporter_can_see_buyer(auth.uid(), id)
  );

DROP POLICY IF EXISTS buyers_update_owner ON public.v2_buyers;
CREATE POLICY buyers_update_owner ON public.v2_buyers
  FOR UPDATE TO authenticated
  USING (
    exporter_id IS NOT NULL
    AND public.v2_owns_exporter(auth.uid(), exporter_id)
    AND kyb_status <> 'verified'::public.v2_kyc_status
  )
  WITH CHECK (
    exporter_id IS NOT NULL
    AND public.v2_owns_exporter(auth.uid(), exporter_id)
    AND kyb_status <> 'verified'::public.v2_kyc_status
  );

CREATE OR REPLACE FUNCTION public.v2_buyers_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_v2_staff(auth.uid()) THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.kyb_status := 'pending'::public.v2_kyc_status;
    NEW.credit_status := 'pending'::public.v2_verification_status;
    NEW.sanctions_status := 'pending'::public.v2_verification_status;
    NEW.credit_limit := NULL;
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
    NEW.kyb_verified_at := NULL;
    NEW.kyb_verified_by := NULL;
    RETURN NEW;
  END IF;

  IF OLD.kyb_status = 'verified'::public.v2_kyc_status THEN
    RAISE EXCEPTION 'This buyer has been verified and can no longer be edited.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.kyb_status IS DISTINCT FROM OLD.kyb_status
     OR NEW.credit_status IS DISTINCT FROM OLD.credit_status
     OR NEW.sanctions_status IS DISTINCT FROM OLD.sanctions_status
     OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
     OR NEW.exporter_id IS DISTINCT FROM OLD.exporter_id
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'Only Credit and Compliance can change buyer verification.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_buyers_guard ON public.v2_buyers;
CREATE TRIGGER trg_v2_buyers_guard
  BEFORE INSERT OR UPDATE ON public.v2_buyers
  FOR EACH ROW EXECUTE FUNCTION public.v2_buyers_guard();

-- =========================================================
-- 2. REFERENCE DATA: countries and ports
-- =========================================================
CREATE TABLE IF NOT EXISTS public.countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.countries TO authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS countries_read ON public.countries;
CREATE POLICY countries_read ON public.countries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS countries_write ON public.countries;
CREATE POLICY countries_write ON public.countries FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role))
  WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));
GRANT INSERT, UPDATE, DELETE ON public.countries TO authenticated;

CREATE TABLE IF NOT EXISTS public.ports (
  unlocode text PRIMARY KEY,
  name text NOT NULL,
  country_code text NOT NULL,
  type text NOT NULL CHECK (type IN ('sea','air','both')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ports_country ON public.ports(country_code);
GRANT SELECT ON public.ports TO authenticated;
GRANT ALL ON public.ports TO service_role;
ALTER TABLE public.ports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ports_read ON public.ports;
CREATE POLICY ports_read ON public.ports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ports_write ON public.ports;
CREATE POLICY ports_write ON public.ports FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role))
  WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));
GRANT INSERT, UPDATE, DELETE ON public.ports TO authenticated;

DROP TRIGGER IF EXISTS trg_countries_updated ON public.countries;
CREATE TRIGGER trg_countries_updated BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_ports_updated ON public.ports;
CREATE TRIGGER trg_ports_updated BEFORE UPDATE ON public.ports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3. INVOICE DATE RULES + not listed ports
-- =========================================================
ALTER TABLE public.v2_invoices
  ADD COLUMN IF NOT EXISTS port_of_loading_other text,
  ADD COLUMN IF NOT EXISTS port_of_discharge_other text,
  ADD COLUMN IF NOT EXISTS ports_not_listed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.v2_invoice_date_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
  IF NEW.bl_date IS NOT NULL AND NEW.bl_date > v_today THEN
    RAISE EXCEPTION 'The bill of lading date cannot be in the future.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.estimated_arrival_date IS NOT NULL AND NEW.bl_date IS NOT NULL
     AND NEW.estimated_arrival_date < NEW.bl_date THEN
    RAISE EXCEPTION 'The estimated arrival date must be on or after the bill of lading date.' USING ERRCODE = 'check_violation';
  END IF;
  NEW.ports_not_listed := (coalesce(btrim(NEW.port_of_loading_other),'') <> ''
                        OR coalesce(btrim(NEW.port_of_discharge_other),'') <> '');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_invoice_date_rules ON public.v2_invoices;
CREATE TRIGGER trg_v2_invoice_date_rules
  BEFORE INSERT OR UPDATE ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.v2_invoice_date_rules();

-- =========================================================
-- 4. BOARD RESOLUTION TRANSCRIPTION INSIDE COMPLIANCE REVIEW
-- =========================================================
CREATE OR REPLACE FUNCTION public.v2_transcribe_board_resolution(
  p_exporter_id uuid,
  p_company_document_id uuid,
  p_authorised_limit numeric,
  p_limit_basis text,
  p_valid_from date,
  p_valid_until date,
  p_signatories jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old uuid;
  v_new uuid;
  v_sig jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.v2_can_review_documents(v_uid) THEN
    RAISE EXCEPTION 'Only Credit and Compliance can transcribe a board resolution.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_limit_basis NOT IN ('gross_face_value','advance_outstanding') THEN
    RAISE EXCEPTION 'Unknown limit basis' USING ERRCODE = 'check_violation';
  END IF;
  IF p_signatories IS NULL OR jsonb_array_length(p_signatories) = 0 THEN
    RAISE EXCEPTION 'At least one authorised signatory is required.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.company_documents
     SET status = 'verified', reviewed_by = v_uid, reviewed_at = now(),
         rejection_reason = NULL,
         valid_from = coalesce(valid_from, p_valid_from),
         valid_until = coalesce(valid_until, p_valid_until)
   WHERE id = p_company_document_id AND exporter_id = p_exporter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The board resolution document could not be found for this exporter.'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id INTO v_old FROM public.board_resolutions
   WHERE exporter_id = p_exporter_id AND verification_status = 'verified' AND superseded_by IS NULL
   LIMIT 1;

  IF v_old IS NOT NULL THEN
    UPDATE public.board_resolutions SET verification_status = 'expired' WHERE id = v_old;
  END IF;

  INSERT INTO public.board_resolutions (
    company_document_id, exporter_id, authorised_limit, limit_currency,
    limit_basis, valid_from, valid_until, verification_status, verified_by, verified_at
  ) VALUES (
    p_company_document_id, p_exporter_id, p_authorised_limit, 'GBP',
    p_limit_basis, p_valid_from, p_valid_until, 'verified', v_uid, now()
  ) RETURNING id INTO v_new;

  IF v_old IS NOT NULL THEN
    UPDATE public.board_resolutions SET superseded_by = v_new WHERE id = v_old;
  END IF;

  FOR v_sig IN SELECT jsonb_array_elements(p_signatories) LOOP
    IF coalesce(btrim(v_sig->>'full_name'),'') = '' THEN CONTINUE; END IF;
    INSERT INTO public.authorised_signatories (board_resolution_id, full_name, position, email)
    VALUES (v_new, btrim(v_sig->>'full_name'), nullif(btrim(coalesce(v_sig->>'position','')),''),
            nullif(btrim(coalesce(v_sig->>'email','')),''));
  END LOOP;

  PERFORM public.v2_audit_write('resolution_created', 'exporter', p_exporter_id,
    jsonb_build_object('board_resolution_id', v_new, 'authorised_limit', p_authorised_limit,
                       'limit_currency','GBP','valid_from',p_valid_from,'valid_until',p_valid_until));

  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION public.v2_transcribe_board_resolution(uuid,uuid,numeric,text,date,date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_transcribe_board_resolution(uuid,uuid,numeric,text,date,date,jsonb) TO authenticated;

-- gate compliance approval on a transcribed resolution
CREATE OR REPLACE FUNCTION public.v2_require_transcribed_resolution()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stage = 'compliance' AND NEW.decision = 'approved' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.board_resolutions
       WHERE exporter_id = NEW.exporter_id
         AND verification_status = 'verified'
         AND superseded_by IS NULL
         AND valid_until >= (now() AT TIME ZONE 'Africa/Lagos')::date
    ) THEN
      RAISE EXCEPTION 'The board resolution must be transcribed before this exporter can be approved.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_require_transcribed_resolution ON public.onboarding_reviews;
CREATE TRIGGER trg_require_transcribed_resolution
  BEFORE INSERT ON public.onboarding_reviews
  FOR EACH ROW EXECUTE FUNCTION public.v2_require_transcribed_resolution();

-- notify Credit and Compliance when an approved exporter uploads a replacement resolution
CREATE OR REPLACE FUNCTION public.v2_notify_new_resolution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_active boolean; v_name text;
BEGIN
  SELECT code INTO v_code FROM public.document_types WHERE id = NEW.document_type_id;
  IF v_code IS DISTINCT FROM 'board_resolution' THEN RETURN NEW; END IF;
  SELECT onboarding_status = 'active', company_name INTO v_active, v_name
    FROM public.v2_exporters WHERE id = NEW.exporter_id;
  IF coalesce(v_active,false) THEN
    PERFORM public.v2_notify_role('credit_officer'::public.v2_app_role,
      'board_resolution_replacement',
      jsonb_build_object('exporter_name', v_name),
      '/app/exporters/' || NEW.exporter_id::text,
      'in_app', NULL, NEW.exporter_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_notify_new_resolution ON public.company_documents;
CREATE TRIGGER trg_v2_notify_new_resolution
  AFTER INSERT ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.v2_notify_new_resolution();

-- =========================================================
-- 5. BACKFILL VERIFICATION STATUSES FOR ALREADY APPROVED EXPORTERS
-- =========================================================
UPDATE public.v2_exporters
   SET kyb_status = 'verified', kyc_status = 'verified',
       kyb_verified_at = coalesce(kyb_verified_at, now()),
       kyc_verified_at = coalesce(kyc_verified_at, now())
 WHERE onboarding_status = 'active'
   AND (kyb_status <> 'verified' OR kyc_status <> 'verified');