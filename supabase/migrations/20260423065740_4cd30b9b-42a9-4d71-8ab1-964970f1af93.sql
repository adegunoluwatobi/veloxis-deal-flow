DROP POLICY IF EXISTS "Anyone can submit exporter application" ON public.exporter_applications;

CREATE POLICY "Public can submit exporter application"
ON public.exporter_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND admin_notes IS NULL
  AND length(coalesce(email, '')) > 0
  AND length(coalesce(company_name, '')) > 0
);