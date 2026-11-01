-- Regression checks run transactionally; no review rows are persisted.
BEGIN;
SELECT set_config('request.jwt.claim.sub', '656b2c16-a731-4a36-8e8b-13472a9a626d', true);
DO $$
DECLARE
 review public.onboarding_reviews;
 blocked boolean;
BEGIN
 SELECT * INTO STRICT review FROM public.onboarding_reviews
 WHERE exporter_id='0dc60078-67c3-40a5-9414-50e5f5d76749'
 AND stage='compliance' AND decision='approved'
 AND override_reason='User-authorised one-time exemption for Mike / PROXEIRA LIMITED: Board resolution authorising the facility; Six month bank statement; Domiciliary account details. Activation only; no document approval, security clearance, or invoice/funding waiver.';
 -- The already-used waiver cannot be reused for Mike.
 review.id := gen_random_uuid();
 blocked := false;
 BEGIN
  INSERT INTO public.onboarding_reviews SELECT (review).*;
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM NOT LIKE 'The board resolution must be transcribed%' THEN RAISE; END IF;
  blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'One-time waiver was incorrectly reusable'; END IF;
 -- The same reason cannot exempt another exporter without a valid resolution.
 SELECT id INTO STRICT review.exporter_id FROM public.v2_exporters
 WHERE email='adegunoluwatobi+25@gmail.com';
 review.id := gen_random_uuid();
 blocked := false;
 BEGIN
  INSERT INTO public.onboarding_reviews SELECT (review).*;
 EXCEPTION WHEN check_violation THEN
  IF SQLERRM NOT LIKE 'The board resolution must be transcribed%' THEN RAISE; END IF;
  blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Mike waiver incorrectly exempted another exporter'; END IF;
END $$;
ROLLBACK;