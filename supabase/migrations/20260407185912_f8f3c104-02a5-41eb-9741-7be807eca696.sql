
-- Create status enum for document requests
CREATE TYPE public.document_request_status AS ENUM (
  'pending_upload',
  'uploaded_pending_review',
  'verified',
  'rejected',
  'cancelled'
);

-- Create document_requests table
CREATE TABLE public.document_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exporter_id UUID NOT NULL REFERENCES public.exporters(id) ON DELETE CASCADE,
  partner_organisation_id UUID REFERENCES public.partner_organisations(id),
  requested_by UUID NOT NULL REFERENCES public.users(id),
  document_title TEXT NOT NULL,
  description TEXT,
  expiry_required BOOLEAN NOT NULL DEFAULT true,
  status public.document_request_status NOT NULL DEFAULT 'pending_upload',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMP WITH TIME ZONE
);

-- Add document_request_id to exporter_documents
ALTER TABLE public.exporter_documents
ADD COLUMN document_request_id UUID REFERENCES public.document_requests(id);

-- Enable RLS
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

-- Partners can view requests for their org exporters
CREATE POLICY "Partners can view org document requests"
ON public.document_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = document_requests.exporter_id
      AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
  )
);

-- Partners can create requests for their org exporters
CREATE POLICY "Partners can create org document requests"
ON public.document_requests FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = document_requests.exporter_id
      AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
  )
);

-- Partners can update (cancel) requests for their org exporters
CREATE POLICY "Partners can update org document requests"
ON public.document_requests FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = document_requests.exporter_id
      AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
  )
);

-- Veloxis staff full access
CREATE POLICY "Veloxis staff full access to document requests"
ON public.document_requests FOR ALL TO authenticated
USING (public.is_veloxis_staff(auth.uid()));

-- Exporters can view their own requests
CREATE POLICY "Exporters can view own document requests"
ON public.document_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = document_requests.exporter_id
      AND e.exporter_user_id = auth.uid()
  )
);
