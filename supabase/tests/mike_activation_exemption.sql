DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.v2_exporters
  WHERE id='0dc60078-67c3-40a5-9414-50e5f5d76749' AND onboarding_status='active'
  AND single_reviewer_approved) THEN
  RAISE EXCEPTION 'Mike activation exemption is missing';
 END IF;
 IF (SELECT count(*) FROM public.onboarding_reviews
  WHERE exporter_id='0dc60078-67c3-40a5-9414-50e5f5d76749'
  AND stage='compliance' AND decision='approved'
  AND override_reason='User-authorised one-time exemption for Mike / PROXEIRA LIMITED: Board resolution authorising the facility; Six month bank statement; Domiciliary account details. Activation only; no document approval, security clearance, or invoice/funding waiver.') <> 1 THEN
  RAISE EXCEPTION 'Expected exactly one audited activation exemption';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.company_documents
  WHERE exporter_id='0dc60078-67c3-40a5-9414-50e5f5d76749'
  AND original_filename='STMT_ENT_BOOK_AAA (30).pdf' AND scan_status='flagged' AND status='pending') THEN
  RAISE EXCEPTION 'Activation exemption must not clear the bank statement security flag or approve it';
 END IF;
END $$;