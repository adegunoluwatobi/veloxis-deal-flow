CREATE OR REPLACE FUNCTION public.v2_can_view_exporter(_uid uuid, _exporter_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.v2_exporters e
    WHERE e.id = _exporter_id AND (
      e.owner_user_id = _uid
      OR public.has_app_role(_uid,'super_admin')
      OR public.has_app_role(_uid,'credit_officer')
      OR public.has_app_role(_uid,'approver')
      OR (public.has_app_role(_uid,'originator') AND (
        e.created_by = _uid
        OR EXISTS (SELECT 1 FROM public.kyb_invites k WHERE k.created_by = _uid AND (k.exporter_id = e.id OR k.id = e.invite_id))
        OR EXISTS (SELECT 1 FROM public.registration_invites r WHERE r.invited_by = _uid AND lower(r.email) = lower(e.email))
      ))
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.v2_can_view_exporter(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_can_view_exporter(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS exp_read ON public.v2_exporters;
CREATE POLICY exp_read ON public.v2_exporters FOR SELECT TO authenticated
  USING (public.v2_can_view_exporter(auth.uid(), id));
DROP POLICY IF EXISTS exp_update ON public.v2_exporters;
CREATE POLICY exp_update ON public.v2_exporters FOR UPDATE TO authenticated
  USING (public.v2_can_view_exporter(auth.uid(), id))
  WITH CHECK (public.v2_can_view_exporter(auth.uid(), id));

DROP POLICY IF EXISTS "Staff can read all directors" ON public.v2_exporter_directors;
CREATE POLICY "Staff can read all directors" ON public.v2_exporter_directors FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) AND public.v2_can_view_exporter(auth.uid(), exporter_id));

DROP POLICY IF EXISTS co_docs_select ON public.company_documents;
CREATE POLICY co_docs_select ON public.company_documents FOR SELECT TO authenticated
  USING ((public.is_v2_staff(auth.uid()) AND scan_status = 'clean' AND public.v2_can_view_exporter(auth.uid(), exporter_id))
         OR public.v2_owns_exporter(auth.uid(), exporter_id));