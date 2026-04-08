
CREATE POLICY "Partners can insert org UBO declarations"
ON public.ubo_declarations
FOR INSERT
TO authenticated
WITH CHECK (
  is_partner(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = ubo_declarations.exporter_id
    AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);

CREATE POLICY "Partners can update org UBO declarations"
ON public.ubo_declarations
FOR UPDATE
TO authenticated
USING (
  is_partner(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = ubo_declarations.exporter_id
    AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
)
WITH CHECK (
  is_partner(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = ubo_declarations.exporter_id
    AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);

CREATE POLICY "Partners can delete org UBO declarations"
ON public.ubo_declarations
FOR DELETE
TO authenticated
USING (
  is_partner(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = ubo_declarations.exporter_id
    AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);
