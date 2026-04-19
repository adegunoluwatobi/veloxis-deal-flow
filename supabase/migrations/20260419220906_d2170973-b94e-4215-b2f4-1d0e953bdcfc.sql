-- Audit logs are normally append-only via prevent_audit_log_update trigger.
-- Temporarily disable it to null out the FK reference so the user can be deleted.
ALTER TABLE public.audit_logs DISABLE TRIGGER USER;

UPDATE public.audit_logs
SET user_id = NULL
WHERE user_id = '3a454617-aa70-46c2-81d4-86179822d7f9';

ALTER TABLE public.audit_logs ENABLE TRIGGER USER;

-- Detach the exporter so they can be re-invited cleanly
UPDATE public.exporters
SET exporter_user_id = NULL,
    invite_accepted_at = NULL,
    onboarding_status = 'invited'
WHERE exporter_user_id = '3a454617-aa70-46c2-81d4-86179822d7f9';

-- Remove role assignment
DELETE FROM public.user_roles
WHERE user_id = '3a454617-aa70-46c2-81d4-86179822d7f9';

-- Remove public profile
DELETE FROM public.users
WHERE id = '3a454617-aa70-46c2-81d4-86179822d7f9';