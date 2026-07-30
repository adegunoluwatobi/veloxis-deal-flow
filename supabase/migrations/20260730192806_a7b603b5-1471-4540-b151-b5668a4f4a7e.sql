
ALTER TABLE public.document_audit_log DROP CONSTRAINT document_audit_log_action_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_action_check CHECK (action = ANY (ARRAY['uploaded','replaced','verified','rejected','requested','fulfilled','withdrawn','expired','override_applied','viewed','created','updated','superseded','reference_data_changed']));
ALTER TABLE public.document_audit_log DROP CONSTRAINT document_audit_log_entity_type_check;
ALTER TABLE public.document_audit_log ADD CONSTRAINT document_audit_log_entity_type_check CHECK (entity_type = ANY (ARRAY['invoice_document','company_document','document_request','board_resolution','document_type','commodity','regulated_commodity','system_config']));

CREATE OR REPLACE FUNCTION public.reference_data_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_entity text;
  v_id uuid;
BEGIN
  v_entity := CASE TG_TABLE_NAME
    WHEN 'document_types' THEN 'document_type'
    WHEN 'commodities' THEN 'commodity'
    WHEN 'regulated_commodities' THEN 'regulated_commodity'
    ELSE 'system_config' END;
  IF TG_TABLE_NAME = 'v2_system_config' THEN
    v_id := gen_random_uuid();
  ELSE
    v_id := NEW.id;
  END IF;
  INSERT INTO public.document_audit_log (entity_type, entity_id, action, actor_id, metadata)
  VALUES (v_entity, v_id, 'reference_data_changed', auth.uid(),
    jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME,
      'before', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'after', to_jsonb(NEW)));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ref_audit_document_types ON public.document_types;
CREATE TRIGGER trg_ref_audit_document_types AFTER INSERT OR UPDATE ON public.document_types
FOR EACH ROW EXECUTE FUNCTION public.reference_data_audit();
DROP TRIGGER IF EXISTS trg_ref_audit_commodities ON public.commodities;
CREATE TRIGGER trg_ref_audit_commodities AFTER INSERT OR UPDATE ON public.commodities
FOR EACH ROW EXECUTE FUNCTION public.reference_data_audit();
DROP TRIGGER IF EXISTS trg_ref_audit_regulated ON public.regulated_commodities;
CREATE TRIGGER trg_ref_audit_regulated AFTER INSERT OR UPDATE ON public.regulated_commodities
FOR EACH ROW EXECUTE FUNCTION public.reference_data_audit();
DROP TRIGGER IF EXISTS trg_ref_audit_sysconfig ON public.v2_system_config;
CREATE TRIGGER trg_ref_audit_sysconfig AFTER INSERT OR UPDATE ON public.v2_system_config
FOR EACH ROW EXECUTE FUNCTION public.reference_data_audit();

CREATE OR REPLACE FUNCTION public.guard_document_type_deactivation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_refs text;
BEGIN
  IF OLD.active = true AND NEW.active = false THEN
    SELECT string_agg(DISTINCT COALESCE(i.reference, i.id::text), ', ')
      INTO v_refs
    FROM public.invoice_document_requests r
    JOIN public.v2_invoices i ON i.id = r.invoice_id
    WHERE r.document_type_id = OLD.id AND r.status = 'outstanding';
    IF v_refs IS NOT NULL THEN
      RAISE EXCEPTION 'This document type cannot be deactivated while it is still requested on %.', v_refs
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_doc_type_deactivation ON public.document_types;
CREATE TRIGGER trg_guard_doc_type_deactivation BEFORE UPDATE ON public.document_types
FOR EACH ROW EXECUTE FUNCTION public.guard_document_type_deactivation();

