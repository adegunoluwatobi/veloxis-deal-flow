CREATE OR REPLACE FUNCTION public.supersede_board_resolution(
  p_old_id uuid,
  p_new_company_document_id uuid,
  p_authorised_limit numeric,
  p_limit_currency text,
  p_valid_from date,
  p_valid_until date,
  p_limit_basis text DEFAULT 'gross_face_value',
  p_signatories jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old RECORD;
  v_new_id uuid;
  v_sig jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.v2_can_review_documents(v_uid) THEN
    RAISE EXCEPTION 'Only Credit & Compliance reviewers may supersede a board resolution'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old FROM public.board_resolutions WHERE id = p_old_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board resolution % not found', p_old_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_old.superseded_by IS NOT NULL THEN
    RAISE EXCEPTION 'Board resolution % has already been superseded', p_old_id
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.board_resolutions (
    company_document_id, exporter_id, authorised_limit, limit_currency, limit_basis,
    valid_from, valid_until, verification_status, verified_by, verified_at
  ) VALUES (
    p_new_company_document_id, v_old.exporter_id, p_authorised_limit,
    COALESCE(p_limit_currency, 'GBP'), COALESCE(p_limit_basis, 'gross_face_value'),
    p_valid_from, p_valid_until, 'verified', v_uid, now()
  ) RETURNING id INTO v_new_id;

  FOR v_sig IN SELECT * FROM jsonb_array_elements(COALESCE(p_signatories, '[]'::jsonb))
  LOOP
    INSERT INTO public.authorised_signatories (board_resolution_id, full_name, position, email, id_document_path)
    VALUES (
      v_new_id,
      NULLIF(v_sig->>'full_name', ''),
      NULLIF(v_sig->>'position', ''),
      NULLIF(v_sig->>'email', ''),
      NULLIF(v_sig->>'id_document_path', '')
    );
  END LOOP;

  UPDATE public.board_resolutions SET superseded_by = v_new_id WHERE id = p_old_id;

  INSERT INTO public.document_audit_log (entity_type, entity_id, exporter_id, action, actor_id, metadata)
  VALUES (
    'board_resolution', p_old_id, v_old.exporter_id, 'replaced', v_uid,
    jsonb_build_object('superseded_by', v_new_id)
  );

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.supersede_board_resolution(uuid, uuid, numeric, text, date, date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supersede_board_resolution(uuid, uuid, numeric, text, date, date, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.exporter_headroom(uuid) FROM PUBLIC, anon;