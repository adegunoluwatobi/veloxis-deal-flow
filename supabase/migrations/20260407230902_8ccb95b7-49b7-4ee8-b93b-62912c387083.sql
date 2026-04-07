
-- Table for per-deal document requests from Veloxis
CREATE TABLE public.deal_doc_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  label TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL,
  uploaded_doc_id UUID REFERENCES public.deal_documents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_doc_requests ENABLE ROW LEVEL SECURITY;

-- Veloxis staff full access
CREATE POLICY "Veloxis staff full access to deal_doc_requests"
  ON public.deal_doc_requests FOR ALL
  TO authenticated
  USING (is_veloxis_staff(auth.uid()));

-- Partners can view requests for their org deals
CREATE POLICY "Partners can view org deal_doc_requests"
  ON public.deal_doc_requests FOR SELECT
  TO authenticated
  USING (
    is_partner(auth.uid()) AND EXISTS (
      SELECT 1 FROM deals d
      JOIN exporters e ON e.id = d.exporter_id
      WHERE d.id = deal_doc_requests.deal_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
    )
  );

-- Exporters can view requests for own deals
CREATE POLICY "Exporters can view own deal_doc_requests"
  ON public.deal_doc_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      JOIN exporters e ON e.id = d.exporter_id
      WHERE d.id = deal_doc_requests.deal_id
      AND e.exporter_user_id = auth.uid()
    )
  );

-- Exporters can update requests for own deals (to link uploaded doc)
CREATE POLICY "Exporters can update own deal_doc_requests"
  ON public.deal_doc_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      JOIN exporters e ON e.id = d.exporter_id
      WHERE d.id = deal_doc_requests.deal_id
      AND e.exporter_user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_deal_doc_requests_updated_at
  BEFORE UPDATE ON public.deal_doc_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
