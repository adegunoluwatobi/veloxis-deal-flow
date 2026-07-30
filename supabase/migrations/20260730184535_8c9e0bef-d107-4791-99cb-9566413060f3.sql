-- 1. GRANTS (missing entirely — Data API could not reach any of these tables)
GRANT SELECT ON public.document_types, public.commodities, public.regulated_commodities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_types, public.commodities, public.regulated_commodities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoice_documents, public.invoice_document_requests, public.company_documents, public.board_resolutions, public.authorised_signatories TO authenticated;
GRANT SELECT, INSERT ON public.document_audit_log TO authenticated;
GRANT ALL ON public.document_types, public.commodities, public.regulated_commodities,
  public.invoice_documents, public.invoice_document_requests, public.company_documents,
  public.board_resolutions, public.authorised_signatories, public.document_audit_log TO service_role;

-- Hard-block deletes at the privilege level too (no DELETE policy exists either)
REVOKE DELETE ON public.invoice_documents, public.company_documents, public.document_audit_log FROM authenticated, anon;
REVOKE UPDATE ON public.document_audit_log FROM authenticated, anon;

-- 2. board_resolutions must match the canonical shape exactly
ALTER TABLE public.board_resolutions DROP COLUMN IF EXISTS resolution_type;
ALTER TABLE public.board_resolutions DROP COLUMN IF EXISTS linked_invoice_id;

ALTER TABLE public.board_resolutions
  ALTER COLUMN authorised_limit SET NOT NULL,
  ALTER COLUMN valid_from SET NOT NULL,
  ALTER COLUMN valid_until SET NOT NULL;

ALTER TABLE public.board_resolutions
  ADD COLUMN IF NOT EXISTS superseded_by uuid NULL REFERENCES public.board_resolutions(id) ON DELETE SET NULL;

ALTER TABLE public.board_resolutions
  ADD CONSTRAINT board_resolutions_limit_positive CHECK (authorised_limit > 0);

ALTER TABLE public.board_resolutions
  ADD CONSTRAINT board_resolutions_validity_range CHECK (valid_until > valid_from);

-- one live (non-superseded) resolution per exporter
CREATE UNIQUE INDEX IF NOT EXISTS uq_board_resolutions_active_per_exporter
  ON public.board_resolutions (exporter_id)
  WHERE superseded_by IS NULL;

-- 3. invoices: unique invoice number per exporter/buyer pair
ALTER TABLE public.v2_invoices
  ADD CONSTRAINT v2_invoices_exporter_buyer_number_key UNIQUE (exporter_id, buyer_id, invoice_number);

-- 4. company_documents validity window
ALTER TABLE public.company_documents
  ADD CONSTRAINT company_documents_validity_range
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from);

-- 5. document_audit_log: append-only + no forged actors
DROP POLICY IF EXISTS doc_audit_insert ON public.document_audit_log;
CREATE POLICY doc_audit_insert ON public.document_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_document_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'document_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_doc_audit_no_mutation ON public.document_audit_log;
CREATE TRIGGER trg_doc_audit_no_mutation
  BEFORE UPDATE OR DELETE ON public.document_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_document_audit_mutation();