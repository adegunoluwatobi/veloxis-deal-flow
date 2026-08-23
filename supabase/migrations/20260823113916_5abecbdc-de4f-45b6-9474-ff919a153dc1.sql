-- 1. Signatory phone number
ALTER TABLE public.authorised_signatories ADD COLUMN IF NOT EXISTS phone text;

-- 2. Remove the authorised limit tied to the board resolution
ALTER TABLE public.board_resolutions ALTER COLUMN authorised_limit DROP NOT NULL;
ALTER TABLE public.board_resolutions DROP CONSTRAINT IF EXISTS board_resolutions_limit_positive;

-- 3. Renewal flag (new director / expiry driven)
ALTER TABLE public.board_resolutions ADD COLUMN IF NOT EXISTS renewal_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.board_resolutions ADD COLUMN IF NOT EXISTS renewal_reason text;

-- 4. Transcription: no limit, one year validity, signatory phone captured
DROP FUNCTION IF EXISTS public.v2_transcribe_board_resolution(uuid,uuid,numeric,text,date,date,jsonb);

CREATE OR REPLACE FUNCTION public.v2_transcribe_board_resolution(
  p_exporter_id uuid,
  p_company_document_id uuid,
  p_valid_from date,
  p_signatories jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old uuid;
  v_new uuid;
  v_sig jsonb;
  v_until date := (p_valid_from + interval '1 year' - interval '1 day')::date;
BEGIN
  IF v_uid IS NULL OR NOT public.v2_can_transcribe_resolution(v_uid) THEN
    RAISE EXCEPTION 'You do not have permission to record a board resolution.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_signatories IS NULL OR jsonb_array_length(p_signatories) = 0 THEN
    RAISE EXCEPTION 'At least one authorised signatory is required.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.company_documents
     SET status = 'verified', reviewed_by = v_uid, reviewed_at = now(),
         rejection_reason = NULL,
         valid_from = coalesce(valid_from, p_valid_from),
         valid_until = coalesce(valid_until, v_until)
   WHERE id = p_company_document_id AND exporter_id = p_exporter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The board resolution document could not be found for this exporter.'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id INTO v_old FROM public.board_resolutions
   WHERE exporter_id = p_exporter_id AND superseded_by IS NULL
   ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.board_resolutions (
    exporter_id, company_document_id, authorised_limit, limit_currency, limit_basis,
    valid_from, valid_until, verification_status, verified_by, verified_at, renewal_required
  ) VALUES (
    p_exporter_id, p_company_document_id, NULL, 'GBP', 'gross_face_value',
    p_valid_from, v_until, 'verified', v_uid, now(), false
  ) RETURNING id INTO v_new;

  FOR v_sig IN SELECT * FROM jsonb_array_elements(p_signatories) LOOP
    INSERT INTO public.authorised_signatories (board_resolution_id, full_name, position, email, phone)
    VALUES (v_new, v_sig->>'full_name', nullif(v_sig->>'position',''), nullif(v_sig->>'email',''), nullif(v_sig->>'phone',''));
  END LOOP;

  IF v_old IS NOT NULL THEN
    UPDATE public.board_resolutions SET superseded_by = v_new WHERE id = v_old;
  END IF;

  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION public.v2_transcribe_board_resolution(uuid,uuid,date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_transcribe_board_resolution(uuid,uuid,date,jsonb) TO authenticated;

-- 5. A change to the board forces a replacement resolution
CREATE OR REPLACE FUNCTION public.v2_flag_resolution_on_director_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  UPDATE public.board_resolutions
     SET renewal_required = true,
         renewal_reason = 'The board of directors changed on '
           || to_char((now() AT TIME ZONE 'Africa/Lagos')::date, 'DD Mon YYYY')
           || '. A replacement board resolution naming the current board is required.'
   WHERE exporter_id = NEW.exporter_id AND superseded_by IS NULL;

  SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = NEW.exporter_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_owner, 'A new board resolution is required',
            'Your board of directors changed, so we need a replacement board resolution naming the current board.',
            'warning', '/portal/onboarding');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS v2_directors_force_new_resolution ON public.v2_exporter_directors;
CREATE TRIGGER v2_directors_force_new_resolution
AFTER INSERT OR UPDATE OF full_name, position ON public.v2_exporter_directors
FOR EACH ROW EXECUTE FUNCTION public.v2_flag_resolution_on_director_change();

-- 6. Staff can request a board resolution
CREATE OR REPLACE FUNCTION public.v2_request_board_resolution(p_exporter_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_owner uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.v2_can_transcribe_resolution(v_uid) THEN
    RAISE EXCEPTION 'You do not have permission to request a board resolution.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = p_exporter_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'This exporter has no portal user to notify.' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (v_owner, 'Board resolution requested',
          COALESCE(nullif(p_note,''),
            'Please upload a board resolution naming the people authorised to sign on behalf of the company.'),
          'warning', '/portal/onboarding');
END $$;

REVOKE ALL ON FUNCTION public.v2_request_board_resolution(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_request_board_resolution(uuid, text) TO authenticated;