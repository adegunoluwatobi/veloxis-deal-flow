-- Buyer verification fields (Companies House)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS buyer_ch_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buyer_ch_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_ch_verified_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS buyer_ch_verified_by_role public.app_role,
  ADD COLUMN IF NOT EXISTS buyer_ch_company_number text,
  ADD COLUMN IF NOT EXISTS buyer_ch_company_status text,
  ADD COLUMN IF NOT EXISTS buyer_ch_company_name text,
  ADD COLUMN IF NOT EXISTS buyer_ch_registered_address text,
  ADD COLUMN IF NOT EXISTS buyer_ch_sic_codes text[],
  ADD COLUMN IF NOT EXISTS buyer_ch_search_term text,
  ADD COLUMN IF NOT EXISTS buyer_ch_found boolean,
  ADD COLUMN IF NOT EXISTS buyer_ch_raw_response jsonb;

-- Add the audit action enum value (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'buyer_ch_verified'
      AND enumtypid = 'public.audit_action'::regtype
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'buyer_ch_verified';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'buyer_ch_not_found'
      AND enumtypid = 'public.audit_action'::regtype
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'buyer_ch_not_found';
  END IF;
END $$;