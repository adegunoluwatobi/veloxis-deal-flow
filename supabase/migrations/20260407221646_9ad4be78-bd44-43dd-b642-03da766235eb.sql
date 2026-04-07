
-- 1. New enums
CREATE TYPE public.sanctions_screening_status AS ENUM ('pending_screening', 'clear', 'flagged');
CREATE TYPE public.buyer_credit_check_status AS ENUM ('pending', 'pass', 'refer', 'fail');

-- 2. New columns on exporters
ALTER TABLE public.exporters
  ADD COLUMN source_of_funds_statement text,
  ADD COLUMN sanctions_screening_status public.sanctions_screening_status NOT NULL DEFAULT 'pending_screening',
  ADD COLUMN edd_required boolean NOT NULL DEFAULT true,
  ADD COLUMN edd_completed boolean NOT NULL DEFAULT false;

-- 3. UBO declarations table
CREATE TABLE public.ubo_declarations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exporter_id uuid NOT NULL REFERENCES public.exporters(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nationality text NOT NULL,
  date_of_birth date NOT NULL,
  residential_address text NOT NULL,
  ownership_percentage numeric NOT NULL CHECK (ownership_percentage >= 25 AND ownership_percentage <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ubo_declarations ENABLE ROW LEVEL SECURITY;

-- Exporters can manage own UBO declarations
CREATE POLICY "Exporters can view own UBO declarations"
  ON public.ubo_declarations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = ubo_declarations.exporter_id AND e.exporter_user_id = auth.uid()
  ));

CREATE POLICY "Exporters can insert own UBO declarations"
  ON public.ubo_declarations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = ubo_declarations.exporter_id AND e.exporter_user_id = auth.uid()
  ));

CREATE POLICY "Exporters can update own UBO declarations"
  ON public.ubo_declarations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = ubo_declarations.exporter_id AND e.exporter_user_id = auth.uid()
  ));

CREATE POLICY "Exporters can delete own UBO declarations"
  ON public.ubo_declarations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = ubo_declarations.exporter_id AND e.exporter_user_id = auth.uid()
  ));

-- Partners can view org UBO declarations
CREATE POLICY "Partners can view org UBO declarations"
  ON public.ubo_declarations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = ubo_declarations.exporter_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  ));

-- Veloxis staff full access
CREATE POLICY "Veloxis staff full access to UBO declarations"
  ON public.ubo_declarations FOR ALL TO authenticated
  USING (is_veloxis_staff(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_ubo_declarations_updated_at
  BEFORE UPDATE ON public.ubo_declarations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add new exporter document types
ALTER TYPE public.exporter_document_type ADD VALUE 'ubo_declaration_doc';
ALTER TYPE public.exporter_document_type ADD VALUE 'source_of_funds_doc';
ALTER TYPE public.exporter_document_type ADD VALUE 'bank_statements';

-- 5. New columns on deals (Buyer KYC)
ALTER TABLE public.deals
  ADD COLUMN buyer_country_of_incorporation text,
  ADD COLUMN buyer_sanctions_status public.sanctions_screening_status NOT NULL DEFAULT 'pending_screening',
  ADD COLUMN buyer_credit_check_status public.buyer_credit_check_status NOT NULL DEFAULT 'pending',
  ADD COLUMN buyer_underwriter_notes text;

-- 6. Add new deal document type
ALTER TYPE public.deal_document_type ADD VALUE 'buyer_registration_doc';
