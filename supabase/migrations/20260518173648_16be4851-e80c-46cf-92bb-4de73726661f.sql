
CREATE TABLE public.nbcc_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company_name text NOT NULL,
  email text NOT NULL,
  whatsapp_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nbcc_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit nbcc leads"
ON public.nbcc_leads FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(coalesce(full_name,'')) > 0
  AND length(coalesce(company_name,'')) > 0
  AND length(coalesce(email,'')) > 0
  AND length(coalesce(whatsapp_number,'')) > 0
);

CREATE POLICY "Staff can view nbcc leads"
ON public.nbcc_leads FOR SELECT
TO authenticated
USING (is_veloxis_staff(auth.uid()));

CREATE INDEX idx_nbcc_leads_created_at ON public.nbcc_leads (created_at DESC);
