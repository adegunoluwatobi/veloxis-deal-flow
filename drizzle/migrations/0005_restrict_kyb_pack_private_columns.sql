REVOKE ALL ON public.kyb_pack_links FROM anon,authenticated;
GRANT SELECT (id,exporter_id,pack_type,recipients,cc,subject,sent_by,sender_name,created_at,expires_at,sent_at,delivery_status,revoked_at,revoked_by) ON public.kyb_pack_links TO authenticated;
REVOKE ALL ON public.kyb_application_activity FROM anon,authenticated;
GRANT SELECT ON public.kyb_application_activity TO authenticated;
GRANT ALL ON public.kyb_pack_links, public.kyb_application_activity TO service_role;