
CREATE TABLE public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  stage int CHECK (stage IN (1,2)),
  requirement text NOT NULL DEFAULT 'optional' CHECK (requirement IN ('mandatory','conditional','optional')),
  level text NOT NULL DEFAULT 'invoice' CHECK (level IN ('invoice','company')),
  sort_order int NOT NULL DEFAULT 0,
  accepts text[] NOT NULL DEFAULT ARRAY['application/pdf','image/jpeg','image/png'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.document_types TO authenticated;
GRANT ALL ON public.document_types TO service_role;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_types_read" ON public.document_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_types_admin_write" ON public.document_types FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(),'super_admin')) WITH CHECK (public.has_app_role(auth.uid(),'super_admin'));

CREATE TABLE public.commodities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('agricultural','solid_minerals','metals','manufactured','textiles','timber','seafood','other')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commodities TO authenticated;
GRANT ALL ON public.commodities TO service_role;
ALTER TABLE public.commodities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commodities_read" ON public.commodities FOR SELECT TO authenticated USING (true);
CREATE POLICY "commodities_admin_write" ON public.commodities FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(),'super_admin')) WITH CHECK (public.has_app_role(auth.uid(),'super_admin'));

CREATE TABLE public.regulated_commodities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  requires_inspection boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.regulated_commodities TO authenticated;
GRANT ALL ON public.regulated_commodities TO service_role;
ALTER TABLE public.regulated_commodities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reg_comm_read" ON public.regulated_commodities FOR SELECT TO authenticated USING (true);
CREATE POLICY "reg_comm_super_admin_write" ON public.regulated_commodities FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(),'super_admin')) WITH CHECK (public.has_app_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.v2_can_review_documents(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.app_user_roles WHERE user_id=_user_id AND role IN ('credit_officer','originator','super_admin')) $$;

CREATE TABLE public.invoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.v2_invoices(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id),
  storage_path text NOT NULL,
  original_filename text,
  file_size_bytes int,
  version int NOT NULL DEFAULT 1,
  superseded_by uuid REFERENCES public.invoice_documents(id) ON DELETE SET NULL,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_documents_invoice ON public.invoice_documents(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_documents TO authenticated;
GRANT ALL ON public.invoice_documents TO service_role;
ALTER TABLE public.invoice_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_docs_select" ON public.invoice_documents FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_owns_invoice(auth.uid(), invoice_id));
CREATE POLICY "inv_docs_insert" ON public.invoice_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_v2_staff(auth.uid()) OR public.v2_owns_invoice(auth.uid(), invoice_id));
CREATE POLICY "inv_docs_update_staff" ON public.invoice_documents FOR UPDATE TO authenticated
  USING (public.v2_can_review_documents(auth.uid())) WITH CHECK (public.v2_can_review_documents(auth.uid()));
CREATE POLICY "inv_docs_update_owner" ON public.invoice_documents FOR UPDATE TO authenticated
  USING (public.v2_owns_invoice(auth.uid(), invoice_id) AND status = 'pending')
  WITH CHECK (public.v2_owns_invoice(auth.uid(), invoice_id) AND status = 'pending');

CREATE TABLE public.invoice_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.v2_invoices(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id),
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding','fulfilled','withdrawn')),
  fulfilled_by_document_id uuid REFERENCES public.invoice_documents(id) ON DELETE SET NULL,
  withdrawn_by uuid,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_document_requests_invoice ON public.invoice_document_requests(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_document_requests TO authenticated;
GRANT ALL ON public.invoice_document_requests TO service_role;
ALTER TABLE public.invoice_document_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_doc_req_select" ON public.invoice_document_requests FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_owns_invoice(auth.uid(), invoice_id));
CREATE POLICY "inv_doc_req_insert_staff" ON public.invoice_document_requests FOR INSERT TO authenticated
  WITH CHECK (public.v2_can_review_documents(auth.uid()));
CREATE POLICY "inv_doc_req_update_staff" ON public.invoice_document_requests FOR UPDATE TO authenticated
  USING (public.v2_can_review_documents(auth.uid())) WITH CHECK (public.v2_can_review_documents(auth.uid()));

CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id uuid NOT NULL REFERENCES public.v2_exporters(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id),
  storage_path text NOT NULL,
  original_filename text,
  file_size_bytes int,
  valid_from date,
  valid_until date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','expired')),
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_documents_exporter ON public.company_documents(exporter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "co_docs_select" ON public.company_documents FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_owns_exporter(auth.uid(), exporter_id));
CREATE POLICY "co_docs_insert" ON public.company_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_v2_staff(auth.uid()) OR public.v2_owns_exporter(auth.uid(), exporter_id));
CREATE POLICY "co_docs_update_staff" ON public.company_documents FOR UPDATE TO authenticated
  USING (public.v2_can_review_documents(auth.uid())) WITH CHECK (public.v2_can_review_documents(auth.uid()));
CREATE POLICY "co_docs_update_owner" ON public.company_documents FOR UPDATE TO authenticated
  USING (public.v2_owns_exporter(auth.uid(), exporter_id) AND status IN ('pending','rejected'))
  WITH CHECK (public.v2_owns_exporter(auth.uid(), exporter_id) AND status IN ('pending','rejected'));

CREATE TABLE public.board_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_document_id uuid REFERENCES public.company_documents(id) ON DELETE SET NULL,
  exporter_id uuid NOT NULL REFERENCES public.v2_exporters(id) ON DELETE CASCADE,
  resolution_type text NOT NULL CHECK (resolution_type IN ('omnibus','transaction_specific')),
  authorised_limit numeric,
  limit_currency text NOT NULL DEFAULT 'GBP',
  valid_from date,
  valid_until date,
  linked_invoice_id uuid REFERENCES public.v2_invoices(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_resolutions_exporter ON public.board_resolutions(exporter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_resolutions TO authenticated;
GRANT ALL ON public.board_resolutions TO service_role;
ALTER TABLE public.board_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "board_res_select" ON public.board_resolutions FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_owns_exporter(auth.uid(), exporter_id));
CREATE POLICY "board_res_insert" ON public.board_resolutions FOR INSERT TO authenticated
  WITH CHECK (public.is_v2_staff(auth.uid()) OR public.v2_owns_exporter(auth.uid(), exporter_id));
CREATE POLICY "board_res_update_staff" ON public.board_resolutions FOR UPDATE TO authenticated
  USING (public.v2_can_review_documents(auth.uid())) WITH CHECK (public.v2_can_review_documents(auth.uid()));

CREATE TABLE public.authorised_signatories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_resolution_id uuid NOT NULL REFERENCES public.board_resolutions(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  position text,
  email text,
  id_document_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_sig_resolution ON public.authorised_signatories(board_resolution_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorised_signatories TO authenticated;
GRANT ALL ON public.authorised_signatories TO service_role;
ALTER TABLE public.authorised_signatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_sig_select" ON public.authorised_signatories FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.board_resolutions br WHERE br.id = board_resolution_id
    AND (public.is_v2_staff(auth.uid()) OR public.v2_owns_exporter(auth.uid(), br.exporter_id))));
CREATE POLICY "auth_sig_insert" ON public.authorised_signatories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.board_resolutions br WHERE br.id = board_resolution_id
    AND (public.is_v2_staff(auth.uid()) OR public.v2_owns_exporter(auth.uid(), br.exporter_id))));
