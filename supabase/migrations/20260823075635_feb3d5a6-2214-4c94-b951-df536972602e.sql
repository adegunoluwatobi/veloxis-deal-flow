DROP POLICY IF EXISTS co_docs_update_staff ON public.company_documents;
CREATE POLICY co_docs_update_staff ON public.company_documents
  FOR UPDATE TO authenticated
  USING (public.v2_can_review_documents(auth.uid()) OR public.v2_can_transcribe_resolution(auth.uid()))
  WITH CHECK (public.v2_can_review_documents(auth.uid()) OR public.v2_can_transcribe_resolution(auth.uid()));