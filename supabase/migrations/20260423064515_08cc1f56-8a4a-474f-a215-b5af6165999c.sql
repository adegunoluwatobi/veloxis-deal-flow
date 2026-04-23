-- Add quick KYB fields to partner_applications
ALTER TABLE public.partner_applications
  ADD COLUMN IF NOT EXISTS company_registration_number text,
  ADD COLUMN IF NOT EXISTS country_of_incorporation text,
  ADD COLUMN IF NOT EXISTS registered_address_line1 text,
  ADD COLUMN IF NOT EXISTS registered_city text,
  ADD COLUMN IF NOT EXISTS registered_postcode text,
  ADD COLUMN IF NOT EXISTS registered_country text;

-- Allow partner_admin to update their own org's KYB submission fields
DROP POLICY IF EXISTS "Partner admin can submit KYB" ON public.partner_organisations;
CREATE POLICY "Partner admin can submit KYB"
ON public.partner_organisations
FOR UPDATE
TO authenticated
USING (
  is_partner(auth.uid())
  AND has_role(auth.uid(), 'partner_admin'::app_role)
  AND id = get_partner_org_id(auth.uid())
)
WITH CHECK (
  is_partner(auth.uid())
  AND has_role(auth.uid(), 'partner_admin'::app_role)
  AND id = get_partner_org_id(auth.uid())
);

-- Allow partner_admin to view their org
DROP POLICY IF EXISTS "Partners can view own organisation" ON public.partner_organisations;
CREATE POLICY "Partners can view own organisation"
ON public.partner_organisations
FOR SELECT
TO authenticated
USING (
  is_partner(auth.uid())
  AND id = get_partner_org_id(auth.uid())
);

-- Audit action enum addition (idempotent)
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_submitted';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_approved';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_rejected';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_doc_requested';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'partner_kyb_doc_uploaded';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;