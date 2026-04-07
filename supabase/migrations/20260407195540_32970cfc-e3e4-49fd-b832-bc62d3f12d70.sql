-- Create status enum for change requests
CREATE TYPE public.change_request_status AS ENUM ('pending', 'resolved', 'cancelled');

-- Create deal_change_requests table
CREATE TABLE public.deal_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  fields_flagged JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.change_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.deal_change_requests ENABLE ROW LEVEL SECURITY;

-- Exporters can view change requests for their own deals
CREATE POLICY "Exporters can view own deal change requests"
ON public.deal_change_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.exporters e ON e.id = d.exporter_id
    WHERE d.id = deal_change_requests.deal_id
      AND e.exporter_user_id = auth.uid()
  )
);

-- Partners can view change requests for org deals
CREATE POLICY "Partners can view org deal change requests"
ON public.deal_change_requests
FOR SELECT
TO authenticated
USING (
  is_partner(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.exporters e ON e.id = d.exporter_id
    WHERE d.id = deal_change_requests.deal_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);

-- Partners can create change requests for org deals
CREATE POLICY "Partners can create org deal change requests"
ON public.deal_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
  is_partner(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.exporters e ON e.id = d.exporter_id
    WHERE d.id = deal_change_requests.deal_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);

-- Partners can update change requests for org deals
CREATE POLICY "Partners can update org deal change requests"
ON public.deal_change_requests
FOR UPDATE
TO authenticated
USING (
  is_partner(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.exporters e ON e.id = d.exporter_id
    WHERE d.id = deal_change_requests.deal_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);

-- Veloxis staff full access
CREATE POLICY "Veloxis staff full access to deal change requests"
ON public.deal_change_requests
FOR ALL
TO authenticated
USING (is_veloxis_staff(auth.uid()));
