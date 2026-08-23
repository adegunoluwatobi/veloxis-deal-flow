CREATE OR REPLACE FUNCTION public.set_esignature_mode(p_mode text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pending int; v_before text;
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'super_admin'::v2_app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin may change the electronic signature mode';
  END IF;
  IF p_mode NOT IN ('test','production') THEN
    RAISE EXCEPTION 'Mode must be test or production';
  END IF;

  IF p_mode = 'production' THEN
    SELECT count(*) INTO v_pending FROM public.document_templates
      WHERE active AND NOT counsel_approved;
    IF v_pending > 0 THEN
      RAISE EXCEPTION 'Every template must be approved by counsel before production signing can be enabled';
    END IF;
  END IF;

  SELECT trim(both '"' from value::text) INTO v_before FROM public.v2_system_config WHERE key = 'esignature_mode';

  INSERT INTO public.v2_system_config (key, value, description)
  VALUES ('esignature_mode', to_jsonb(p_mode), 'Electronic signature mode: test or production')
  ON CONFLICT (key) DO UPDATE SET value = excluded.value;

  INSERT INTO public.document_audit_log (entity_type, entity_id, action, actor_id, actor_role, metadata)
  VALUES ('system_config', gen_random_uuid(), 'esignature_mode_changed', auth.uid(), 'super_admin',
          jsonb_build_object('before', jsonb_build_object('mode', v_before), 'after', jsonb_build_object('mode', p_mode)));
END;
$function$;