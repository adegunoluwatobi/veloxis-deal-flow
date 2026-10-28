ALTER TABLE public.v2_exporters
  ADD COLUMN IF NOT EXISTS nepc_number text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'Nigeria',
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS banks_with_access boolean,
  ADD COLUMN IF NOT EXISTS other_banks text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accuracy_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposed_signatories jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Existing single-line addresses become the street line so nothing is lost.
UPDATE public.v2_exporters SET address_street = address WHERE address_street IS NULL AND address IS NOT NULL;

ALTER TABLE public.v2_exporter_directors
  ADD COLUMN IF NOT EXISTS person_role text NOT NULL DEFAULT 'director' CHECK (person_role IN ('director','shareholder','both')),
  ADD COLUMN IF NOT EXISTS shareholding_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_country text,
  ADD COLUMN IF NOT EXISTS id_expiry date,
  ADD COLUMN IF NOT EXISTS bvn text;

UPDATE public.v2_exporter_directors SET address_street = address WHERE address_street IS NULL AND address IS NOT NULL;

-- Bring each exporter's main director (stored on the company record) into the people list.
INSERT INTO public.v2_exporter_directors
  (exporter_id, full_name, email, phone, dob, nationality, id_type, id_number, address, address_street, position, is_primary, person_role)
SELECT e.id, e.director_name, e.director_email, e.director_phone, e.director_dob, e.director_nationality,
       e.director_id_type, e.director_id_number, e.director_address, e.director_address, 'Director', true, 'director'
FROM public.v2_exporters e
WHERE e.director_name IS NOT NULL AND btrim(e.director_name) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.v2_exporter_directors d WHERE d.exporter_id = e.id AND d.is_primary);

ALTER TABLE public.company_documents
  ADD COLUMN IF NOT EXISTS person_id uuid,
  ADD COLUMN IF NOT EXISTS issue_date date;
CREATE INDEX IF NOT EXISTS company_documents_person_idx ON public.company_documents (person_id);

INSERT INTO public.document_types (code, label, level, requirement, stage, sort_order, accepts, description)
VALUES
  ('business_address_proof', 'Proof of business address', 'company', 'mandatory', 1, 45, ARRAY['application/pdf','image/jpeg','image/png'], 'Utility bill or similar, issued within the last 3 months.'),
  ('bank_reference_letter', 'Letter of introduction / bank reference', 'company', 'optional', 1, 46, ARRAY['application/pdf','image/jpeg','image/png'], 'Optional supporting letter from your bank.'),
  ('passport_photo', 'Passport photograph', 'company', 'optional', 1, 47, ARRAY['image/jpeg','image/png'], 'Recent passport photograph of each director / shareholder.')
ON CONFLICT (code) DO NOTHING;

-- Exporters may not delete documents once their onboarding has been submitted.
CREATE OR REPLACE FUNCTION public.block_submitted_doc_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.v2_exporters e WHERE e.id = OLD.exporter_id AND e.onboarding_submitted_at IS NOT NULL)
     AND NOT public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role) THEN
    RAISE EXCEPTION 'Documents cannot be deleted after onboarding has been submitted';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_block_submitted_doc_delete ON public.company_documents;
CREATE TRIGGER trg_block_submitted_doc_delete BEFORE DELETE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.block_submitted_doc_delete();