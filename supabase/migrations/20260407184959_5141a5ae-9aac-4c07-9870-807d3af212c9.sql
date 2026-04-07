CREATE POLICY "Partners can view org exporters"
ON public.exporters
FOR SELECT
TO authenticated
USING (
  public.is_partner(auth.uid())
  AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(originator_id))
);

CREATE POLICY "Partners can view org exporter docs"
ON public.exporter_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.exporters e
    WHERE e.id = exporter_documents.exporter_id
      AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
  )
);

CREATE POLICY "Partners can insert org exporter docs"
ON public.exporter_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.exporters e
    WHERE e.id = exporter_documents.exporter_id
      AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
  )
);

CREATE POLICY "Partners can update org exporter docs"
ON public.exporter_documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.exporters e
    WHERE e.id = exporter_documents.exporter_id
      AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.exporters e
    WHERE e.id = exporter_documents.exporter_id
      AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
  )
);