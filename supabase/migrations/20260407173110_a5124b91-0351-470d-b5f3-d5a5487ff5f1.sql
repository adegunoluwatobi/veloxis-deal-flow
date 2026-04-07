
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_exporter_record RECORD;
  v_partner_org_id uuid;
BEGIN
  INSERT INTO public.users (id, email, full_name, organisation)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'organisation', '')
  );
  
  v_role := NEW.raw_user_meta_data->>'role';

  -- If role is exporter, link to the exporter profile and derive org
  IF v_role = 'exporter' THEN
    -- Find the exporter profile by contact_email
    SELECT id, originator_id INTO v_exporter_record
    FROM public.exporters
    WHERE lower(contact_email) = lower(NEW.email)
    LIMIT 1;

    IF v_exporter_record.id IS NOT NULL THEN
      -- Link auth user to exporter profile
      UPDATE public.exporters
      SET exporter_user_id = NEW.id,
          invite_accepted_at = now(),
          onboarding_status = 'password_set'
      WHERE id = v_exporter_record.id
        AND onboarding_status = 'invited';

      -- Derive partner_organisation_id from the originator's role
      SELECT ur.partner_organisation_id INTO v_partner_org_id
      FROM public.user_roles ur
      WHERE ur.user_id = v_exporter_record.originator_id
        AND ur.role IN ('partner_admin', 'partner_staff')
      LIMIT 1;
    END IF;

    INSERT INTO public.user_roles (user_id, role, partner_organisation_id)
    VALUES (NEW.id, 'exporter'::public.app_role, v_partner_org_id);
  ELSIF v_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role::public.app_role);
  END IF;
  
  RETURN NEW;
END;
$function$;
