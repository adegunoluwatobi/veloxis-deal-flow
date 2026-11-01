CREATE OR REPLACE FUNCTION public.v2_require_transcribed_resolution()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.stage = 'compliance' AND NEW.decision = 'approved' THEN
  IF NEW.exporter_id = '0dc60078-67c3-40a5-9414-50e5f5d76749'::uuid
     AND public.has_app_role(auth.uid(),'super_admin'::public.v2_app_role)
     AND NEW.reviewer_id = auth.uid()
     AND NEW.single_reviewer_override
     AND NEW.override_reason = 'User-authorised one-time exemption for Mike / PROXEIRA LIMITED: Board resolution authorising the facility; Six month bank statement; Domiciliary account details. Activation only; no document approval, security clearance, or invoice/funding waiver.'
     AND NOT EXISTS (SELECT 1 FROM public.onboarding_reviews r WHERE r.exporter_id = NEW.exporter_id AND r.stage = 'compliance' AND r.decision = 'approved' AND r.override_reason = NEW.override_reason)
  THEN
   RETURN NEW;
  END IF;
  IF NOT EXISTS (
   SELECT 1 FROM public.board_resolutions WHERE exporter_id = NEW.exporter_id
    AND verification_status = 'verified' AND superseded_by IS NULL
    AND valid_until >= (now() AT TIME ZONE 'Africa/Lagos')::date
  ) THEN
   RAISE EXCEPTION 'The board resolution must be transcribed before this exporter can be approved.' USING ERRCODE = 'check_violation';
  END IF;
 END IF;
 RETURN NEW;
END $$;