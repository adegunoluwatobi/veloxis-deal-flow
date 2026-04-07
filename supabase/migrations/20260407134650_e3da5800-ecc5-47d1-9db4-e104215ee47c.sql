ALTER TABLE public.audit_logs DISABLE TRIGGER no_update_audit_logs;

UPDATE public.audit_logs SET exporter_id = NULL WHERE exporter_id = '4100f2f3-f79a-490a-80af-58cdccd51897';

ALTER TABLE public.audit_logs ENABLE TRIGGER no_update_audit_logs;

DELETE FROM public.exporters WHERE id = '4100f2f3-f79a-490a-80af-58cdccd51897';