INSERT INTO public.document_types (code, label, description, stage, requirement, level, sort_order, active) VALUES
('commercial_invoice','Commercial invoice','Your demand for payment on the buyer. Must show invoice number, date, currency, gross value, payment terms and Incoterm.',1,'mandatory','invoice',10,true),
('purchase_order','Purchase order or sales contract','Evidence the buyer agreed to the price and quantity.',1,'mandatory','invoice',20,true),
('bill_of_lading','Bill of lading or air waybill','The carrier receipt for the goods. We use the number and date to verify the shipment.',1,'mandatory','invoice',30,true),
('packing_list','Packing list','Quantity, weight and packing detail, checked against the invoice and bill of lading.',1,'mandatory','invoice',40,true),
('nxp_form','NXP form','Nigeria Export Proceeds form stamped by your bank. Required for your export proceeds to be repatriated.',1,'mandatory','invoice',50,true),
('customs_sgd','Customs SGD','Nigeria Customs Service export declaration showing the goods cleared for export.',1,'mandatory','invoice',60,true),
('inspection_certificate','Clean certificate of inspection','Pre shipment inspection agent confirmation of quantity, quality and price. Required for regulated commodities.',1,'conditional','invoice',70,true),
('board_resolution','Board resolution authorising the facility','A resolution of your board authorising this company to enter into receivables purchase transactions with Veloxis, naming the people permitted to sign and the maximum amount authorised.',1,'mandatory','company',80,true),
('certificate_of_origin','Certificate of origin','Issued by NACCIMA or your chamber of commerce. Determines tariff treatment when the goods arrive.',2,'mandatory','invoice',90,true),
('notice_of_assignment','Signed notice of assignment','Notifies your buyer that this receivable now belongs to Veloxis.',2,'mandatory','invoice',100,true),
('domiciliation_instruction','Domiciliation instruction','Your written instruction routing the buyer payment to the designated domiciliary account.',2,'mandatory','invoice',110,true),
('deed_of_assignment','Deed of assignment','Transfers legal title in this receivable to Veloxis under your master agreement.',2,'mandatory','invoice',120,true),
('insurance_certificate','Marine cargo insurance certificate','Covers loss or damage in transit. Mandatory on CIF terms.',NULL,'optional','invoice',200,true),
('prior_invoices','Prior paid invoices from this buyer','Evidence of how this buyer has paid you before.',NULL,'optional','invoice',210,true),
('remittance_advice','Remittance advice','Proof that funds from earlier shipments reached your domiciliary account.',NULL,'optional','invoice',220,true),
('booking_confirmation','Booking confirmation','Your carrier booking or shipping instruction.',NULL,'optional','invoice',230,true),
('container_photos','Container and seal photographs','Photographs of the loaded container and the seal.',NULL,'optional','invoice',240,true),
('phytosanitary','Phytosanitary certificate','NAQS certification that the consignment is free of pests. Required for plant products entering the UK and EU.',NULL,'optional','invoice',250,true),
('fumigation','Fumigation certificate','Proof of treatment against infestation.',NULL,'optional','invoice',260,true),
('health_certificate','Health certificate','Confirms the product meets UK and EU food safety standards.',NULL,'optional','invoice',270,true),
('catch_certificate','Catch certificate','Confirms the catch was legal and not from unreported or unregulated fishing.',NULL,'optional','invoice',280,true),
('assay_certificate','Assay or quality certificate','Independent grade analysis. Grade determines the final price paid.',NULL,'optional','invoice',290,true),
('mineral_permit','Mineral export permit','Ministry authorisation to export this specific mineral.',NULL,'optional','invoice',300,true),
('eudr_statement','EUDR due diligence statement','EU deforestation regulation compliance for cocoa, coffee, palm, rubber, soy and timber.',NULL,'optional','invoice',310,true),
('textile_report','Fibre content and testing report','Composition and safety compliance for UK and EU retail.',NULL,'optional','invoice',320,true),
('cac_certificate','CAC certificate of incorporation','Your certificate of incorporation from the Corporate Affairs Commission.',1,'mandatory','company',400,true),
('cac_status_report','CAC status report','Current status report showing directors and shareholding.',1,'mandatory','company',410,true),
('tin_certificate','Tax identification number','Your TIN certificate from FIRS.',1,'mandatory','company',420,true),
('nepc_certificate','NEPC exporter registration','Nigerian Export Promotion Council registration certificate.',1,'mandatory','company',430,true),
('bank_statement','Six month bank statement','Statements for your business account covering the last six months.',1,'mandatory','company',440,true),
('domiciliary_details','Domiciliary account details','Account details for the export proceeds account named in your NXP.',1,'mandatory','company',450,true)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label, description = EXCLUDED.description, stage = EXCLUDED.stage,
  requirement = EXCLUDED.requirement, level = EXCLUDED.level, sort_order = EXCLUDED.sort_order,
  active = true, updated_at = now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_commodities_name ON public.commodities (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_regulated_commodities_name ON public.regulated_commodities (lower(name));

INSERT INTO public.commodities (name, category) VALUES
('Cocoa beans','agricultural'),('Sesame seeds','agricultural'),('Cashew nuts','agricultural'),
('Ginger','agricultural'),('Hibiscus flower','agricultural'),('Soya beans','agricultural'),
('Palm kernel','agricultural'),('Shea nuts','agricultural'),('Crude palm oil','agricultural'),
('Coffee','agricultural'),('Rubber','agricultural'),
('Lead ore','solid_minerals'),('Zinc ore','solid_minerals'),('Tin ore','solid_minerals'),
('Tantalite','solid_minerals'),('Lithium ore','solid_minerals'),('Barite','solid_minerals'),
('Gold dore','solid_minerals'),
('Copper cathode','metals'),('Aluminium ingots','metals'),
('Timber and sawn wood','timber'),('Charcoal','timber'),
('Frozen shrimp','seafood'),('Dried fish','seafood'),
('Garment textiles','textiles'),('Leather','textiles'),
('Processed foods','manufactured'),
('Other','other')
ON CONFLICT (lower(name)) DO UPDATE SET category = EXCLUDED.category, active = true, updated_at = now();

INSERT INTO public.regulated_commodities (name, category, requires_inspection) VALUES
('Cocoa beans','agricultural',true),('Sesame seeds','agricultural',true),('Cashew nuts','agricultural',true),
('Ginger','agricultural',true),('Hibiscus flower','agricultural',true),('Soya beans','agricultural',true),
('Palm kernel','agricultural',true),('Shea nuts','agricultural',true),('Crude palm oil','agricultural',true),
('Frozen shrimp','seafood',true),('Dried fish','seafood',true),
('Timber and sawn wood','timber',true),
('Lead ore','solid_minerals',true),('Zinc ore','solid_minerals',true),('Tin ore','solid_minerals',true),
('Tantalite','solid_minerals',true),('Lithium ore','solid_minerals',true),('Barite','solid_minerals',true),
('Gold dore','solid_minerals',true),('Copper cathode','metals',true)
ON CONFLICT (lower(name)) DO UPDATE SET category = EXCLUDED.category, requires_inspection = true, active = true, updated_at = now();
