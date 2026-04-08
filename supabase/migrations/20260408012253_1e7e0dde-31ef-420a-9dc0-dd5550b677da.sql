ALTER TABLE public.deal_documents
ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.deal_documents
ADD COLUMN verified_at timestamptz,
ADD COLUMN verified_by uuid;