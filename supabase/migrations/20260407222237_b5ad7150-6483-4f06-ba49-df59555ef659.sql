
-- 1. New enums
CREATE TYPE public.settlement_method_type AS ENUM ('dom_account', 'naira_account');
CREATE TYPE public.repayment_reconciliation_status AS ENUM ('exact', 'short_payment', 'overpayment');

-- 2. New columns on deals
ALTER TABLE public.deals
  ADD COLUMN settlement_currency text,
  ADD COLUMN settlement_method public.settlement_method_type,
  ADD COLUMN ngn_equivalent_at_disbursement numeric,
  ADD COLUMN fx_risk_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN cbn_repatriation_deadline date,
  ADD COLUMN repayment_currency_received text,
  ADD COLUMN repayment_fx_rate numeric,
  ADD COLUMN repayment_gbp_equivalent numeric,
  ADD COLUMN repayment_reconciliation_status public.repayment_reconciliation_status;

-- 3. New columns on exporter_bank_accounts
ALTER TABLE public.exporter_bank_accounts
  ADD COLUMN account_currency text DEFAULT 'USD',
  ADD COLUMN swift_bic text,
  ADD COLUMN is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN verified_at timestamp with time zone,
  ADD COLUMN verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN proof_document_path text;

-- 4. Allow Veloxis staff to update bank account verification
CREATE POLICY "Veloxis staff can update bank accounts"
  ON public.exporter_bank_accounts FOR UPDATE TO authenticated
  USING (is_veloxis_staff(auth.uid()));

-- 5. Allow exporters to update own bank accounts (account_currency, swift_bic)
-- Already exists: "Exporters can update own bank accounts"
