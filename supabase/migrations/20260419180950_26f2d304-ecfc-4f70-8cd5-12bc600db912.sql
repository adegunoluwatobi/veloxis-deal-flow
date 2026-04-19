-- 1. users: add phone
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Allow users to update their own row (full_name, phone)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. exporters: address fields + VAT
ALTER TABLE public.exporters
  ADD COLUMN IF NOT EXISTS registered_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS registered_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS registered_city TEXT,
  ADD COLUMN IF NOT EXISTS registered_postcode TEXT,
  ADD COLUMN IF NOT EXISTS registered_country TEXT,
  ADD COLUMN IF NOT EXISTS trading_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS trading_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS trading_city TEXT,
  ADD COLUMN IF NOT EXISTS trading_postcode TEXT,
  ADD COLUMN IF NOT EXISTS trading_country TEXT,
  ADD COLUMN IF NOT EXISTS trading_address_same_as_registered BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS primary_commodity TEXT;

-- 3. partner_organisations: org profile fields
ALTER TABLE public.partner_organisations
  ADD COLUMN IF NOT EXISTS registered_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS registered_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS registered_city TEXT,
  ADD COLUMN IF NOT EXISTS registered_postcode TEXT,
  ADD COLUMN IF NOT EXISTS registered_country TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS operating_countries TEXT[] DEFAULT '{}'::text[];

-- Allow partner_admin (only) to update their own org's profile
DROP POLICY IF EXISTS "Partner admins can update own org profile" ON public.partner_organisations;
CREATE POLICY "Partner admins can update own org profile"
  ON public.partner_organisations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'partner_admin'::app_role) AND id = get_partner_org_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'partner_admin'::app_role) AND id = get_partner_org_id(auth.uid()));

-- 4. kyc_profile_change_requests
CREATE TABLE IF NOT EXISTS public.kyc_profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id UUID NOT NULL REFERENCES public.exporters(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_change_requests_exporter ON public.kyc_profile_change_requests(exporter_id);
CREATE INDEX IF NOT EXISTS idx_kyc_change_requests_status ON public.kyc_profile_change_requests(status);

ALTER TABLE public.kyc_profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exporters can create own change requests"
  ON public.kyc_profile_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.exporters e WHERE e.id = exporter_id AND e.exporter_user_id = auth.uid())
  );

CREATE POLICY "Exporters can view own change requests"
  ON public.kyc_profile_change_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exporters e WHERE e.id = exporter_id AND e.exporter_user_id = auth.uid()));

CREATE POLICY "Partners can view org change requests"
  ON public.kyc_profile_change_requests FOR SELECT TO authenticated
  USING (
    is_partner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.exporters e
      WHERE e.id = exporter_id
        AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
    )
  );

CREATE POLICY "Partners can update org change requests"
  ON public.kyc_profile_change_requests FOR UPDATE TO authenticated
  USING (
    is_partner(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.exporters e
      WHERE e.id = exporter_id
        AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
    )
  );

CREATE POLICY "Veloxis staff full access to change requests"
  ON public.kyc_profile_change_requests FOR ALL TO authenticated
  USING (is_veloxis_staff(auth.uid()));

CREATE TRIGGER trg_kyc_change_requests_updated_at
  BEFORE UPDATE ON public.kyc_profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. New audit action enum values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'profile_updated' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'profile_updated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_change_requested' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'email_change_requested';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'password_changed' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'password_changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'force_password_reset' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'force_password_reset';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_suspended' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'user_suspended';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_reactivated' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'user_reactivated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_role_changed' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'user_role_changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'team_member_invited' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'team_member_invited';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'team_member_removed' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'team_member_removed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'org_profile_updated' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'org_profile_updated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'kyc_change_requested' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'kyc_change_requested';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'kyc_change_approved' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'kyc_change_approved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'kyc_change_rejected' AND enumtypid = 'public.audit_action'::regtype) THEN
    ALTER TYPE public.audit_action ADD VALUE 'kyc_change_rejected';
  END IF;
END$$;
