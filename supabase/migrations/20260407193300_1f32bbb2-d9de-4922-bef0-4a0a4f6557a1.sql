-- Add new columns to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_reference text UNIQUE,
  ADD COLUMN IF NOT EXISTS partner_organisation_id uuid REFERENCES public.partner_organisations(id),
  ADD COLUMN IF NOT EXISTS buyer_contact_phone text,
  ADD COLUMN IF NOT EXISTS export_destination text,
  ADD COLUMN IF NOT EXISTS export_licence_number text,
  ADD COLUMN IF NOT EXISTS hs_code text,
  ADD COLUMN IF NOT EXISTS incoterms text,
  ADD COLUMN IF NOT EXISTS export_licence_document_id uuid REFERENCES public.exporter_documents(id),
  ADD COLUMN IF NOT EXISTS invoice_file_path text,
  ADD COLUMN IF NOT EXISTS payment_due_date date,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_sort_code_iban text,
  ADD COLUMN IF NOT EXISTS bank_country text,
  ADD COLUMN IF NOT EXISTS bank_name_match boolean,
  ADD COLUMN IF NOT EXISTS buyer_name_match boolean,
  ADD COLUMN IF NOT EXISTS licence_name_match boolean,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_veloxis_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS funded_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_notes text,
  ADD COLUMN IF NOT EXISTS advance_currency text,
  ADD COLUMN IF NOT EXISTS repayment_due_date date,
  ADD COLUMN IF NOT EXISTS repayment_amount numeric;

-- Create sequence for deal references
CREATE SEQUENCE IF NOT EXISTS public.deal_reference_seq START 1;

-- Create function to auto-generate deal reference
CREATE OR REPLACE FUNCTION public.generate_deal_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_reference IS NULL THEN
    NEW.deal_reference := 'VLX-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('public.deal_reference_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for deal reference
DROP TRIGGER IF EXISTS trg_deal_reference ON public.deals;
CREATE TRIGGER trg_deal_reference
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_deal_reference();

-- Create exporter_bank_accounts table
CREATE TABLE IF NOT EXISTS public.exporter_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id uuid NOT NULL REFERENCES public.exporters(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  sort_code_iban text NOT NULL,
  bank_country text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exporter_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Exporters can manage their own bank accounts
CREATE POLICY "Exporters can view own bank accounts"
  ON public.exporter_bank_accounts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = exporter_bank_accounts.exporter_id
      AND e.exporter_user_id = auth.uid()
  ));

CREATE POLICY "Exporters can insert own bank accounts"
  ON public.exporter_bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = exporter_bank_accounts.exporter_id
      AND e.exporter_user_id = auth.uid()
  ));

CREATE POLICY "Exporters can update own bank accounts"
  ON public.exporter_bank_accounts FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = exporter_bank_accounts.exporter_id
      AND e.exporter_user_id = auth.uid()
  ));

-- Partners can view bank accounts for their org's exporters
CREATE POLICY "Partners can view org bank accounts"
  ON public.exporter_bank_accounts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = exporter_bank_accounts.exporter_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  ));

-- Veloxis staff can view all bank accounts
CREATE POLICY "Veloxis staff can view all bank accounts"
  ON public.exporter_bank_accounts FOR SELECT
  TO authenticated
  USING (is_veloxis_staff(auth.uid()));

-- RLS for exporters to create and view their own deals
CREATE POLICY "Exporters can view own deals"
  ON public.deals FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = deals.exporter_id
      AND e.exporter_user_id = auth.uid()
  ));

CREATE POLICY "Exporters can insert own deals"
  ON public.deals FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = deals.exporter_id
      AND e.exporter_user_id = auth.uid()
  ));

CREATE POLICY "Exporters can update own draft deals"
  ON public.deals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exporters e
      WHERE e.id = deals.exporter_id
        AND e.exporter_user_id = auth.uid()
    )
    AND status IN ('draft', 'changes_requested')
  );