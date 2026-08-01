-- 1. REVIEW RECORDS -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id uuid NOT NULL REFERENCES public.v2_exporters(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('bd','compliance')),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('approved','returned','rejected')),
  note text,
  single_reviewer_override boolean NOT NULL DEFAULT false,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_reviews TO authenticated;
GRANT ALL ON public.onboarding_reviews TO service_role;

ALTER TABLE public.onboarding_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_reviews_read ON public.onboarding_reviews;
CREATE POLICY onboarding_reviews_read ON public.onboarding_reviews
  FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_onboarding_reviews_exporter ON public.onboarding_reviews(exporter_id, created_at DESC);

-- append only
CREATE OR REPLACE FUNCTION public.prevent_review_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Review records are append only';
END $$;

DROP TRIGGER IF EXISTS trg_onboarding_reviews_no_update ON public.onboarding_reviews;
CREATE TRIGGER trg_onboarding_reviews_no_update BEFORE UPDATE ON public.onboarding_reviews
  FOR EACH ROW EXECUTE FUNCTION public.prevent_review_mutation();
DROP TRIGGER IF EXISTS trg_onboarding_reviews_no_delete ON public.onboarding_reviews;
CREATE TRIGGER trg_onboarding_reviews_no_delete BEFORE DELETE ON public.onboarding_reviews
  FOR EACH ROW EXECUTE FUNCTION public.prevent_review_mutation();

-- 2. SINGLE REVIEWER FLAGS -------------------------------------------------
ALTER TABLE public.v2_exporters
  ADD COLUMN IF NOT EXISTS single_reviewer_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_reviewer_reason text,
  ADD COLUMN IF NOT EXISTS single_reviewer_by uuid,
  ADD COLUMN IF NOT EXISTS single_reviewer_at timestamptz;

ALTER TABLE public.v2_invoices
  ADD COLUMN IF NOT EXISTS single_reviewer_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_reviewer_reason text,
  ADD COLUMN IF NOT EXISTS single_reviewer_by uuid,
  ADD COLUMN IF NOT EXISTS single_reviewer_at timestamptz;

