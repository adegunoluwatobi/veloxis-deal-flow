
CREATE TABLE IF NOT EXISTS public.registration_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  target_path TEXT NOT NULL DEFAULT '/apply/exporter',
  invited_by UUID,
  first_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_invites_email ON public.registration_invites (email);
CREATE INDEX IF NOT EXISTS idx_registration_invites_last_sent_at ON public.registration_invites (last_sent_at DESC);

ALTER TABLE public.registration_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view registration invites"
  ON public.registration_invites FOR SELECT
  TO authenticated
  USING (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Admins can insert registration invites"
  ON public.registration_invites FOR INSERT
  TO authenticated
  WITH CHECK (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Admins can update registration invites"
  ON public.registration_invites FOR UPDATE
  TO authenticated
  USING (public.is_veloxis_staff(auth.uid()))
  WITH CHECK (public.is_veloxis_staff(auth.uid()));

CREATE TRIGGER trg_registration_invites_updated_at
  BEFORE UPDATE ON public.registration_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
