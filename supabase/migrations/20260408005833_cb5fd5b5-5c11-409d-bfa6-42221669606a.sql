
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS residual_transfer_reference text,
  ADD COLUMN IF NOT EXISTS residual_remittance_doc_id uuid REFERENCES public.deal_documents(id),
  ADD COLUMN IF NOT EXISTS residual_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS residual_sent_by uuid;
