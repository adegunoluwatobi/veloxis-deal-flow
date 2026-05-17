DROP POLICY IF EXISTS "Public can submit exporter application" ON public.exporter_applications;
CREATE POLICY "Public can submit exporter application"
ON public.exporter_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status IN ('pending','routed','pending_expansion')
  AND admin_notes IS NULL
  AND length(COALESCE(email,'')) > 0
  AND length(COALESCE(company_name,'')) > 0
);