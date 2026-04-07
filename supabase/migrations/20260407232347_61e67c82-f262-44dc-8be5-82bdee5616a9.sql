
-- Add new enum values
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'pending_exporter_acceptance';
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'declined_by_exporter';

-- Add offer acceptance/decline columns
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS offer_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_accepted_by uuid,
  ADD COLUMN IF NOT EXISTS offer_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_declined_by uuid,
  ADD COLUMN IF NOT EXISTS offer_decline_reason text;
