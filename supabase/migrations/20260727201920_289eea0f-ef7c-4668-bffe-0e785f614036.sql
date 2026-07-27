
-- BD-review fields on v2_exporters
ALTER TABLE public.v2_exporters
  ADD COLUMN IF NOT EXISTS bd_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS bd_approved_by uuid,
  ADD COLUMN IF NOT EXISTS bd_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS bd_rejection_reason text,
  ADD COLUMN IF NOT EXISTS onboarding_submitted_at timestamptz;

-- Onboarding document types
DO $$ BEGIN
  CREATE TYPE public.v2_exporter_doc_type AS ENUM ('cac_certificate','director_id','proof_of_address','bank_proof','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.v2_exporter_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id uuid NOT NULL REFERENCES public.v2_exporters(id) ON DELETE CASCADE,
  doc_type public.v2_exporter_doc_type NOT NULL,
  file_url text NOT NULL,
  file_name text,
  verified boolean NOT NULL DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_exporter_documents TO authenticated;
GRANT ALL ON public.v2_exporter_documents TO service_role;

ALTER TABLE public.v2_exporter_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exporter can manage own docs"
  ON public.v2_exporter_documents FOR ALL TO authenticated
  USING (public.v2_owns_exporter(auth.uid(), exporter_id))
  WITH CHECK (public.v2_owns_exporter(auth.uid(), exporter_id));

CREATE POLICY "Staff can read all exporter docs"
  ON public.v2_exporter_documents FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()));

CREATE POLICY "Credit & Super can verify docs"
  ON public.v2_exporter_documents FOR UPDATE TO authenticated
  USING (public.has_app_role(auth.uid(),'credit_officer') OR public.has_app_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_app_role(auth.uid(),'credit_officer') OR public.has_app_role(auth.uid(),'super_admin'));

CREATE INDEX IF NOT EXISTS idx_v2_exporter_documents_exporter ON public.v2_exporter_documents(exporter_id);
