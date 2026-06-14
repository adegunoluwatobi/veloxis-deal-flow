-- cron_log: staff-only reads
DROP POLICY IF EXISTS "Public read cron_log" ON public.cron_log;
CREATE POLICY "Staff read cron_log"
  ON public.cron_log
  FOR SELECT
  TO authenticated
  USING (public.is_veloxis_staff(auth.uid()));
REVOKE SELECT ON public.cron_log FROM anon;

-- opportunities: staff-only access
DROP POLICY IF EXISTS "Public read opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Auth update opportunities" ON public.opportunities;

CREATE POLICY "Staff read opportunities"
  ON public.opportunities
  FOR SELECT
  TO authenticated
  USING (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Staff update opportunities"
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING (public.is_veloxis_staff(auth.uid()))
  WITH CHECK (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Staff insert opportunities"
  ON public.opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Staff delete opportunities"
  ON public.opportunities
  FOR DELETE
  TO authenticated
  USING (public.is_veloxis_staff(auth.uid()));

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.opportunities FROM anon;

-- realtime deals broadcast: scope to entitled users
DROP POLICY IF EXISTS "Authenticated can receive scoped deal events" ON realtime.messages;

CREATE POLICY "Scoped deal realtime events"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE 'realtime:public:deals%'
    AND (
      public.is_veloxis_staff(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.deals d
        JOIN public.exporters e ON e.id = d.exporter_id
        WHERE 'realtime:public:deals:' || d.id::text = realtime.topic()
          AND (
            e.exporter_user_id = auth.uid()
            OR e.originator_id = auth.uid()
            OR public.is_partner_in_org(auth.uid(), public.get_partner_org_id(e.originator_id))
          )
      )
    )
  );
