
-- Buyers KYB expansion
ALTER TABLE public.v2_buyers
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS incorporation_date date,
  ADD COLUMN IF NOT EXISTS country_of_incorporation text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS kyb_status public.v2_kyc_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kyb_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyb_verified_by uuid,
  ADD COLUMN IF NOT EXISTS kyb_notes text;

-- Profiles activity tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_signed_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;

-- Enforce mutual exclusivity between 'exporter' and staff roles
CREATE OR REPLACE FUNCTION public.enforce_exporter_role_exclusive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'exporter' THEN
    IF EXISTS (SELECT 1 FROM public.app_user_roles WHERE user_id = NEW.user_id AND role <> 'exporter') THEN
      RAISE EXCEPTION 'Exporter role cannot be combined with staff roles';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.app_user_roles WHERE user_id = NEW.user_id AND role = 'exporter') THEN
      RAISE EXCEPTION 'Staff roles cannot be assigned to an exporter user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_exporter_role_exclusive ON public.app_user_roles;
CREATE TRIGGER trg_enforce_exporter_role_exclusive
BEFORE INSERT ON public.app_user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_exporter_role_exclusive();
