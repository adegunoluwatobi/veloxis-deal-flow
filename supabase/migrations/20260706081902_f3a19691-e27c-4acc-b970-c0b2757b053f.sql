
-- 1. Lock down insert_audit_log RPC
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(uuid, uuid, app_role, audit_action, jsonb, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(uuid, uuid, app_role, audit_action, jsonb, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(uuid, uuid, app_role, audit_action, jsonb, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_deal_id uuid DEFAULT NULL::uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_user_role app_role DEFAULT NULL::app_role,
  p_action_type audit_action DEFAULT NULL::audit_action,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_exporter_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Only service_role (edge functions) or trusted staff may write audit rows.
  IF COALESCE(v_role, '') <> 'service_role'
     AND NOT (auth.uid() IS NOT NULL AND public.is_veloxis_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised to write audit logs' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.audit_logs (deal_id, user_id, user_role, action_type, metadata, exporter_id)
  VALUES (p_deal_id, p_user_id, p_user_role, p_action_type, p_metadata, p_exporter_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.insert_audit_log(uuid, uuid, app_role, audit_action, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(uuid, uuid, app_role, audit_action, jsonb, uuid) TO service_role;

-- 2. Allow exporters and partners to read IPUs for deals they own
CREATE POLICY "Exporters can view IPUs for their own deals"
ON public.ipus FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.exporters e ON e.id = d.exporter_id
    WHERE d.id = ipus.deal_id AND e.exporter_user_id = auth.uid()
  )
);

CREATE POLICY "Partners can view IPUs for deals in their org"
ON public.ipus FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = ipus.deal_id
      AND d.partner_organisation_id IS NOT NULL
      AND public.is_partner_in_org(auth.uid(), d.partner_organisation_id)
  )
);

-- 3. Restrict pricing_config reads to Veloxis staff only
DROP POLICY IF EXISTS "Authenticated users can view pricing config" ON public.pricing_config;
