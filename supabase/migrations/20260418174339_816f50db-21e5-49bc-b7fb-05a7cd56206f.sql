-- 1) STORAGE — ownership-scoped
DROP POLICY IF EXISTS "Authenticated users can view own exporter docs" ON storage.objects;
CREATE POLICY "Owners and staff can view veloxis documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'veloxis-documents'
  AND (
    public.is_veloxis_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.exporter_documents ed
      JOIN public.exporters e ON e.id = ed.exporter_id
      WHERE ed.file_path = storage.objects.name
        AND e.exporter_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.deal_documents dd
      JOIN public.deals d ON d.id = dd.deal_id
      JOIN public.exporters e ON e.id = d.exporter_id
      WHERE dd.file_path = storage.objects.name
        AND e.exporter_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.exporter_documents ed
      JOIN public.exporters e ON e.id = ed.exporter_id
      WHERE ed.file_path = storage.objects.name
        AND public.is_partner(auth.uid())
        AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.deal_documents dd
      JOIN public.deals d ON d.id = dd.deal_id
      JOIN public.exporters e ON e.id = d.exporter_id
      WHERE dd.file_path = storage.objects.name
        AND public.is_partner(auth.uid())
        AND public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
    )
  )
);

-- 2) AUDIT LOGS — drop unscoped partner SELECT
DROP POLICY IF EXISTS "Partners can view audit logs" ON public.audit_logs;

-- 3) SYSTEM CONFIG — admin/deal_manager only
DROP POLICY IF EXISTS "Authenticated users can read system config" ON public.system_config;
CREATE POLICY "Veloxis staff can read system config"
ON public.system_config FOR SELECT
TO authenticated
USING (public.is_veloxis_staff(auth.uid()));

-- 4) TEST DATA CLEANUP
ALTER TABLE public.audit_logs DISABLE TRIGGER USER;

-- Delete audit logs tied to ALL deals owned by test exporters
DELETE FROM public.audit_logs
WHERE deal_id IN (
  SELECT id FROM public.deals
  WHERE exporter_id IN (
    SELECT id FROM public.exporters
    WHERE company_name IN ('Cocoa merchant', 'verdeimpacto')
       OR rc_number IN ('RC68782', 'RC12344')
  )
)
OR exporter_id IN (
  SELECT id FROM public.exporters
  WHERE company_name IN ('Cocoa merchant', 'verdeimpacto')
     OR rc_number IN ('RC68782', 'RC12344')
);

ALTER TABLE public.audit_logs ENABLE TRIGGER USER;

DELETE FROM public.exporter_applications
WHERE full_name IN ('tettet', 'hfjwg')
   OR company_name IN ('iuih', 'test');

DELETE FROM public.deals
WHERE exporter_id IN (
  SELECT id FROM public.exporters
  WHERE company_name IN ('Cocoa merchant', 'verdeimpacto')
     OR rc_number IN ('RC68782', 'RC12344')
);

DELETE FROM public.exporters
WHERE company_name IN ('Cocoa merchant', 'verdeimpacto')
   OR rc_number IN ('RC68782', 'RC12344');