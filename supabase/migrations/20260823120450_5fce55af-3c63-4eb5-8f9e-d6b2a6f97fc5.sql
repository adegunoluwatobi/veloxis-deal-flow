ALTER TABLE public.v2_audit_log DISABLE TRIGGER trg_v2_audit_no_delete;
ALTER TABLE public.v2_audit_log DISABLE TRIGGER trg_v2_audit_no_update;
ALTER TABLE public.onboarding_reviews DISABLE TRIGGER trg_onboarding_reviews_no_delete;
ALTER TABLE public.onboarding_reviews DISABLE TRIGGER trg_onboarding_reviews_no_update;

DELETE FROM public.v2_audit_log
 WHERE actor_user_id = 'b5fbaca5-8e06-4471-892a-154c2db71233'
    OR invoice_id IN (SELECT id FROM public.v2_invoices WHERE exporter_id = '9cae4f37-8747-4939-94a6-4ecc8fd55944');

DELETE FROM public.v2_invoices WHERE exporter_id = '9cae4f37-8747-4939-94a6-4ecc8fd55944';
DELETE FROM public.v2_buyers WHERE exporter_id = '9cae4f37-8747-4939-94a6-4ecc8fd55944' OR created_by = 'b5fbaca5-8e06-4471-892a-154c2db71233';
DELETE FROM public.v2_exporters WHERE id = '9cae4f37-8747-4939-94a6-4ecc8fd55944';
DELETE FROM public.notifications WHERE user_id = 'b5fbaca5-8e06-4471-892a-154c2db71233';
DELETE FROM public.app_user_roles WHERE user_id = 'b5fbaca5-8e06-4471-892a-154c2db71233';
DELETE FROM public.user_roles WHERE user_id = 'b5fbaca5-8e06-4471-892a-154c2db71233';
DELETE FROM public.registration_invites WHERE email ILIKE 'adegunoluwatobi%@gmail.com';
DELETE FROM public.profiles WHERE user_id = 'b5fbaca5-8e06-4471-892a-154c2db71233' OR email ILIKE 'adegunoluwatobi%@gmail.com';
DELETE FROM public.users WHERE id = 'b5fbaca5-8e06-4471-892a-154c2db71233' OR email ILIKE 'adegunoluwatobi%@gmail.com';
DELETE FROM auth.users WHERE email ILIKE 'adegunoluwatobi%@gmail.com';

ALTER TABLE public.v2_audit_log ENABLE TRIGGER trg_v2_audit_no_delete;
ALTER TABLE public.v2_audit_log ENABLE TRIGGER trg_v2_audit_no_update;
ALTER TABLE public.onboarding_reviews ENABLE TRIGGER trg_onboarding_reviews_no_delete;
ALTER TABLE public.onboarding_reviews ENABLE TRIGGER trg_onboarding_reviews_no_update;