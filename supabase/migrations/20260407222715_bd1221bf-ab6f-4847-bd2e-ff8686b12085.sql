
-- 1. Add payment_received to deal_status enum
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'payment_received' AFTER 'overdue';

-- 2. Add IPU and payment advice document types
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'ipu_signed' AFTER 'other';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'payment_advice' AFTER 'ipu_signed';

-- 3. Add payment and IPU columns to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_amount_received numeric,
  ADD COLUMN IF NOT EXISTS payment_advice_doc_id uuid REFERENCES public.deal_documents(id),
  ADD COLUMN IF NOT EXISTS late_penalty_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overdue_days_at_payment integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS residual_balance numeric,
  ADD COLUMN IF NOT EXISTS exporter_receipt_confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ipu_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ipu_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ipu_verified_by uuid REFERENCES auth.users(id);

-- 4. Add audit action for payment advice
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_advice_submitted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ipu_verified';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'exporter_receipt_confirmed';
