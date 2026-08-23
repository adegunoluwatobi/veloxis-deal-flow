CREATE OR REPLACE FUNCTION public.v2_can_transcribe_resolution(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.app_user_roles
  WHERE user_id = _user_id AND role IN ('credit_officer','originator','super_admin')
) $$;

REVOKE ALL ON FUNCTION public.v2_can_transcribe_resolution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_can_transcribe_resolution(uuid) TO authenticated;

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
  IF v_uid IS NULL OR NOT public.v2_can_transcribe_resolution(v_uid) THEN
    RAISE EXCEPTION 'You do not have permission to record a board resolution.'
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

  INSERT INTO public.board_resolutions (
    exporter_id, company_document_id, authorised_limit, limit_currency, limit_basis,
    valid_from, valid_until, verification_status, verified_by, verified_at
  ) VALUES (
    p_exporter_id, p_company_document_id, p_authorised_limit, 'GBP', p_limit_basis,
    p_valid_from, p_valid_until, 'verified', v_uid, now()
  ) RETURNING id INTO v_new;

  FOR v_sig IN SELECT * FROM jsonb_array_elements(p_signatories) LOOP
    INSERT INTO public.authorised_signatories (board_resolution_id, full_name, position, email)
    VALUES (v_new, v_sig->>'full_name', v_sig->>'position', nullif(v_sig->>'email',''));
  END LOOP;

  IF v_old IS NOT NULL THEN
    UPDATE public.board_resolutions SET superseded_by = v_new WHERE id = v_old;
  END IF;

  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION public.v2_transcribe_board_resolution(uuid,uuid,numeric,text,date,date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_transcribe_board_resolution(uuid,uuid,numeric,text,date,date,jsonb) TO authenticated;