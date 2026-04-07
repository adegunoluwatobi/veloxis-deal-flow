-- Create onboarding status enum
CREATE TYPE public.onboarding_status AS ENUM (
  'invited',
  'password_set',
  'onboarding_in_progress',
  'onboarding_submitted',
  'onboarding_approved',
  'onboarding_rejected'
);

-- Add onboarding_status column to exporters
ALTER TABLE public.exporters
ADD COLUMN onboarding_status public.onboarding_status NOT NULL DEFAULT 'invited';

-- Add new audit actions
ALTER TYPE public.audit_action ADD VALUE 'onboarding_submitted';
ALTER TYPE public.audit_action ADD VALUE 'onboarding_approved';
ALTER TYPE public.audit_action ADD VALUE 'onboarding_rejected';

-- Allow exporters to update their own profile during onboarding
CREATE POLICY "Exporters can update own profile during onboarding"
ON public.exporters
FOR UPDATE
TO authenticated
USING (
  exporter_user_id = auth.uid()
  AND onboarding_status IN ('password_set', 'onboarding_in_progress', 'onboarding_rejected')
)
WITH CHECK (
  exporter_user_id = auth.uid()
  AND onboarding_status IN ('password_set', 'onboarding_in_progress', 'onboarding_submitted', 'onboarding_rejected')
);

-- Allow partner users to update onboarding status for their org's exporters
CREATE POLICY "Partners can approve onboarding for own org exporters"
ON public.exporters
FOR UPDATE
TO authenticated
USING (
  is_partner(auth.uid())
  AND originator_id IN (
    SELECT ur.user_id FROM user_roles ur
    WHERE ur.partner_organisation_id = get_partner_org_id(auth.uid())
    AND ur.role IN ('partner_admin', 'partner_staff')
  )
)
WITH CHECK (
  is_partner(auth.uid())
  AND originator_id IN (
    SELECT ur.user_id FROM user_roles ur
    WHERE ur.partner_organisation_id = get_partner_org_id(auth.uid())
    AND ur.role IN ('partner_admin', 'partner_staff')
  )
);