ALTER TABLE public.kyb_pack_links DROP CONSTRAINT kyb_pack_links_pack_type_check;
ALTER TABLE public.kyb_pack_links ADD CONSTRAINT kyb_pack_links_pack_type_check CHECK (pack_type IN ('full','summary','bundle'));
ALTER TABLE public.kyb_pack_links DROP CONSTRAINT kyb_pack_links_delivery_status_check;
ALTER TABLE public.kyb_pack_links ADD CONSTRAINT kyb_pack_links_delivery_status_check CHECK (delivery_status IN ('pending','sent','failed','ready'));
CREATE FUNCTION public.kyb_capture_zip_link_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.delivery_status = 'ready' AND (TG_OP = 'INSERT' OR OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
  PERFORM public.kyb_append_activity(NEW.exporter_id,NULL,'pack_link_created',NEW.sent_by,jsonb_build_object('link_id',NEW.id,'pack_type',NEW.pack_type,'expires_at',NEW.expires_at),'pack-link:'||NEW.id,NEW.created_at);
 END IF;
 IF TG_OP = 'UPDATE' AND NEW.delivery_status = 'ready' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
  PERFORM public.kyb_append_activity(NEW.exporter_id,NULL,'pack_link_revoked',NEW.revoked_by,jsonb_build_object('link_id',NEW.id,'pack_type',NEW.pack_type,'revoked_at',NEW.revoked_at));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kyb_capture_zip_link_activity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER kyb_zip_link_activity AFTER INSERT OR UPDATE ON public.kyb_pack_links FOR EACH ROW EXECUTE FUNCTION public.kyb_capture_zip_link_activity();