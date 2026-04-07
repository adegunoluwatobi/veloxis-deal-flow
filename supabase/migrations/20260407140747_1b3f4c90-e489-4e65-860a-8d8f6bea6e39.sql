ALTER TABLE public.exporters
  ADD COLUMN IF NOT EXISTS invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_accepted_at timestamptz;