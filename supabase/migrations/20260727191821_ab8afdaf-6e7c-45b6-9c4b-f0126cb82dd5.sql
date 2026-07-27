
DO $$ BEGIN
  CREATE TYPE public.v2_kyc_status AS ENUM ('not_started','pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.v2_exporters
  ADD COLUMN IF NOT EXISTS director_name text,
  ADD COLUMN IF NOT EXISTS director_email text,
  ADD COLUMN IF NOT EXISTS director_phone text,
  ADD COLUMN IF NOT EXISTS director_dob date,
  ADD COLUMN IF NOT EXISTS director_nationality text,
  ADD COLUMN IF NOT EXISTS director_id_type text,
  ADD COLUMN IF NOT EXISTS director_id_number text,
  ADD COLUMN IF NOT EXISTS director_address text,
  ADD COLUMN IF NOT EXISTS company_registration_number text,
  ADD COLUMN IF NOT EXISTS incorporation_date date,
  ADD COLUMN IF NOT EXISTS country_of_incorporation text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS kyc_status public.v2_kyc_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS kyb_status public.v2_kyc_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS kyc_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_verified_by uuid,
  ADD COLUMN IF NOT EXISTS kyb_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyb_verified_by uuid,
  ADD COLUMN IF NOT EXISTS kyc_notes text,
  ADD COLUMN IF NOT EXISTS kyb_notes text;
