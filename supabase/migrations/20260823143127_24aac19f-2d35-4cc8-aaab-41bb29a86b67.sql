CREATE OR REPLACE FUNCTION public.guard_board_resolution_controls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.v2_can_transcribe_resolution(auth.uid()) THEN
      RAISE EXCEPTION 'You do not have permission to record a board resolution'
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
     AND NOT public.v2_can_transcribe_resolution(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to change the board resolution validity or verification status'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;