CREATE FUNCTION public.kyb_capture_notes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kyb_notes IS DISTINCT FROM OLD.kyb_notes OR NEW.kyc_notes IS DISTINCT FROM OLD.kyc_notes THEN
  PERFORM public.kyb_append_activity(NEW.id,NEW.invite_id,'notes_changed',auth.uid(),jsonb_build_object('kyb_notes',NEW.kyb_notes,'kyc_notes',NEW.kyc_notes));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kyb_exporter_notes_activity AFTER UPDATE ON public.v2_exporters FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_notes();
CREATE FUNCTION public.kyb_capture_profile_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE eid uuid;
BEGIN
 IF NEW.email IS DISTINCT FROM OLD.email THEN
  FOR eid IN SELECT id FROM public.v2_exporters WHERE owner_user_id=NEW.user_id LOOP
   PERFORM public.kyb_append_activity(eid,NULL,'admin_email_changed',auth.uid(),jsonb_build_object('from',OLD.email,'to',NEW.email,'source','account_profile'));
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kyb_profile_email_activity AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_profile_email();
CREATE FUNCTION public.kyb_capture_legacy_invite() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE eid uuid;
BEGIN
 FOR eid IN SELECT id FROM public.v2_exporters WHERE lower(email)=lower(NEW.email) LOOP
  IF TG_OP='INSERT' THEN
   PERFORM public.kyb_append_activity(eid,NULL,'invite_created',NEW.invited_by,jsonb_build_object('email',NEW.email,'note',NEW.notes,'invite_type','registration'));
  ELSE
   IF NEW.last_sent_at IS DISTINCT FROM OLD.last_sent_at THEN
    PERFORM public.kyb_append_activity(eid,NULL,'invite_resent',auth.uid(),jsonb_build_object('email',NEW.email,'invite_type','registration'));
   END IF;
   IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    PERFORM public.kyb_append_activity(eid,NULL,'notes_changed',auth.uid(),jsonb_build_object('note',NEW.notes));
   END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER kyb_registration_invite_activity AFTER INSERT OR UPDATE ON public.registration_invites FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_legacy_invite();
INSERT INTO public.kyb_application_activity(exporter_id,invite_id,event_type,actor_id,details,source_key,created_at)
SELECT e.id,e.invite_id,'application_submitted',e.owner_user_id,jsonb_build_object('submitted_at',e.onboarding_submitted_at,'historical',true),'initial-submission:'||e.id,e.onboarding_submitted_at FROM public.v2_exporters e WHERE e.onboarding_submitted_at IS NOT NULL;
INSERT INTO public.kyb_application_activity(exporter_id,event_type,actor_id,details,source_key,created_at)
SELECT e.id,'invite_created',r.invited_by,jsonb_build_object('email',r.email,'note',r.notes,'invite_type','registration'),'registration-created:'||r.id||':'||e.id,r.created_at FROM public.registration_invites r JOIN public.v2_exporters e ON lower(e.email)=lower(r.email);
INSERT INTO public.kyb_application_activity(exporter_id,event_type,actor_id,details,source_key,created_at)
SELECT e.id,'invite_sent',r.invited_by,jsonb_build_object('email',r.email,'invite_type','registration'),'registration-sent:'||r.id||':'||e.id,r.first_sent_at FROM public.registration_invites r JOIN public.v2_exporters e ON lower(e.email)=lower(r.email) WHERE r.first_sent_at IS NOT NULL;
