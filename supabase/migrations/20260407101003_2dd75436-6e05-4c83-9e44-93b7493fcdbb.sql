
-- Add columns to exporters
ALTER TABLE public.exporters ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.exporters ADD COLUMN IF NOT EXISTS forwarded_to_veloxis_at timestamptz;
ALTER TABLE public.exporters ADD COLUMN IF NOT EXISTS forwarded_to_veloxis_by uuid;
ALTER TABLE public.exporters ADD COLUMN IF NOT EXISTS exporter_user_id uuid;

-- Add uploaded_by_role to exporter_documents
ALTER TABLE public.exporter_documents ADD COLUMN IF NOT EXISTS uploaded_by_role text DEFAULT 'originator';

-- RLS: Greystar originators can view all exporters
CREATE POLICY "Greystar originators can view all exporters"
ON public.exporters FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'greystar_originator'::app_role));

-- RLS: Greystar originators can create exporters
CREATE POLICY "Greystar originators can create exporters"
ON public.exporters FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'greystar_originator'::app_role));

-- RLS: Greystar originators can update exporters
CREATE POLICY "Greystar originators can update exporters"
ON public.exporters FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'greystar_originator'::app_role));

-- RLS: Exporters can view their own exporter profile
CREATE POLICY "Exporters can view own profile"
ON public.exporters FOR SELECT
TO authenticated
USING (exporter_user_id = auth.uid());

-- RLS: Greystar originators can view all exporter documents
CREATE POLICY "Greystar originators can view all exporter docs"
ON public.exporter_documents FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'greystar_originator'::app_role));

-- RLS: Greystar originators can insert exporter documents
CREATE POLICY "Greystar originators can insert exporter docs"
ON public.exporter_documents FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'greystar_originator'::app_role));

-- RLS: Greystar originators can update exporter documents
CREATE POLICY "Greystar originators can update exporter docs"
ON public.exporter_documents FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'greystar_originator'::app_role));

-- RLS: Exporters can view docs for their own profile
CREATE POLICY "Exporters can view own exporter docs"
ON public.exporter_documents FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.exporters
  WHERE exporters.id = exporter_documents.exporter_id
  AND exporters.exporter_user_id = auth.uid()
));

-- RLS: Exporters can upload docs to their own profile
CREATE POLICY "Exporters can upload own docs"
ON public.exporter_documents FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.exporters
  WHERE exporters.id = exporter_documents.exporter_id
  AND exporters.exporter_user_id = auth.uid()
));

-- RLS: Greystar originators can view audit logs
CREATE POLICY "Greystar originators can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'greystar_originator'::app_role));

-- RLS: Greystar originators can view all deals (read-only)
CREATE POLICY "Greystar originators can view all deals"
ON public.deals FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'greystar_originator'::app_role));

-- RLS: Greystar originators can manage upload tokens
CREATE POLICY "Greystar originators can manage upload tokens"
ON public.exporter_upload_tokens FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'greystar_originator'::app_role));
