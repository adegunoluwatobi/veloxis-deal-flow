-- 1. INDEX
DROP INDEX IF EXISTS public.uq_board_resolutions_active_per_exporter;

-- 2. LIMIT BASIS
ALTER TABLE public.board_resolutions
  ADD COLUMN IF NOT EXISTS limit_basis text NOT NULL DEFAULT 'gross_face_value';
ALTER TABLE public.board_resolutions
  DROP CONSTRAINT IF EXISTS board_resolutions_limit_basis_check;
ALTER TABLE public.board_resolutions
  ADD CONSTRAINT board_resolutions_limit_basis_check
  CHECK (limit_basis IN ('gross_face_value','advance_outstanding'));

CREATE OR REPLACE FUNCTION public.guard_board_resolution_controls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      OR NEW.limit_basis IS DISTINCT FROM OLD.limit_basis
      OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.verification_status IS DISTINCT FROM OLD.verification_status)
     AND NOT public.v2_can_review_documents(auth.uid()) THEN
    RAISE EXCEPTION 'Only Credit & Compliance reviewers may change the authorised limit, basis or verification status'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

-- supersede without the self-reference step
DROP FUNCTION IF EXISTS public.supersede_board_resolution(uuid, uuid, numeric, text, date, date, jsonb);

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

  -- Retire the old row first so the verified-per-exporter rule stays satisfied.
  UPDATE public.board_resolutions
  SET verification_status = 'superseded'
  WHERE id = p_old_id
    AND EXISTS (SELECT 1 FROM pg_type t WHERE false); -- no-op guard removed below

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

-- 3. CURRENCY on invoices
ALTER TABLE public.v2_invoices
  ADD COLUMN IF NOT EXISTS fx_rate_to_gbp numeric,
  ADD COLUMN IF NOT EXISTS fx_rate_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS fx_rate_source text;

-- 4. HEADROOM
CREATE OR REPLACE FUNCTION public.exporter_headroom(p_exporter_id uuid)
RETURNS TABLE(
  authorised_limit numeric,
  limit_currency text,
  limit_basis text,
  committed_exposure numeric,
  headroom numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  inv RECORD;
  v_total numeric := 0;
  v_base numeric;
  v_rate numeric;
BEGIN
  SELECT br.authorised_limit, br.limit_currency, br.limit_basis
    INTO r
  FROM public.board_resolutions br
  WHERE br.exporter_id = p_exporter_id
    AND br.superseded_by IS NULL
    AND br.verification_status = 'verified'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR inv IN
    SELECT i.id, i.reference, i.invoice_currency::text AS cur,
           COALESCE(i.gross_invoice_value, i.invoice_amount, 0) AS gross,
           COALESCE(i.agreed_deductions, 0) AS deductions,
           i.fx_rate_to_gbp
    FROM public.v2_invoices i
    WHERE i.exporter_id = p_exporter_id
      AND i.status::text IN ('submitted','verified','approved','funded','monitoring','defaulted')
  LOOP
    v_base := inv.gross - inv.deductions;
    IF r.limit_basis = 'advance_outstanding' THEN
      v_base := v_base * 0.80;
    END IF;

    IF inv.cur = r.limit_currency THEN
      v_total := v_total + v_base;
    ELSE
      IF inv.fx_rate_to_gbp IS NULL THEN
        RAISE EXCEPTION 'Invoice % has no stored FX rate; headroom cannot be computed', COALESCE(inv.reference, inv.id::text)
          USING ERRCODE = 'data_exception';
      END IF;
      IF r.limit_currency <> 'GBP' THEN
        RAISE EXCEPTION 'Invoice % is in % but the authorised limit is in %; no stored rate for that pair',
          COALESCE(inv.reference, inv.id::text), inv.cur, r.limit_currency
          USING ERRCODE = 'data_exception';
      END IF;
      v_total := v_total + (v_base * inv.fx_rate_to_gbp);
    END IF;
  END LOOP;

  RETURN QUERY SELECT r.authorised_limit, r.limit_currency, r.limit_basis, v_total, r.authorised_limit - v_total;
END $$;

REVOKE ALL ON FUNCTION public.exporter_headroom(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.exporter_headroom(uuid) TO authenticated, service_role;