CREATE OR REPLACE FUNCTION public.record_onboarding_review(p_exporter_id uuid, p_stage text, p_decision text, p_note text DEFAULT NULL::text, p_override_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_bd_reviewer uuid;
  v_override boolean := false;
  v_bd_missing boolean := false;
  v_id uuid;
  v_now timestamptz := now();
  v_outstanding text;
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
    -- every mandatory company-level document must be uploaded and approved
    SELECT string_agg(dt.label, ', ' ORDER BY dt.sort_order NULLS LAST, dt.label)
      INTO v_outstanding
    FROM public.document_types dt
    WHERE dt.active
      AND dt.level = 'company'
      AND dt.requirement = 'mandatory'
      AND NOT EXISTS (
        SELECT 1 FROM public.company_documents cd
        WHERE cd.exporter_id = p_exporter_id
          AND cd.document_type_id = dt.id
          AND cd.status = 'verified'
      );

    IF v_outstanding IS NOT NULL THEN
      IF NOT (v_super AND coalesce(btrim(p_override_reason),'') <> '') THEN
        RAISE EXCEPTION 'All onboarding documents must be approved before final approval. Still outstanding: %', v_outstanding
          USING ERRCODE = 'check_violation';
      END IF;
      v_override := true;
    END IF;

    SELECT reviewer_id INTO v_bd_reviewer
    FROM public.onboarding_reviews
    WHERE exporter_id = p_exporter_id AND stage = 'bd' AND decision = 'approved'
    ORDER BY created_at DESC LIMIT 1;

    IF v_bd_reviewer IS NULL THEN
      SELECT bd_approved_by INTO v_bd_reviewer FROM public.v2_exporters WHERE id = p_exporter_id;
    END IF;

    v_bd_missing := v_bd_reviewer IS NULL;

    IF v_bd_reviewer IS NOT NULL AND v_bd_reviewer = v_uid THEN
      IF NOT v_super OR coalesce(btrim(p_override_reason),'') = '' THEN
        RAISE EXCEPTION 'This application was reviewed by you at the earlier stage. It must be approved by a different reviewer.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      v_override := true;
    END IF;
  END IF;

  IF v_bd_missing THEN
    INSERT INTO public.onboarding_reviews (exporter_id, stage, reviewer_id, decision, note)
    VALUES (p_exporter_id, 'bd', v_uid, 'approved',
            'Business Developer stage superseded by Credit & Compliance final approval (no separate BD sign-off).');

    UPDATE public.v2_exporters
       SET bd_approved_at = v_now, bd_approved_by = v_uid,
           bd_rejected_at = NULL, bd_rejection_reason = NULL
     WHERE id = p_exporter_id;

    INSERT INTO public.v2_audit_log (invoice_id, actor_user_id, action, note, metadata)
    VALUES (NULL, v_uid, 'bd_stage_superseded',
            'Credit & Compliance approved without a Business Developer sign-off.',
            jsonb_build_object('exporter_id', p_exporter_id, 'stage', 'bd', 'superseded_by', 'compliance'));
  END IF;

  INSERT INTO public.onboarding_reviews (exporter_id, stage, reviewer_id, decision, note, single_reviewer_override, override_reason)
  VALUES (p_exporter_id, p_stage, v_uid, p_decision, nullif(btrim(coalesce(p_note,'')),''), v_override,
          CASE WHEN v_override THEN btrim(p_override_reason) ELSE NULL END)
  RETURNING id INTO v_id;

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
             kyc_status = 'verified',
             bd_rejected_at = NULL, bd_rejection_reason = NULL,
             single_reviewer_approved = CASE WHEN v_override THEN true ELSE single_reviewer_approved END,
             single_reviewer_reason = CASE WHEN v_override THEN btrim(p_override_reason) ELSE single_reviewer_reason END,
             single_reviewer_at = CASE WHEN v_override THEN v_now ELSE single_reviewer_at END
       WHERE id = p_exporter_id;
    ELSE
      UPDATE public.v2_exporters
         SET onboarding_status = 'pending',
             kyb_status = 'pending', kyc_status = 'pending',
             bd_approved_at = NULL, bd_approved_by = NULL,
             bd_rejected_at = v_now, bd_rejection_reason = btrim(p_note)
       WHERE id = p_exporter_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;