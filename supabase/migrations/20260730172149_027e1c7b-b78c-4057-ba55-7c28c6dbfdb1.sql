CREATE POLICY "v2 exporters can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'veloxis-documents'
  AND (storage.foldername(name))[1] = 'v2'
  AND (storage.foldername(name))[2] = 'exporters'
  AND (
    public.is_v2_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.v2_exporters e
      WHERE e.id::text = (storage.foldername(name))[3]
        AND e.owner_user_id = auth.uid()
    )
  )
);

CREATE POLICY "v2 exporters and staff can read v2 documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'veloxis-documents'
  AND (storage.foldername(name))[1] = 'v2'
  AND (
    public.is_v2_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.v2_exporters e
      WHERE e.id::text = (storage.foldername(name))[3]
        AND e.owner_user_id = auth.uid()
    )
  )
);

CREATE POLICY "v2 exporters can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'veloxis-documents'
  AND (storage.foldername(name))[1] = 'v2'
  AND (
    public.is_v2_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.v2_exporters e
      WHERE e.id::text = (storage.foldername(name))[3]
        AND e.owner_user_id = auth.uid()
    )
  )
);