-- 3. ONBOARDING REVIEW RPC (four eyes enforced here) -----------------------
CREATE OR REPLACE FUNCTION public.record_onboarding_review(
  p_exporter_id uuid,
  p_stage text,
  p_decision text,
  p_note text DEFAULT NULL,
  p_override_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_bd_reviewer uuid;
  v_override boolean := false;
  v_id uuid;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to record a review' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_stage NOT IN ('bd','compliance') THEN
    RAISE EXCEPTION 'Unknown review stage' USING ERRCODE = 'check_violation';
  END IF;
  IF p_decision NOT IN ('approved','returned','rejected') THEN
    RAISE EXCEPTION 'Unknown decision' USING ERRCODE = 'check_violation';
  END IF;
  IF p_decision <> 'approved' AND coalesce(btrim(p_note),'') = '' THEN
    RAISE EXCEPTION 'A written reason is required when returning or rejecting an application' USING ERRCODE = 'check_violation';
  END IF;

  v_super := public.has_app_role(v_uid, 'super_admin'::public.v2_app_role);

  IF p_stage = 'bd' AND NOT (v_super OR public.has_app_role(v_uid, 'originator'::public.v2_app_role)) THEN
    RAISE EXCEPTION 'Only a Business Developer may record this review' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_stage = 'compliance' AND NOT (v_super OR public.has_app_role(v_uid, 'credit_officer'::public.v2_app_role)) THEN
    RAISE EXCEPTION 'Only Credit & Compliance may record this review' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_stage = 'compliance' AND p_decision = 'approved' THEN
    SELECT reviewer_id INTO v_bd_reviewer
    FROM public.onboarding_reviews
    WHERE exporter_id = p_exporter_id AND stage = 'bd' AND decision = 'approved'
    ORDER BY created_at DESC LIMIT 1;

    IF v_bd_reviewer IS NULL THEN
      SELECT bd_approved_by INTO v_bd_reviewer FROM public.v2_exporters WHERE id = p_exporter_id;
    END IF;

    IF v_bd_reviewer IS NOT NULL AND v_bd_reviewer = v_uid THEN
      IF NOT v_super OR coalesce(btrim(p_override_reason),'') = '' THEN
        RAISE EXCEPTION 'This application was reviewed by you at the earlier stage. It must be approved by a different reviewer.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      v_override := true;
    END IF;
  END IF;

  INSERT INTO public.onboarding_reviews (exporter_id, stage, reviewer_id, decision, note, single_reviewer_override, override_reason)
  VALUES (p_exporter_id, p_stage, v_uid, p_decision, nullif(btrim(coalesce(p_note,'')),''), v_override,
          CASE WHEN v_override THEN btrim(p_override_reason) ELSE NULL END)
  RETURNING id INTO v_id;

  -- derive exporter state from the review record
  IF p_stage = 'bd' THEN
    IF p_decision = 'approved' THEN
      UPDATE public.v2_exporters
         SET bd_approved_at = v_now, bd_approved_by = v_uid,
             bd_rejected_at = NULL, bd_rejection_reason = NULL
       WHERE id = p_exporter_id;
    ELSE
      UPDATE public.v2_exporters
         SET bd_rejected_at = v_now, bd_rejection_reason = btrim(p_note),
             bd_approved_at = NULL, bd_approved_by = NULL
       WHERE id = p_exporter_id;
    END IF;
  ELSE
    IF p_decision = 'approved' THEN
      UPDATE public.v2_exporters
         SET onboarding_status = 'active',
             kyb_status = 'verified', kyb_verified_at = v_now, kyb_verified_by = v_uid,
             kyc_status = 'verified', kyc_verified_at = v_now, kyc_verified_by = v_uid,
             single_reviewer_approved = single_reviewer_approved OR v_override,
             single_reviewer_reason = CASE WHEN v_override THEN btrim(p_override_reason) ELSE single_reviewer_reason END,
             single_reviewer_by = CASE WHEN v_override THEN v_uid ELSE single_reviewer_by END,
             single_reviewer_at = CASE WHEN v_override THEN v_now ELSE single_reviewer_at END
       WHERE id = p_exporter_id;
    ELSE
      UPDATE public.v2_exporters
         SET bd_approved_at = NULL, bd_approved_by = NULL,
             bd_rejected_at = v_now, bd_rejection_reason = btrim(p_note)
       WHERE id = p_exporter_id;
    END IF;
  END IF;

  INSERT INTO public.v2_audit_log (invoice_id, actor_user_id, action, note, metadata)
  VALUES (NULL, v_uid, 'exporter_review_' || p_decision, nullif(btrim(coalesce(p_note,'')),''),
          jsonb_build_object('exporter_id', p_exporter_id, 'stage', p_stage, 'review_id', v_id));

  IF v_override THEN
    INSERT INTO public.v2_audit_log (invoice_id, actor_user_id, action, note, metadata)
    VALUES (NULL, v_uid, 'single_reviewer_override_applied', btrim(p_override_reason),
            jsonb_build_object('exporter_id', p_exporter_id, 'entity', 'exporter', 'reason', btrim(p_override_reason), 'review_id', v_id));
  END IF;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.record_onboarding_review(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_onboarding_review(uuid, text, text, text, text) TO authenticated;

-- 4. INVOICE APPROVAL: approver may not be a document verifier ------------
CREATE OR REPLACE FUNCTION public.approve_invoice_for_funding(
  p_invoice_id uuid,
  p_override_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_status text;
  v_conflict boolean := false;
  v_override boolean := false;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in' USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_super := public.has_app_role(v_uid, 'super_admin'::public.v2_app_role);
  IF NOT (v_super OR public.has_app_role(v_uid, 'approver'::public.v2_app_role)) THEN
    RAISE EXCEPTION 'Only an Approver may approve an application for funding' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT status::text INTO v_status FROM public.v2_invoices WHERE id = p_invoice_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Application not found' USING ERRCODE = 'no_data_found'; END IF;
  IF v_status <> 'verified' THEN
    RAISE EXCEPTION 'Only a verified application can be approved for funding' USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.v2_invoices i WHERE i.id = p_invoice_id AND i.verified_by = v_uid
    UNION ALL
    SELECT 1 FROM public.invoice_documents d WHERE d.invoice_id = p_invoice_id AND d.verified_by = v_uid
    UNION ALL
    SELECT 1 FROM public.v2_invoice_documents d2 WHERE d2.invoice_id = p_invoice_id AND d2.verified_by = v_uid
  ) INTO v_conflict;

  IF v_conflict THEN
    IF NOT v_super OR coalesce(btrim(p_override_reason),'') = '' THEN
      RAISE EXCEPTION 'This application was reviewed by you at the earlier stage. It must be approved by a different reviewer.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    v_override := true;
  END IF;

  UPDATE public.v2_invoices
     SET status = 'approved'::public.v2_invoice_status,
         approved_by = v_uid,
         single_reviewer_approved = single_reviewer_approved OR v_override,
         single_reviewer_reason = CASE WHEN v_override THEN btrim(p_override_reason) ELSE single_reviewer_reason END,
         single_reviewer_by = CASE WHEN v_override THEN v_uid ELSE single_reviewer_by END,
         single_reviewer_at = CASE WHEN v_override THEN v_now ELSE single_reviewer_at END
   WHERE id = p_invoice_id;

  INSERT INTO public.v2_decisions (invoice_id, decision_type, reason, actor_user_id)
  VALUES (p_invoice_id, 'approved'::public.v2_decision_type,
          CASE WHEN v_override THEN btrim(p_override_reason) ELSE NULL END, v_uid);

  INSERT INTO public.v2_audit_log (invoice_id, actor_user_id, action, from_status, to_status, note, metadata)
  VALUES (p_invoice_id, v_uid, 'approved', v_status::public.v2_invoice_status, 'approved'::public.v2_invoice_status,
          CASE WHEN v_override THEN btrim(p_override_reason) ELSE NULL END,
          jsonb_build_object('single_reviewer_override', v_override));

  IF v_override THEN
    INSERT INTO public.v2_audit_log (invoice_id, actor_user_id, action, note, metadata)
    VALUES (p_invoice_id, v_uid, 'single_reviewer_override_applied', btrim(p_override_reason),
            jsonb_build_object('entity', 'invoice', 'reason', btrim(p_override_reason)));
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.approve_invoice_for_funding(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_invoice_for_funding(uuid, text) TO authenticated;

-- 5. ROLE GRANT AUDIT ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_subject uuid;
  v_role text;
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_subject := NEW.user_id; v_role := NEW.role::text;
    v_action := CASE WHEN v_uid IS NOT NULL AND v_uid = NEW.user_id THEN 'self_role_grant' ELSE 'role_granted' END;
  ELSE
    v_subject := OLD.user_id; v_role := OLD.role::text; v_action := 'role_revoked';
  END IF;

  INSERT INTO public.v2_audit_log (invoice_id, actor_user_id, action, metadata)
  VALUES (NULL, v_uid, v_action,
    jsonb_build_object('subject_user_id', v_subject, 'role', v_role,
                       'actor_user_id', v_uid, 'at', now(),
                       'source', CASE WHEN v_uid IS NULL THEN 'service' ELSE 'user' END));

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_role_grant ON public.app_user_roles;
CREATE TRIGGER trg_audit_role_grant AFTER INSERT ON public.app_user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();
DROP TRIGGER IF EXISTS trg_audit_role_revoke ON public.app_user_roles;
CREATE TRIGGER trg_audit_role_revoke AFTER DELETE ON public.app_user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();