-- 1. Enum for pipeline_status
DO $$ BEGIN
  CREATE TYPE public.pipeline_status AS ENUM (
    'invited',
    'onboarding_started',
    'pending_documents',
    'under_review',
    'pending_veloxis',
    'routed',
    'approved',
    'rejected',
    'expansion'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. New columns on exporters
ALTER TABLE public.exporters
  ADD COLUMN IF NOT EXISTS pipeline_status public.pipeline_status NOT NULL DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS routed_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS expansion_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 3. Compute function
CREATE OR REPLACE FUNCTION public.compute_pipeline_status(_exporter public.exporters)
RETURNS public.pipeline_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_count integer;
  v_required_count integer := 2; -- source_of_funds_doc + bank_statements (matches onboarding spec)
BEGIN
  -- Terminal states first
  IF _exporter.rejected_at IS NOT NULL THEN
    RETURN 'rejected'::public.pipeline_status;
  END IF;

  IF _exporter.activated_at IS NOT NULL THEN
    RETURN 'approved'::public.pipeline_status;
  END IF;

  IF _exporter.expansion_override THEN
    RETURN 'expansion'::public.pipeline_status;
  END IF;

  IF _exporter.routed_at IS NOT NULL THEN
    -- Guard: routed requires an originator (partner). Without one, fall back.
    IF _exporter.originator_id IS NULL THEN
      RETURN 'pending_veloxis'::public.pipeline_status;
    END IF;
    RETURN 'routed'::public.pipeline_status;
  END IF;

  IF _exporter.forwarded_to_veloxis_at IS NOT NULL THEN
    RETURN 'pending_veloxis'::public.pipeline_status;
  END IF;

  -- Onboarding submission gives us at least under_review when docs are present
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

  -- Default: invited (covers onboarding_status = 'invited')
  RETURN 'invited'::public.pipeline_status;
END;
$$;

-- 4. Trigger to auto-update pipeline_status on exporter changes
CREATE OR REPLACE FUNCTION public.exporters_set_pipeline_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.pipeline_status := public.compute_pipeline_status(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exporters_pipeline_status ON public.exporters;
CREATE TRIGGER trg_exporters_pipeline_status
BEFORE INSERT OR UPDATE ON public.exporters
FOR EACH ROW
EXECUTE FUNCTION public.exporters_set_pipeline_status();

-- 5. Trigger on exporter_documents to recompute the parent exporter's status
CREATE OR REPLACE FUNCTION public.exporter_documents_recompute_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exporter_id uuid;
BEGIN
  v_exporter_id := COALESCE(NEW.exporter_id, OLD.exporter_id);
  IF v_exporter_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  -- Touch the exporter row so its BEFORE-UPDATE trigger recomputes status
  UPDATE public.exporters SET updated_at = now() WHERE id = v_exporter_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_exporter_docs_pipeline ON public.exporter_documents;
CREATE TRIGGER trg_exporter_docs_pipeline
AFTER INSERT OR UPDATE OR DELETE ON public.exporter_documents
FOR EACH ROW
EXECUTE FUNCTION public.exporter_documents_recompute_pipeline();

-- 6. Backfill pipeline_status for all existing exporters
UPDATE public.exporters e
SET pipeline_status = public.compute_pipeline_status(e),
    activated_at = CASE
      WHEN e.activated_at IS NOT NULL THEN e.activated_at
      WHEN e.onboarding_status = 'onboarding_approved' AND e.is_active THEN COALESCE(e.kyc_verified_at, e.updated_at)
      ELSE NULL
    END;

-- Run the backfill twice so activated_at populated above re-resolves to 'approved'
UPDATE public.exporters SET updated_at = now() WHERE true;