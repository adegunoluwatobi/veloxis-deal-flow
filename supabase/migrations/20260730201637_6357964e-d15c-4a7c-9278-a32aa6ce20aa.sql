CREATE OR REPLACE FUNCTION public.v2_document_rejected_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner uuid; v_exporter uuid; v_ref text; v_label text; v_link text;
BEGIN
  IF NEW.status <> 'rejected' OR OLD.status IS NOT DISTINCT FROM 'rejected' THEN RETURN NEW; END IF;
  SELECT dt.label INTO v_label FROM public.document_types dt WHERE dt.id = NEW.document_type_id;

  IF TG_TABLE_NAME = 'invoice_documents' THEN
    SELECT i.exporter_id, COALESCE(i.reference, i.invoice_number) INTO v_exporter, v_ref
    FROM public.v2_invoices i WHERE i.id = NEW.invoice_id;
    v_link := '/portal/invoices/' || NEW.invoice_id::text;
  ELSE
    v_exporter := NEW.exporter_id;
    v_ref := 'your company profile';
    v_link := '/portal/profile';
  END IF;

  SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = v_exporter;
  PERFORM public.v2_send_notification('document_rejected', v_owner,
    jsonb_build_object('document_label', COALESCE(v_label,'A document'), 'reference', v_ref,
                       'reason', COALESCE(NEW.rejection_reason,'No reason recorded'), 'link', v_link),
    v_link, 'action_required',
    CASE WHEN TG_TABLE_NAME = 'invoice_documents' THEN NEW.invoice_id ELSE NULL END, v_exporter);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_inv_doc_rejected_notify ON public.invoice_documents;
CREATE TRIGGER trg_inv_doc_rejected_notify AFTER UPDATE ON public.invoice_documents
  FOR EACH ROW EXECUTE FUNCTION public.v2_document_rejected_notify();

DROP TRIGGER IF EXISTS trg_co_doc_rejected_notify ON public.company_documents;
CREATE TRIGGER trg_co_doc_rejected_notify AFTER UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.v2_document_rejected_notify();