-- 1. Source-document constraint -------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_board_resolution_source_doc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
BEGIN
  SELECT cd.exporter_id, cd.status, dt.code
    INTO d
  FROM public.company_documents cd
  JOIN public.document_types dt ON dt.id = cd.document_type_id
  WHERE cd.id = NEW.company_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Board resolution must reference an existing company document'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF d.exporter_id IS DISTINCT FROM NEW.exporter_id THEN
    RAISE EXCEPTION 'Board resolution document belongs to a different exporter'
      USING ERRCODE = 'check_violation';
  END IF;

  IF d.code IS DISTINCT FROM 'board_resolution' THEN
    RAISE EXCEPTION 'Referenced document is of type %, expected board_resolution', d.code
      USING ERRCODE = 'check_violation';
  END IF;

  IF d.status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'Board resolution document must be verified first (currently %)', d.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_board_resolution_source_doc ON public.board_resolutions;
CREATE TRIGGER trg_board_resolution_source_doc
BEFORE INSERT OR UPDATE OF company_document_id, exporter_id ON public.board_resolutions
FOR EACH ROW EXECUTE FUNCTION public.enforce_board_resolution_source_doc();

-- 2. Atomic replacement RPC -------------------------------------------------
CREATE OR REPLACE FUNCTION public.supersede_board_resolution(
  p_old_id uuid,
  p_new_company_document_id uuid,
  p_authorised_limit numeric,
  p_limit_currency text,
  p_valid_from date,
  p_valid_until date,
  p_signatories jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Free the "one active resolution per exporter" partial unique indexes without
  -- releasing the old row: it points at itself only for the length of this
  -- transaction, and is repointed at the new row below.
  UPDATE public.board_resolutions SET superseded_by = p_old_id WHERE id = p_old_id;

  INSERT INTO public.board_resolutions (
    company_document_id, exporter_id, authorised_limit, limit_currency,
    valid_from, valid_until, verification_status, verified_by, verified_at
  ) VALUES (
    p_new_company_document_id, v_old.exporter_id, p_authorised_limit,
    COALESCE(p_limit_currency, 'GBP'), p_valid_from, p_valid_until,
    'verified', v_uid, now()
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
    'board_resolution', v_new_id, v_old.exporter_id, 'replaced', v_uid,
    jsonb_build_object(
      'supersedes', p_old_id,
      'company_document_id', p_new_company_document_id,
      'authorised_limit', p_authorised_limit,
      'limit_currency', COALESCE(p_limit_currency, 'GBP'),
      'signatory_count', jsonb_array_length(COALESCE(p_signatories, '[]'::jsonb))
    )
  );

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.supersede_board_resolution(uuid, uuid, numeric, text, date, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supersede_board_resolution(uuid, uuid, numeric, text, date, date, jsonb) TO authenticated, service_role;