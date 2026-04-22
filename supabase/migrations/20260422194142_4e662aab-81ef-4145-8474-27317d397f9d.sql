
-- ============================================================
-- Partner KYB foundation
-- ============================================================

-- 1) Status enum for partner KYB
DO $$ BEGIN
  CREATE TYPE public.partner_kyb_status AS ENUM (
    'not_started',
    'submitted',
    'verified',
    'rejected',
    'additional_docs_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Partner KYB document type enum
DO $$ BEGIN
  CREATE TYPE public.partner_document_type AS ENUM (
    'certificate_of_incorporation',
    'proof_of_registered_address',
    'director_id',
    'additional'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Add KYB columns to partner_organisations
ALTER TABLE public.partner_organisations
  ADD COLUMN IF NOT EXISTS kyb_status public.partner_kyb_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS kyb_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyb_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyb_verified_by uuid,
  ADD COLUMN IF NOT EXISTS kyb_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyb_rejected_by uuid,
  ADD COLUMN IF NOT EXISTS kyb_rejection_reason text,
  ADD COLUMN IF NOT EXISTS company_registration_number text,
  ADD COLUMN IF NOT EXISTS country_of_incorporation text;

-- Backfill existing orgs as verified (legacy partners pre-KYB)
UPDATE public.partner_organisations
SET kyb_status = 'verified',
    kyb_submitted_at = COALESCE(kyb_submitted_at, created_at),
    kyb_verified_at = COALESCE(kyb_verified_at, created_at)
WHERE kyb_status = 'not_started';

-- 4) Partner documents table (mirrors exporter_documents)
CREATE TABLE IF NOT EXISTS public.partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_organisation_id uuid NOT NULL REFERENCES public.partner_organisations(id) ON DELETE CASCADE,
  document_type public.partner_document_type NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_superseded boolean NOT NULL DEFAULT false,
  document_status text NOT NULL DEFAULT 'pending_review',
  verified_at timestamptz,
  verified_by uuid,
  document_request_id uuid,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_partner_documents_org ON public.partner_documents(partner_organisation_id);
CREATE INDEX IF NOT EXISTS idx_partner_documents_active ON public.partner_documents(partner_organisation_id, document_type) WHERE is_superseded = false;

ALTER TABLE public.partner_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view own org docs" ON public.partner_documents;
CREATE POLICY "Partners can view own org docs"
  ON public.partner_documents FOR SELECT TO authenticated
  USING (is_partner_in_org(auth.uid(), partner_organisation_id));

DROP POLICY IF EXISTS "Partner admins can insert own org docs" ON public.partner_documents;
CREATE POLICY "Partner admins can insert own org docs"
  ON public.partner_documents FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'partner_admin'::app_role)
    AND is_partner_in_org(auth.uid(), partner_organisation_id)
  );

DROP POLICY IF EXISTS "Veloxis staff full access to partner docs" ON public.partner_documents;
CREATE POLICY "Veloxis staff full access to partner docs"
  ON public.partner_documents FOR ALL TO authenticated
  USING (is_veloxis_staff(auth.uid()))
  WITH CHECK (is_veloxis_staff(auth.uid()));

-- Auto-supersede previous active doc of the same type
CREATE OR REPLACE FUNCTION public.auto_supersede_partner_doc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_documents
  SET is_superseded = true
  WHERE partner_organisation_id = NEW.partner_organisation_id
    AND document_type = NEW.document_type
    AND id <> NEW.id
    AND is_superseded = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_supersede_partner_doc ON public.partner_documents;
CREATE TRIGGER trg_auto_supersede_partner_doc
  AFTER INSERT ON public.partner_documents
  FOR EACH ROW EXECUTE FUNCTION public.auto_supersede_partner_doc();

-- 5) Partner document requests table
CREATE TABLE IF NOT EXISTS public.partner_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_organisation_id uuid NOT NULL REFERENCES public.partner_organisations(id) ON DELETE CASCADE,
  document_title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending_upload',
  requested_by uuid NOT NULL,
  fulfilled_at timestamptz,
  uploaded_doc_id uuid REFERENCES public.partner_documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_doc_requests_org ON public.partner_document_requests(partner_organisation_id, status);

ALTER TABLE public.partner_document_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners view own doc requests" ON public.partner_document_requests;
CREATE POLICY "Partners view own doc requests"
  ON public.partner_document_requests FOR SELECT TO authenticated
  USING (is_partner_in_org(auth.uid(), partner_organisation_id));

DROP POLICY IF EXISTS "Partner admins can update own doc requests" ON public.partner_document_requests;
CREATE POLICY "Partner admins can update own doc requests"
  ON public.partner_document_requests FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'partner_admin'::app_role)
    AND is_partner_in_org(auth.uid(), partner_organisation_id)
  );

DROP POLICY IF EXISTS "Veloxis staff full access to partner doc requests" ON public.partner_document_requests;
CREATE POLICY "Veloxis staff full access to partner doc requests"
  ON public.partner_document_requests FOR ALL TO authenticated
  USING (is_veloxis_staff(auth.uid()))
  WITH CHECK (is_veloxis_staff(auth.uid()));

CREATE TRIGGER trg_partner_doc_requests_updated_at
  BEFORE UPDATE ON public.partner_document_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Lock partner_organisations edits to super_admin (replace existing UPDATE policy if any)
DROP POLICY IF EXISTS "Partner admins can update own org" ON public.partner_organisations;
DROP POLICY IF EXISTS "Super admins manage partner organisations" ON public.partner_organisations;
CREATE POLICY "Super admins manage partner organisations"
  ON public.partner_organisations FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Keep partner read access intact
DROP POLICY IF EXISTS "Partners can view own org" ON public.partner_organisations;
CREATE POLICY "Partners can view own org"
  ON public.partner_organisations FOR SELECT TO authenticated
  USING (
    is_partner_in_org(auth.uid(), id)
    OR is_veloxis_staff(auth.uid())
  );

-- 7) Audit action enum additions (best effort — ignore if already present)
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_submitted';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_approved';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_rejected';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_doc_requested';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_doc_uploaded';
EXCEPTION WHEN others THEN NULL; END $$;
