-- Add new deal statuses
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'changes_requested';
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'sent_to_veloxis';
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'rejected_by_partner';
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'rejected_by_veloxis';

-- Add NGN to invoice currency
ALTER TYPE public.invoice_currency ADD VALUE IF NOT EXISTS 'NGN';