CREATE POLICY "auth_sig_update_staff" ON public.authorised_signatories FOR UPDATE TO authenticated
  USING (public.v2_can_review_documents(auth.uid())) WITH CHECK (public.v2_can_review_documents(auth.uid()));

CREATE TABLE public.document_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('invoice_document','company_document','document_request','board_resolution')),
  entity_id uuid NOT NULL,
  invoice_id uuid,
  exporter_id uuid,
  action text NOT NULL CHECK (action IN ('uploaded','replaced','verified','rejected','requested','fulfilled','withdrawn','expired','override_applied')),
  actor_id uuid,
  actor_role text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_audit_entity ON public.document_audit_log(entity_type, entity_id);
GRANT SELECT, INSERT ON public.document_audit_log TO authenticated;
GRANT ALL ON public.document_audit_log TO service_role;
ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_audit_insert" ON public.document_audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "doc_audit_select_staff" ON public.document_audit_log FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()));
CREATE TRIGGER doc_audit_no_update BEFORE UPDATE ON public.document_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_update();
CREATE TRIGGER doc_audit_no_delete BEFORE DELETE ON public.document_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_delete();

ALTER TABLE public.v2_invoices
  ADD COLUMN commodity_id uuid REFERENCES public.commodities(id),
  ADD COLUMN incoterm text,
  ADD COLUMN bl_number text,
  ADD COLUMN bl_date date,
  ADD COLUMN port_of_loading text,
  ADD COLUMN port_of_discharge text,
  ADD COLUMN estimated_arrival_date date,
  ADD COLUMN gross_invoice_value numeric,
  ADD COLUMN agreed_deductions numeric NOT NULL DEFAULT 0,
  ADD COLUMN inspection_required boolean NOT NULL DEFAULT false,
  ADD COLUMN inspection_override_by uuid,
  ADD COLUMN inspection_override_reason text,
  ADD COLUMN board_resolution_id uuid REFERENCES public.board_resolutions(id),
  ADD COLUMN signatory_id uuid REFERENCES public.authorised_signatories(id),
  ADD COLUMN warranties_accepted_at timestamptz,
  ADD COLUMN warranties_accepted_by uuid,
  ADD COLUMN reference text UNIQUE,
  ADD COLUMN sla_clock_started_at timestamptz,
  ADD COLUMN sla_paused_at timestamptz,
  ADD COLUMN sla_elapsed_seconds int NOT NULL DEFAULT 0,
  ADD COLUMN decision_due_at timestamptz;

