-- Allow Veloxis staff (super_admin, deal_manager) to insert exporter rows.
-- Needed for the Registration Pipeline "Assign Partner" admin flow,
-- where the admin creates an exporter on behalf of a partner organisation.
CREATE POLICY "Veloxis staff can insert exporters"
ON public.exporters
FOR INSERT
TO authenticated
WITH CHECK (public.is_veloxis_staff(auth.uid()));