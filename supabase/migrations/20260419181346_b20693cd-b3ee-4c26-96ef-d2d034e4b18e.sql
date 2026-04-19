-- Defense-in-depth: explicitly block partner roles from reading admin pipeline tables.
-- Existing policies already restrict SELECT to platform admins, but adding RESTRICTIVE
-- policies guarantees partners receive zero rows even if a permissive policy is added later.

CREATE POLICY "Partners cannot read exporter_applications"
ON public.exporter_applications
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (NOT public.is_partner(auth.uid()));

CREATE POLICY "Partners cannot read partner_applications"
ON public.partner_applications
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (NOT public.is_partner(auth.uid()));
