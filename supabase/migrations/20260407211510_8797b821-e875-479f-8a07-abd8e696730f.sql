-- Disable only user triggers on audit_logs
ALTER TABLE public.audit_logs DISABLE TRIGGER USER;

-- Clear dependent tables
DELETE FROM public.deal_change_requests;
DELETE FROM public.deal_documents;
DELETE FROM public.internal_notes;
DELETE FROM public.ipus;
DELETE FROM public.audit_logs WHERE deal_id IS NOT NULL;

-- Delete all deals
DELETE FROM public.deals;

-- Re-enable user triggers
ALTER TABLE public.audit_logs ENABLE TRIGGER USER;