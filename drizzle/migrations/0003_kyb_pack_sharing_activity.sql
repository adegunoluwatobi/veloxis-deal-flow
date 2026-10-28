CREATE TABLE public.kyb_application_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exporter_id uuid, invite_id uuid,
 event_type text NOT NULL, actor_id uuid, actor_name text, details jsonb NOT NULL DEFAULT '{}'::jsonb,
 source_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kyb_application_activity TO authenticated;
GRANT ALL ON public.kyb_application_activity TO service_role;
ALTER TABLE public.kyb_application_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_read_application_activity ON public.kyb_application_activity FOR SELECT TO authenticated USING (
 public.is_v2_staff(auth.uid()) AND (
 (exporter_id IS NOT NULL AND public.v2_can_view_exporter(auth.uid(),exporter_id)) OR
 EXISTS (SELECT 1 FROM public.kyb_invites k WHERE k.id=invite_id AND (public.has_app_role(auth.uid(),'super_admin') OR k.created_by=auth.uid() OR (k.exporter_id IS NOT NULL AND public.v2_can_view_exporter(auth.uid(),k.exporter_id))))
 ));
CREATE INDEX kyb_activity_exporter_date ON public.kyb_application_activity(exporter_id,created_at DESC);
CREATE INDEX kyb_activity_invite_date ON public.kyb_application_activity(invite_id,created_at DESC);
CREATE FUNCTION public.kyb_activity_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Application activity is append-only: entries cannot be edited or deleted'; END $$;
CREATE TRIGGER kyb_activity_no_mutation BEFORE UPDATE OR DELETE ON public.kyb_application_activity FOR EACH ROW EXECUTE FUNCTION public.kyb_activity_immutable();
CREATE TABLE public.kyb_pack_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exporter_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE, storage_path text NOT NULL UNIQUE, signed_url text NOT NULL,
 pack_type text NOT NULL CHECK (pack_type IN ('full','summary')),
 recipients text[] NOT NULL, cc text[] NOT NULL DEFAULT '{}', subject text NOT NULL,
 sent_by uuid NOT NULL, sender_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'), sent_at timestamptz,
 delivery_status text NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','sent','failed')),
 provider_message_id text, revoked_at timestamptz, revoked_by uuid,
 CONSTRAINT kyb_pack_seven_days CHECK (expires_at=created_at+interval '7 days')
);
GRANT SELECT (id,exporter_id,pack_type,recipients,cc,subject,sent_by,sender_name,created_at,expires_at,sent_at,delivery_status,revoked_at,revoked_by) ON public.kyb_pack_links TO authenticated;
GRANT ALL ON public.kyb_pack_links TO service_role;
ALTER TABLE public.kyb_pack_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_read_pack_links ON public.kyb_pack_links FOR SELECT TO authenticated USING(public.is_v2_staff(auth.uid()) AND public.v2_can_view_exporter(auth.uid(),exporter_id));
CREATE FUNCTION public.kyb_append_activity(p_exporter uuid,p_invite uuid,p_event text,p_actor uuid,p_details jsonb,p_source text DEFAULT NULL,p_at timestamptz DEFAULT now()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.kyb_application_activity(exporter_id,invite_id,event_type,actor_id,actor_name,details,source_key,created_at)
 VALUES(p_exporter,p_invite,p_event,p_actor,(SELECT COALESCE(name,email) FROM public.profiles WHERE user_id=p_actor LIMIT 1),COALESCE(p_details,'{}'::jsonb),p_source,p_at) ON CONFLICT(source_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.kyb_append_activity(uuid,uuid,text,uuid,jsonb,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kyb_append_activity(uuid,uuid,text,uuid,jsonb,text,timestamptz) TO service_role;
CREATE FUNCTION public.kyb_capture_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE eid uuid; iid uuid; uid uuid; ev text; d jsonb; target uuid;
BEGIN
 IF TG_TABLE_NAME='v2_exporters' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.onboarding_submitted_at IS DISTINCT FROM OLD.onboarding_submitted_at AND NEW.onboarding_submitted_at IS NOT NULL THEN
    PERFORM public.kyb_append_activity(NEW.id,NEW.invite_id,CASE WHEN OLD.onboarding_submitted_at IS NULL THEN 'application_submitted' ELSE 'application_resubmitted' END,auth.uid(),jsonb_build_object('submitted_at',NEW.onboarding_submitted_at));
   END IF;
   IF NEW.onboarding_status IS DISTINCT FROM OLD.onboarding_status THEN
    PERFORM public.kyb_append_activity(NEW.id,NEW.invite_id,'status_changed',auth.uid(),jsonb_build_object('from',OLD.onboarding_status,'to',NEW.onboarding_status));
   END IF;
   IF NEW.email IS DISTINCT FROM OLD.email THEN
    PERFORM public.kyb_append_activity(NEW.id,NEW.invite_id,'admin_email_changed',auth.uid(),jsonb_build_object('from',OLD.email,'to',NEW.email));
   END IF;
  END IF;
 ELSIF TG_TABLE_NAME='kyb_invite_events' THEN
  SELECT COALESCE(k.exporter_id,e.id),k.id INTO eid,iid FROM public.kyb_invites k LEFT JOIN public.v2_exporters e ON e.invite_id=k.id WHERE k.id=NEW.invite_id LIMIT 1;
  ev:='invite_'||CASE NEW.action WHEN 'emailed' THEN 'sent' ELSE NEW.action END;
  PERFORM public.kyb_append_activity(eid,iid,ev,NEW.actor_id,NEW.details,'invite:'||NEW.id,NEW.created_at);
 ELSIF TG_TABLE_NAME='document_audit_log' THEN
  IF NEW.exporter_id IS NOT NULL THEN
   PERFORM public.kyb_append_activity(NEW.exporter_id,NULL,NEW.action,NEW.actor_id,COALESCE(NEW.metadata,'{}'::jsonb)||jsonb_build_object('note',NEW.reason,'entity_type',NEW.entity_type),'document:'||NEW.id,NEW.created_at);
  END IF;
 ELSIF TG_TABLE_NAME='onboarding_reviews' THEN
  PERFORM public.kyb_append_activity(NEW.exporter_id,NULL,'review_'||NEW.decision,NEW.reviewer_id,jsonb_build_object('stage',NEW.stage,'note',NEW.note,'override_reason',NEW.override_reason),'review:'||NEW.id,NEW.created_at);
 ELSIF TG_TABLE_NAME='kyb_pack_links' THEN
  IF NEW.delivery_status='sent' AND (TG_OP='INSERT' OR OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
   PERFORM public.kyb_append_activity(NEW.exporter_id,NULL,'pack_sent',NEW.sent_by,jsonb_build_object('link_id',NEW.id,'recipients',NEW.recipients,'cc',NEW.cc,'pack_type',NEW.pack_type,'subject',NEW.subject,'sent_by',NEW.sender_name,'expires_at',NEW.expires_at),'pack:'||NEW.id,NEW.sent_at);
  END IF;
  IF TG_OP='UPDATE' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.delivery_status='sent' THEN
   PERFORM public.kyb_append_activity(NEW.exporter_id,NULL,'pack_link_revoked',NEW.revoked_by,jsonb_build_object('link_id',NEW.id,'pack_type',NEW.pack_type,'revoked_at',NEW.revoked_at));
  END IF;
 ELSIF TG_TABLE_NAME='audit_logs' THEN
  d:=COALESCE(NEW.metadata,'{}'::jsonb);
  IF d ? 'target_user_id' AND (d ? 'new_email' OR d ? 'email' OR NEW.action_type::text='email_change_requested') THEN
   FOR eid IN SELECT id FROM public.v2_exporters WHERE owner_user_id::text=d->>'target_user_id' LOOP
    PERFORM public.kyb_append_activity(eid,NULL,'admin_email_changed',NEW.user_id,d,'admin-email:'||NEW.id||':'||eid,NEW.created_at);
   END LOOP;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kyb_exporter_activity AFTER UPDATE ON public.v2_exporters FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_activity();
CREATE TRIGGER kyb_invite_activity AFTER INSERT ON public.kyb_invite_events FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_activity();
CREATE TRIGGER kyb_document_activity AFTER INSERT ON public.document_audit_log FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_activity();
CREATE TRIGGER kyb_review_activity AFTER INSERT ON public.onboarding_reviews FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_activity();
CREATE TRIGGER kyb_pack_activity AFTER INSERT OR UPDATE ON public.kyb_pack_links FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_activity();
CREATE TRIGGER kyb_admin_email_activity AFTER INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_activity();
CREATE FUNCTION public.kyb_revoke_pack(p_link_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE link public.kyb_pack_links;
BEGIN
 SELECT * INTO link FROM public.kyb_pack_links WHERE id=p_link_id FOR UPDATE;
 IF NOT FOUND OR NOT public.is_v2_staff(auth.uid()) OR NOT public.v2_can_view_exporter(auth.uid(),link.exporter_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF link.revoked_at IS NULL THEN UPDATE public.kyb_pack_links SET revoked_at=now(),revoked_by=auth.uid() WHERE id=link.id; END IF;
 RETURN link.storage_path;
END $$;
REVOKE ALL ON FUNCTION public.kyb_revoke_pack(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kyb_revoke_pack(uuid) TO authenticated;
INSERT INTO public.kyb_application_activity(exporter_id,invite_id,event_type,actor_id,actor_name,details,source_key,created_at)
SELECT COALESCE(k.exporter_id,e.id),k.id,'invite_'||CASE x.action WHEN 'emailed' THEN 'sent' ELSE x.action END,x.actor_id,p.name,x.details,'invite:'||x.id,x.created_at FROM public.kyb_invite_events x JOIN public.kyb_invites k ON k.id=x.invite_id LEFT JOIN public.v2_exporters e ON e.invite_id=k.id LEFT JOIN public.profiles p ON p.user_id=x.actor_id
UNION ALL SELECT a.exporter_id,NULL,a.action,a.actor_id,p.name,COALESCE(a.metadata,'{}'::jsonb)||jsonb_build_object('note',a.reason,'entity_type',a.entity_type),'document:'||a.id,a.created_at FROM public.document_audit_log a LEFT JOIN public.profiles p ON p.user_id=a.actor_id WHERE a.exporter_id IS NOT NULL
UNION ALL SELECT r.exporter_id,NULL,'review_'||r.decision,r.reviewer_id,p.name,jsonb_build_object('stage',r.stage,'note',r.note,'override_reason',r.override_reason),'review:'||r.id,r.created_at FROM public.onboarding_reviews r LEFT JOIN public.profiles p ON p.user_id=r.reviewer_id;
