
CREATE OR REPLACE FUNCTION public.compute_pipeline_status(_exporter exporters)
 RETURNS pipeline_status
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_count integer;
  v_required_count integer := 2;
BEGIN
  IF _exporter.rejected_at IS NOT NULL THEN
    RETURN 'rejected'::public.pipeline_status;
  END IF;

  -- "Approved" / Verified & Active now requires explicit KYC sign-off
  IF _exporter.activated_at IS NOT NULL AND _exporter.kyc_verified_at IS NOT NULL THEN
    RETURN 'approved'::public.pipeline_status;
  END IF;

  IF _exporter.expansion_override THEN
    RETURN 'expansion'::public.pipeline_status;
  END IF;

  IF _exporter.routed_at IS NOT NULL THEN
    IF _exporter.originator_id IS NULL THEN
      RETURN 'pending_veloxis'::public.pipeline_status;
    END IF;
    RETURN 'routed'::public.pipeline_status;
  END IF;

  IF _exporter.forwarded_to_veloxis_at IS NOT NULL THEN
    RETURN 'pending_veloxis'::public.pipeline_status;
  END IF;

  SELECT COUNT(DISTINCT document_type) INTO v_doc_count
  FROM public.exporter_documents
  WHERE exporter_id = _exporter.id
    AND is_superseded = false
    AND document_type IN ('source_of_funds_doc', 'bank_statements');

  IF _exporter.onboarding_status = 'onboarding_submitted' THEN
    IF v_doc_count >= v_required_count THEN
      RETURN 'under_review'::public.pipeline_status;
    END IF;
    RETURN 'pending_documents'::public.pipeline_status;
  END IF;

  IF _exporter.onboarding_status IN ('password_set', 'onboarding_in_progress', 'onboarding_rejected') THEN
    RETURN 'onboarding_started'::public.pipeline_status;
  END IF;

  RETURN 'invited'::public.pipeline_status;
END;
$function$;

-- Recompute for all rows so previously mis-labelled exporters refresh
UPDATE public.exporters SET updated_at = now();
