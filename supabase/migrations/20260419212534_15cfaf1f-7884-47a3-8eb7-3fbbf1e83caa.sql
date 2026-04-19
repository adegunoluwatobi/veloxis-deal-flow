
-- Add banking detail fields to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS beneficiary_bank_name text,
  ADD COLUMN IF NOT EXISTS beneficiary_swift_bic text,
  ADD COLUMN IF NOT EXISTS beneficiary_iban text,
  ADD COLUMN IF NOT EXISTS beneficiary_bank_address text,
  ADD COLUMN IF NOT EXISTS correspondent_bank_name text,
  ADD COLUMN IF NOT EXISTS correspondent_swift_bic text;

-- Add export licence number to exporter profile (sourced from onboarding/KYC)
ALTER TABLE public.exporters
  ADD COLUMN IF NOT EXISTS export_licence_number text;
