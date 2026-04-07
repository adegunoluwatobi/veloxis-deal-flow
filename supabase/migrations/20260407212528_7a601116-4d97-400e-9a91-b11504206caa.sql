
CREATE POLICY "Partners can update org deals"
ON public.deals
FOR UPDATE
TO authenticated
USING (
  is_partner(auth.uid())
  AND status IN ('draft', 'submitted', 'changes_requested')
  AND EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = deals.exporter_id
    AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
)
WITH CHECK (
  is_partner(auth.uid())
  AND status IN ('submitted', 'changes_requested', 'rejected_by_partner', 'sent_to_veloxis')
  AND EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = deals.exporter_id
    AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);
