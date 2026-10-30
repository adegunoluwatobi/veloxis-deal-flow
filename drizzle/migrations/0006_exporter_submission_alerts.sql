CREATE OR REPLACE FUNCTION public.v2_onboarding_submission_changed(p_old timestamptz,p_new timestamptz) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT p_new IS NOT NULL AND p_old IS DISTINCT FROM p_new $$;
REVOKE ALL ON FUNCTION public.v2_onboarding_submission_changed(timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_onboarding_submission_changed(timestamptz,timestamptz) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.v2_notify_onboarding_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.v2_onboarding_submission_changed(OLD.onboarding_submitted_at,NEW.onboarding_submitted_at) THEN RETURN NEW; END IF;
 INSERT INTO public.notifications(user_id,title,message,type,link)
 SELECT DISTINCT r.user_id,CASE WHEN OLD.onboarding_submitted_at IS NULL THEN 'Exporter application submitted' ELSE 'Exporter application resubmitted' END,
 COALESCE(NEW.company_name,'An exporter') || ' has ' || CASE WHEN OLD.onboarding_submitted_at IS NULL THEN 'submitted' ELSE 'resubmitted' END || ' their onboarding application. It is ready for review.',
 'onboarding_review','/app/exporters/' || NEW.id::text
 FROM public.app_user_roles r WHERE r.user_id IS DISTINCT FROM NEW.owner_user_id AND
 (r.role::text IN ('credit_officer','super_admin') OR (r.role::text='originator' AND public.v2_can_view_exporter(r.user_id,NEW.id)));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.v2_notify_onboarding_submission() FROM PUBLIC;
CREATE TRIGGER trg_v2_notify_onboarding_submission AFTER UPDATE OF onboarding_submitted_at ON public.v2_exporters FOR EACH ROW EXECUTE FUNCTION public.v2_notify_onboarding_submission();
CREATE OR REPLACE FUNCTION public.v2_email_onboarding_review_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_email text; v_headers jsonb; v_delivery uuid;
BEGIN
 IF NEW.type <> 'onboarding_review' THEN RETURN NEW; END IF;
 SELECT email INTO v_email FROM public.profiles WHERE user_id=NEW.user_id;
 INSERT INTO public.notification_deliveries(template_key,channel,recipient,recipient_user_id,entity_type,entity_id,status,attempts,sent_at)
 VALUES('exporter-submission-review','in_app',NEW.user_id::text,NEW.user_id,'exporter',split_part(NEW.link,'/',4)::uuid,'sent',1,now());
 INSERT INTO public.notification_deliveries(template_key,channel,recipient,recipient_user_id,entity_type,entity_id,status,attempts)
 VALUES('exporter-submission-review','email',COALESCE(v_email,''),NEW.user_id,'exporter',split_part(NEW.link,'/',4)::uuid,'queued',1) RETURNING id INTO v_delivery;
 BEGIN
 v_headers := COALESCE(NULLIF(current_setting('request.headers',true),''),'{}')::jsonb;
 IF COALESCE(v_email,'')='' OR v_headers->>'authorization' IS NULL THEN RAISE EXCEPTION 'Submission email requires a signed-in exporter and recipient email'; END IF;
 PERFORM net.http_post(url:='https://mesvzeqhqdokyysyfknn.supabase.co/functions/v1/send-transactional-email',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization',v_headers->>'authorization'),
 body:=jsonb_build_object('templateName','exporter-submission-review','recipientEmail',v_email,'templateData',jsonb_build_object('notificationId',NEW.id)));
 EXCEPTION WHEN OTHERS THEN UPDATE public.notification_deliveries SET status='failed',provider_response=SQLERRM WHERE id=v_delivery;
 END;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.v2_email_onboarding_review_notification() FROM PUBLIC;
CREATE TRIGGER trg_v2_email_onboarding_review AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.v2_email_onboarding_review_notification();