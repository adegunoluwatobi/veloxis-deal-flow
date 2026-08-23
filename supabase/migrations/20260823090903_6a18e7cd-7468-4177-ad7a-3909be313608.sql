ALTER TABLE public.v2_invoices
  ADD COLUMN IF NOT EXISTS stage2_unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS stage2_unlocked_by uuid REFERENCES auth.users(id);