CREATE SEQUENCE IF NOT EXISTS public.v2_invoice_reference_seq START 1;

CREATE OR REPLACE FUNCTION public.v2_set_invoice_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'VX-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.v2_invoice_reference_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER v2_invoices_set_reference BEFORE INSERT ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.v2_set_invoice_reference();

CREATE TRIGGER trg_document_types_updated BEFORE UPDATE ON public.document_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_commodities_updated BEFORE UPDATE ON public.commodities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_regulated_commodities_updated BEFORE UPDATE ON public.regulated_commodities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invoice_documents_updated BEFORE UPDATE ON public.invoice_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invoice_document_requests_updated BEFORE UPDATE ON public.invoice_document_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_company_documents_updated BEFORE UPDATE ON public.company_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_board_resolutions_updated BEFORE UPDATE ON public.board_resolutions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_authorised_signatories_updated BEFORE UPDATE ON public.authorised_signatories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "veloxis_docs_exporter_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'veloxis-documents' AND (
  public.is_v2_staff(auth.uid())
  OR public.v2_owns_exporter(auth.uid(), NULLIF((storage.foldername(name))[1],'')::uuid)
));
CREATE POLICY "veloxis_docs_exporter_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'veloxis-documents' AND (
  public.is_v2_staff(auth.uid())
  OR public.v2_owns_exporter(auth.uid(), NULLIF((storage.foldername(name))[1],'')::uuid)
));
CREATE POLICY "veloxis_docs_exporter_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'veloxis-documents' AND (
  public.is_v2_staff(auth.uid())
  OR public.v2_owns_exporter(auth.uid(), NULLIF((storage.foldername(name))[1],'')::uuid)
));

INSERT INTO public.document_types (code, label, description, stage, requirement, level, sort_order) VALUES
('commercial_invoice','Commercial invoice','The signed commercial invoice issued to the buyer for this shipment.',1,'mandatory','invoice',10),
('purchase_order','Purchase order or sales contract','The buyer purchase order or underlying sales contract supporting the invoice.',1,'mandatory','invoice',20),
('bill_of_lading','Bill of lading / air waybill','Transport document evidencing the goods have shipped.',1,'mandatory','invoice',30),
('packing_list','Packing list','Itemised packing list for the shipment.',1,'mandatory','invoice',40),
('certificate_of_origin','Certificate of origin','Document certifying the country of origin of the goods.',1,'conditional','invoice',50),
('nxp_form','NXP form','Nigerian export proceeds form for the shipment.',1,'conditional','invoice',60),
('inspection_certificate','Inspection / quality certificate','Independent inspection or quality certificate for regulated commodities.',2,'conditional','invoice',70),
('phytosanitary_certificate','Phytosanitary certificate','Plant health certificate required for agricultural exports.',2,'conditional','invoice',80),
('insurance_certificate','Cargo insurance certificate','Evidence of marine or cargo insurance covering the shipment.',2,'conditional','invoice',90),
('notice_of_assignment','Notice of assignment','Notice to the buyer assigning the receivable to Veloxis.',2,'mandatory','invoice',100),
('buyer_acknowledgement','Buyer acknowledgement','Buyer countersignature acknowledging the assignment.',2,'mandatory','invoice',110),
('deed_of_assignment','Deed of assignment','Executed deed transferring the receivable.',2,'mandatory','invoice',120),
('cac_certificate','Certificate of incorporation (CAC)','Company registration certificate issued by the CAC.',1,'mandatory','company',10),
('cac_status_report','CAC status report','Current CAC status report listing directors and shareholders.',1,'mandatory','company',20),
('memart','MEMART','Memorandum and articles of association.',1,'mandatory','company',30),
('tax_clearance','Tax clearance certificate','Most recent tax clearance certificate.',1,'conditional','company',40),
('nepc_certificate','NEPC exporter certificate','Nigerian Export Promotion Council registration certificate.',1,'mandatory','company',50),
('board_resolution','Board resolution','Board resolution authorising the export finance facility.',1,'mandatory','company',60),
('director_id','Director government ID','Government issued photo ID for each director.',1,'mandatory','company',70),
('proof_of_address','Director proof of address','Recent utility bill or bank statement evidencing address.',1,'mandatory','company',80),
('bank_statement','Bank statement','Company bank statements for the last 6 months.',1,'mandatory','company',90),
('audited_accounts','Audited financial statements','Most recent audited or management accounts.',2,'conditional','company',100);
