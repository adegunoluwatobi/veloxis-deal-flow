CREATE OR REPLACE FUNCTION public.approve_template_counsel(p_template_id uuid, p_counsel_reference text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_code text;
BEGIN
  IF NOT public.has_app_role(auth.uid(), 'super_admin'::v2_app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin may record counsel approval';
  END IF;
  IF coalesce(btrim(p_counsel_reference), '') = '' THEN
    RAISE EXCEPTION 'A counsel reference is required to record counsel approval';
  END IF;

  UPDATE public.document_templates
     SET counsel_approved = true,
         counsel_approved_by = auth.uid(),
         counsel_approved_at = now(),
         counsel_reference = btrim(p_counsel_reference)
   WHERE id = p_template_id
   RETURNING code INTO v_code;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  INSERT INTO public.document_audit_log (entity_type, entity_id, action, actor_id, actor_role, metadata)
  VALUES ('document_template', p_template_id, 'template_counsel_approved', auth.uid(), 'super_admin',
          jsonb_build_object('code', v_code, 'counsel_reference', btrim(p_counsel_reference)));
END;
$function$;