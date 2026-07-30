DROP POLICY IF EXISTS veloxis_docs_exporter_select ON storage.objects;
DROP POLICY IF EXISTS veloxis_docs_exporter_insert ON storage.objects;
DROP POLICY IF EXISTS veloxis_docs_exporter_update ON storage.objects;

CREATE POLICY veloxis_docs_exporter_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'veloxis-documents'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (public.is_v2_staff(auth.uid())
         OR public.v2_owns_exporter(auth.uid(), ((storage.foldername(name))[1])::uuid))
  );

CREATE POLICY veloxis_docs_exporter_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'veloxis-documents'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (storage.foldername(name))[2] IN ('invoices','company')
    AND (public.is_v2_staff(auth.uid())
         OR public.v2_owns_exporter(auth.uid(), ((storage.foldername(name))[1])::uuid))
  );

CREATE POLICY veloxis_docs_exporter_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'veloxis-documents'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (public.is_v2_staff(auth.uid())
         OR public.v2_owns_exporter(auth.uid(), ((storage.foldername(name))[1])::uuid))
  );