INSERT INTO public.notification_templates (key, channel, subject, body, active)
VALUES
 ('exporter_onboarding_approved','in_app','Your onboarding has been approved','Credit & Compliance approved {{company_name}}. Your account is now active and you can submit your first application.',true),
 ('exporter_onboarding_approved','email','Welcome to Veloxis — your account is active','<p>Good news — Credit &amp; Compliance has approved <strong>{{company_name}}</strong>.</p><p>Your account is now fully active and you can log in to submit your first trade finance application.</p>',true),
 ('staff_exporter_onboarding_approved','in_app','Exporter approved','{{company_name}} has been approved by Credit & Compliance and is now active.',true),
 ('staff_exporter_onboarding_approved','email','Exporter approved: {{company_name}}','<p><strong>{{company_name}}</strong> has been approved by Credit &amp; Compliance and is now active on Veloxis.</p><p>Open the exporter record in the Veloxis portal to view the profile.</p>',true)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.v2_notify_exporter_onboarding_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_vars jsonb;
BEGIN
  IF NEW.onboarding_status <> 'active' OR OLD.onboarding_status = 'active' THEN
    RETURN NEW;
  END IF;

  v_vars := jsonb_build_object('company_name', COALESCE(NEW.company_name, 'the exporter'));

  IF NEW.owner_user_id IS NOT NULL THEN
    PERFORM public.v2_send_notification(
      'exporter_onboarding_approved', NEW.owner_user_id, v_vars,
      '/portal', 'success', NULL, NEW.id);
  END IF;

  PERFORM public.v2_notify_role('originator'::v2_app_role, 'staff_exporter_onboarding_approved',
    v_vars, '/app/exporters/' || NEW.id::text, 'success', NULL, NEW.id);

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.v2_notify_exporter_onboarding_approved() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_v2_notify_exporter_onboarding_approved ON public.v2_exporters;
CREATE TRIGGER trg_v2_notify_exporter_onboarding_approved
AFTER UPDATE OF onboarding_status ON public.v2_exporters
FOR EACH ROW EXECUTE FUNCTION public.v2_notify_exporter_onboarding_approved();