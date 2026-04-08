-- Add new deal document types for trade pack
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'packing_list';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'insurance_certificate';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'nxp_form';
ALTER TYPE public.deal_document_type ADD VALUE IF NOT EXISTS 'export_licence';

-- Allow exporters to insert deal documents for their own deals
CREATE POLICY "Exporters can insert deal docs on own deals"
ON public.deal_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM deals d
    JOIN exporters e ON e.id = d.exporter_id
    WHERE d.id = deal_documents.deal_id
      AND e.exporter_user_id = auth.uid()
  )
);

-- Allow exporters to view deal documents for their own deals
CREATE POLICY "Exporters can view own deal docs"
ON public.deal_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM deals d
    JOIN exporters e ON e.id = d.exporter_id
    WHERE d.id = deal_documents.deal_id
      AND e.exporter_user_id = auth.uid()
  )
);

-- Allow partners to view deal docs for org deals
CREATE POLICY "Partners can view org deal docs"
ON public.deal_documents
FOR SELECT
TO authenticated
USING (
  is_partner(auth.uid()) AND EXISTS (
    SELECT 1 FROM deals d
    JOIN exporters e ON e.id = d.exporter_id
    WHERE d.id = deal_documents.deal_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);