
ALTER TABLE public.audit_logs DISABLE TRIGGER no_delete_audit_logs;
ALTER TABLE public.audit_logs DISABLE TRIGGER no_update_audit_logs;

DELETE FROM public.audit_logs;

DELETE FROM public.internal_notes;
DELETE FROM public.ipus;
DELETE FROM public.deal_change_requests;
DELETE FROM public.deal_doc_requests;
DELETE FROM public.deal_documents;
DELETE FROM public.deals;

DELETE FROM public.kyc_profile_change_requests;
DELETE FROM public.ubo_declarations;
DELETE FROM public.document_requests;
DELETE FROM public.exporter_upload_tokens;
DELETE FROM public.exporter_documents;
DELETE FROM public.exporter_bank_accounts;
DELETE FROM public.exporter_applications;
DELETE FROM public.exporters;

DELETE FROM public.partner_document_requests;
DELETE FROM public.partner_documents;
DELETE FROM public.partner_applications;

-- Detach any remaining user_roles from partner orgs before dropping orgs
UPDATE public.user_roles SET partner_organisation_id = NULL WHERE partner_organisation_id IS NOT NULL;

DELETE FROM public.partner_organisations;

DELETE FROM public.nbcc_leads;
DELETE FROM public.notifications WHERE user_id <> '656b2c16-a731-4a36-8e8b-13472a9a626d';

DELETE FROM public.user_roles WHERE user_id <> '656b2c16-a731-4a36-8e8b-13472a9a626d';
DELETE FROM public.users WHERE id <> '656b2c16-a731-4a36-8e8b-13472a9a626d';
DELETE FROM auth.users WHERE id <> '656b2c16-a731-4a36-8e8b-13472a9a626d';

ALTER TABLE public.audit_logs ENABLE TRIGGER no_delete_audit_logs;
ALTER TABLE public.audit_logs ENABLE TRIGGER no_update_audit_logs;
