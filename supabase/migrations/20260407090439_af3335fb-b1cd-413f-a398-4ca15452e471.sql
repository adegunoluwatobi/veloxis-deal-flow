
-- ============================================================
-- VELOXIS DEAL ROOM — FULL SCHEMA MIGRATION
-- ============================================================

-- ==================== ENUMS ====================

CREATE TYPE public.app_role AS ENUM ('originator', 'deal_manager');

CREATE TYPE public.entity_type AS ENUM ('limited_company', 'plc', 'llp', 'incorporated_trustee');

CREATE TYPE public.commodity_type AS ENUM ('solid_minerals', 'scrap_metal', 'manufactured_goods', 'textiles');

CREATE TYPE public.deal_status AS ENUM (
  'draft', 'submitted', 'under_review', 'docs_requested', 'approved',
  'rejected', 'ipu_sent', 'ipu_expired', 'ipu_signed_awaiting_funding',
  'funded_active', 'repayment_due', 'overdue',
  'closed_repaid', 'closed_partial'
);

CREATE TYPE public.kyc_status AS ENUM (
  'pending_documents', 'documents_uploaded', 'under_review',
  'verified', 'kyc_document_expired', 'rejected'
);

CREATE TYPE public.expiry_status AS ENUM (
  'valid', 'expiring_soon_60', 'expiring_soon_30', 'expiring_soon_7', 'expired', 'no_expiry'
);

CREATE TYPE public.subscription_tier AS ENUM ('pay_as_you_go', 'veloxis_pro');

CREATE TYPE public.invoice_currency AS ENUM ('GBP', 'USD', 'EUR');

CREATE TYPE public.exporter_document_type AS ENUM ('cac_certificate', 'director_id', 'nepc_certificate', 'other');

CREATE TYPE public.deal_document_type AS ENUM ('commercial_invoice', 'bill_of_lading', 'other');

CREATE TYPE public.audit_action AS ENUM (
  'deal_created', 'deal_submitted', 'document_uploaded', 'deal_moved_to_under_review',
  'document_requested', 'deal_approved', 'deal_rejected', 'ipu_generated', 'ipu_sent',
  'ipu_signed', 'ipu_expired', 'ipu_resent', 'funding_recorded', 'repayment_recorded',
  'demurrage_updated', 'internal_note_added', 'deal_closed', 'deal_status_changed',
  'pricing_recalculated', 'document_superseded', 'exporter_created', 'kyc_verified',
  'kyc_rejected', 'upload_token_generated', 'exporter_document_uploaded',
  'exporter_document_verified'
);

-- ==================== USER ROLES TABLE (security) ====================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS on user_roles: users can read their own roles, deal_managers can read all
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Deal managers can read all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'deal_manager'));

-- ==================== USERS TABLE ====================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  organisation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Deal managers can read all users" ON public.users
  FOR SELECT USING (public.has_role(auth.uid(), 'deal_manager'));
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- ==================== SYSTEM CONFIG ====================

CREATE TABLE public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read system config" ON public.system_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Deal managers can update system config" ON public.system_config
  FOR UPDATE USING (public.has_role(auth.uid(), 'deal_manager'));

-- ==================== EXPORTERS ====================

CREATE TABLE public.exporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  originator_id UUID NOT NULL REFERENCES public.users(id),
  company_name TEXT NOT NULL,
  rc_number TEXT NOT NULL,
  entity_type public.entity_type NOT NULL,
  director_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  subscription_tier public.subscription_tier NOT NULL DEFAULT 'pay_as_you_go',
  kyc_status public.kyc_status NOT NULL DEFAULT 'pending_documents',
  kyc_verified_at TIMESTAMPTZ,
  kyc_verified_by UUID REFERENCES public.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Originators can view own exporters" ON public.exporters
  FOR SELECT USING (originator_id = auth.uid() OR public.has_role(auth.uid(), 'deal_manager'));
CREATE POLICY "Originators can create exporters" ON public.exporters
  FOR INSERT WITH CHECK (originator_id = auth.uid() AND public.has_role(auth.uid(), 'originator'));
CREATE POLICY "Originators can update own pending exporters" ON public.exporters
  FOR UPDATE USING (
    (originator_id = auth.uid() AND kyc_status = 'pending_documents')
    OR public.has_role(auth.uid(), 'deal_manager')
  );

-- ==================== EXPORTER UPLOAD TOKENS ====================

CREATE TABLE public.exporter_upload_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id UUID NOT NULL REFERENCES public.exporters(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  first_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exporter_upload_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Originators manage own tokens" ON public.exporter_upload_tokens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.exporters WHERE id = exporter_id AND originator_id = auth.uid())
  );
CREATE POLICY "Deal managers can view all tokens" ON public.exporter_upload_tokens
  FOR SELECT USING (public.has_role(auth.uid(), 'deal_manager'));

-- ==================== EXPORTER DOCUMENTS ====================

CREATE TABLE public.exporter_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id UUID NOT NULL REFERENCES public.exporters(id) ON DELETE CASCADE,
  document_type public.exporter_document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  expiry_date DATE,
  expiry_status public.expiry_status NOT NULL DEFAULT 'no_expiry',
  document_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (document_status IN ('pending_review', 'verified', 'rejected', 'expired')),
  is_superseded BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES public.users(id),
  verified_at TIMESTAMPTZ,
  uploaded_by_user_id UUID REFERENCES public.users(id),
  uploaded_by_token_id UUID REFERENCES public.exporter_upload_tokens(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_uploader CHECK (
    uploaded_by_user_id IS NOT NULL OR uploaded_by_token_id IS NOT NULL
  )
);
ALTER TABLE public.exporter_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Originators can view own exporter docs" ON public.exporter_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.exporters WHERE id = exporter_id AND originator_id = auth.uid())
  );
CREATE POLICY "Originators can insert own exporter docs" ON public.exporter_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.exporters WHERE id = exporter_id AND originator_id = auth.uid())
  );
CREATE POLICY "Deal managers can view all exporter docs" ON public.exporter_documents
  FOR SELECT USING (public.has_role(auth.uid(), 'deal_manager'));
CREATE POLICY "Deal managers can update exporter docs" ON public.exporter_documents
  FOR UPDATE USING (public.has_role(auth.uid(), 'deal_manager'));

-- ==================== DEALS ====================

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id UUID NOT NULL REFERENCES public.exporters(id),
  originator_id UUID NOT NULL REFERENCES public.users(id),
  parent_deal_id UUID REFERENCES public.deals(id),
  status public.deal_status NOT NULL DEFAULT 'draft',
  commodity_type public.commodity_type,
  goods_description TEXT,
  invoice_number TEXT,
  invoice_currency_v2 public.invoice_currency,
  invoice_value NUMERIC CHECK (invoice_value > 0),
  invoice_date DATE,
  gbp_equivalent NUMERIC,
  fx_rate_at_funding NUMERIC,
  fx_rate_source TEXT,
  payment_terms_days INTEGER CHECK (payment_terms_days IN (30, 45, 60)),
  advance_percentage NUMERIC NOT NULL DEFAULT 80 CHECK (advance_percentage > 0 AND advance_percentage <= 100),
  advance_amount NUMERIC,
  platform_fee_pct NUMERIC,
  platform_fee_amount NUMERIC,
  discount_fee_pct NUMERIC,
  discount_fee_amount NUMERIC,
  gross_yield NUMERIC,
  buyer_company_name TEXT,
  buyer_country TEXT,
  buyer_contact_name TEXT,
  buyer_contact_email TEXT,
  disbursement_date DATE,
  expected_settlement_date DATE,
  actual_repayment_date DATE,
  actual_repayment_amount NUMERIC,
  outstanding_balance NUMERIC,
  demurrage_rate_daily NUMERIC NOT NULL DEFAULT 0.001,
  demurrage_amount NUMERIC NOT NULL DEFAULT 0,
  overdue_days INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Originators can view own deals" ON public.deals
  FOR SELECT USING (originator_id = auth.uid() OR public.has_role(auth.uid(), 'deal_manager'));
CREATE POLICY "Originators can insert own deals" ON public.deals
  FOR INSERT WITH CHECK (originator_id = auth.uid() AND public.has_role(auth.uid(), 'originator'));
CREATE POLICY "Originators can update own draft/docs_requested deals" ON public.deals
  FOR UPDATE USING (
    (originator_id = auth.uid() AND status IN ('draft', 'docs_requested'))
    OR public.has_role(auth.uid(), 'deal_manager')
  );

-- ==================== DEAL DOCUMENTS ====================

CREATE TABLE public.deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  document_type public.deal_document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  is_superseded BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Originators can view own deal docs" ON public.deal_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.deals WHERE id = deal_id AND originator_id = auth.uid())
    OR public.has_role(auth.uid(), 'deal_manager')
  );
CREATE POLICY "Originators can insert docs on own deals" ON public.deal_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.deals WHERE id = deal_id AND originator_id = auth.uid() AND status IN ('draft', 'docs_requested'))
  );
CREATE POLICY "Deal managers can insert deal docs" ON public.deal_documents
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'deal_manager'));
CREATE POLICY "Deal managers can update deal docs" ON public.deal_documents
  FOR UPDATE USING (public.has_role(auth.uid(), 'deal_manager'));

-- ==================== IPUs ====================

CREATE TABLE public.ipus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  hellosign_request_id TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sent_to_email TEXT,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  hellosign_audit_cert_path TEXT,
  ipu_pdf_path TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ipus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal managers have full access to IPUs" ON public.ipus
  FOR ALL USING (public.has_role(auth.uid(), 'deal_manager'));

-- ==================== AUDIT LOGS ====================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id),
  exporter_id UUID REFERENCES public.exporters(id),
  user_id UUID REFERENCES public.users(id),
  user_role public.app_role,
  action_type public.audit_action NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Immutability triggers
CREATE OR REPLACE FUNCTION public.prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be updated';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be deleted';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER no_update_audit_logs
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_update();

CREATE TRIGGER no_delete_audit_logs
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_delete();

CREATE POLICY "Originators can view own deal audit logs" ON public.audit_logs
  FOR SELECT USING (
    (deal_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.deals WHERE id = deal_id AND originator_id = auth.uid()))
    OR (exporter_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.exporters WHERE id = exporter_id AND originator_id = auth.uid()))
    OR public.has_role(auth.uid(), 'deal_manager')
  );

-- ==================== INTERNAL NOTES ====================

CREATE TABLE public.internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id),
  note_body TEXT NOT NULL CHECK (length(note_body) >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal managers have full access to internal notes" ON public.internal_notes
  FOR ALL USING (public.has_role(auth.uid(), 'deal_manager'));
CREATE POLICY "Deal managers can insert notes as themselves" ON public.internal_notes
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'deal_manager') AND author_id = auth.uid()
  );

-- ==================== UPDATED_AT TRIGGER ====================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exporters_updated_at BEFORE UPDATE ON public.exporters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== AUTO-CREATE USER ON SIGNUP ====================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, organisation)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'organisation', '')
  );
  
  -- Auto-assign role from metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== AUTO-SUPERSEDE EXPORTER DOCUMENTS ====================

CREATE OR REPLACE FUNCTION public.auto_supersede_exporter_doc()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.exporter_documents
  SET is_superseded = true
  WHERE exporter_id = NEW.exporter_id
    AND document_type = NEW.document_type
    AND id != NEW.id
    AND is_superseded = false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER supersede_exporter_docs
  AFTER INSERT ON public.exporter_documents
  FOR EACH ROW EXECUTE FUNCTION public.auto_supersede_exporter_doc();

-- ==================== AUTO-SUPERSEDE DEAL DOCUMENTS ====================

CREATE OR REPLACE FUNCTION public.auto_supersede_deal_doc()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.deal_documents
  SET is_superseded = true
  WHERE deal_id = NEW.deal_id
    AND document_type = NEW.document_type
    AND id != NEW.id
    AND is_superseded = false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER supersede_deal_docs
  AFTER INSERT ON public.deal_documents
  FOR EACH ROW EXECUTE FUNCTION public.auto_supersede_deal_doc();

-- ==================== DB FUNCTIONS ====================

-- Insert audit log (service role only via edge function)
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_deal_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_role public.app_role DEFAULT NULL,
  p_action_type public.audit_action DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_exporter_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (deal_id, user_id, user_role, action_type, metadata, exporter_id)
  VALUES (p_deal_id, p_user_id, p_user_role, p_action_type, p_metadata, p_exporter_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Calculate deal pricing
CREATE OR REPLACE FUNCTION public.calculate_deal_pricing(
  p_invoice_value NUMERIC,
  p_advance_percentage NUMERIC DEFAULT 80,
  p_payment_terms_days INTEGER DEFAULT 30,
  p_subscription_tier public.subscription_tier DEFAULT 'pay_as_you_go'
)
RETURNS TABLE(
  advance_amount NUMERIC,
  platform_fee_pct NUMERIC,
  platform_fee_amount NUMERIC,
  discount_fee_pct NUMERIC,
  discount_fee_amount NUMERIC,
  gross_expected_yield NUMERIC,
  net_repayment_target NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_platform_fee_pct NUMERIC;
  v_discount_fee_pct NUMERIC;
BEGIN
  -- Platform fee
  IF p_subscription_tier = 'veloxis_pro' THEN
    v_platform_fee_pct := 0;
  ELSE
    v_platform_fee_pct := 0.01;
  END IF;

  -- Discount fee based on terms
  CASE p_payment_terms_days
    WHEN 30 THEN v_discount_fee_pct := 0.025;
    WHEN 45 THEN v_discount_fee_pct := 0.035;
    WHEN 60 THEN v_discount_fee_pct := 0.045;
    ELSE RAISE EXCEPTION 'Invalid payment terms: %. Must be 30, 45, or 60.', p_payment_terms_days;
  END CASE;

  RETURN QUERY SELECT
    p_invoice_value * (p_advance_percentage / 100.0),
    v_platform_fee_pct,
    p_invoice_value * v_platform_fee_pct,
    v_discount_fee_pct,
    p_invoice_value * v_discount_fee_pct,
    (p_invoice_value * v_platform_fee_pct) + (p_invoice_value * v_discount_fee_pct),
    p_invoice_value - (p_invoice_value * v_platform_fee_pct) - (p_invoice_value * v_discount_fee_pct);
END;
$$;

-- Validate status transition
CREATE OR REPLACE FUNCTION public.validate_status_transition(
  p_current_status public.deal_status,
  p_new_status public.deal_status,
  p_user_role public.app_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- Originator transitions
  IF p_user_role = 'originator' THEN
    RETURN (p_current_status = 'draft' AND p_new_status = 'submitted')
        OR (p_current_status = 'docs_requested' AND p_new_status = 'submitted');
  END IF;

  -- Deal manager transitions
  IF p_user_role = 'deal_manager' THEN
    RETURN (p_current_status = 'submitted' AND p_new_status = 'under_review')
        OR (p_current_status = 'under_review' AND p_new_status IN ('docs_requested', 'approved', 'rejected'))
        OR (p_current_status = 'docs_requested' AND p_new_status = 'under_review')
        OR (p_current_status = 'approved' AND p_new_status = 'ipu_sent')
        OR (p_current_status = 'ipu_sent' AND p_new_status IN ('ipu_sent', 'ipu_signed_awaiting_funding'))
        OR (p_current_status = 'ipu_signed_awaiting_funding' AND p_new_status = 'funded_active')
        OR (p_current_status = 'funded_active' AND p_new_status IN ('repayment_due', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'repayment_due' AND p_new_status IN ('overdue', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'overdue' AND p_new_status IN ('closed_repaid', 'closed_partial'))
        OR (p_current_status = 'ipu_expired' AND p_new_status = 'approved');
  END IF;

  RETURN false;
END;
$$;

-- Validate upload token
CREATE OR REPLACE FUNCTION public.validate_upload_token(p_token UUID)
RETURNS TABLE(token_id UUID, exporter_id UUID, company_name TEXT, is_valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS token_id,
    t.exporter_id,
    e.company_name,
    (t.is_active AND t.expires_at > now()) AS is_valid
  FROM public.exporter_upload_tokens t
  JOIN public.exporters e ON e.id = t.exporter_id
  WHERE t.token = p_token;
END;
$$;

-- Check pool availability
CREATE OR REPLACE FUNCTION public.check_pool_availability(p_advance_amount_gbp NUMERIC)
RETURNS TABLE(
  pool_gbp NUMERIC,
  deployed_gbp NUMERIC,
  available_gbp NUMERIC,
  would_deploy_gbp NUMERIC,
  warning_triggered BOOLEAN,
  hard_blocked BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool NUMERIC;
  v_deployed NUMERIC;
  v_warning_threshold NUMERIC;
  v_hard_threshold NUMERIC;
BEGIN
  SELECT value::NUMERIC INTO v_pool FROM public.system_config WHERE key = 'pilot_pool_gbp';
  SELECT COALESCE(value::NUMERIC, 0.9) INTO v_warning_threshold FROM public.system_config WHERE key = 'pool_warning_threshold';
  SELECT COALESCE(value::NUMERIC, 1.0) INTO v_hard_threshold FROM public.system_config WHERE key = 'pool_hard_block_threshold';

  SELECT COALESCE(SUM(gbp_equivalent), 0) INTO v_deployed
  FROM public.deals
  WHERE status IN ('funded_active', 'repayment_due', 'overdue');

  RETURN QUERY SELECT
    v_pool,
    v_deployed,
    v_pool - v_deployed,
    v_deployed + p_advance_amount_gbp,
    ((v_deployed + p_advance_amount_gbp) / v_pool) >= v_warning_threshold,
    ((v_deployed + p_advance_amount_gbp) / v_pool) > v_hard_threshold;
END;
$$;

-- Accrue demurrage
CREATE OR REPLACE FUNCTION public.accrue_demurrage(p_deal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal RECORD;
  v_overdue_days INTEGER;
BEGIN
  SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id AND status = 'overdue';
  IF NOT FOUND THEN RETURN; END IF;

  v_overdue_days := GREATEST(0, (CURRENT_DATE - v_deal.expected_settlement_date)::INTEGER);

  UPDATE public.deals
  SET overdue_days = v_overdue_days,
      demurrage_amount = v_deal.advance_amount * v_deal.demurrage_rate_daily * v_overdue_days
  WHERE id = p_deal_id;
END;
$$;

-- ==================== STORAGE BUCKET ====================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'veloxis-documents',
  'veloxis-documents',
  false,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

-- Storage policies
CREATE POLICY "Authenticated users can view own exporter docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'veloxis-documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can upload docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'veloxis-documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Deal managers can update docs" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'veloxis-documents'
    AND public.has_role(auth.uid(), 'deal_manager')
  );

-- ==================== SEED SYSTEM CONFIG ====================

INSERT INTO public.system_config (key, value, description) VALUES
  ('pilot_pool_gbp', '150000', 'Total pilot capital pool in GBP'),
  ('pool_warning_threshold', '0.9', 'Soft warning when deployed capital reaches this fraction of pool'),
  ('pool_hard_block_threshold', '1.0', 'Hard block when deployed capital exceeds this fraction of pool'),
  ('demurrage_rate_default', '0.001', 'Default daily demurrage rate (0.1%)'),
  ('repayment_warning_days', '3', 'Days before settlement date to trigger repayment_due status'),
  ('ipu_expiry_business_days', '5', 'Business days before unsigned IPU expires'),
  ('upload_token_expiry_hours', '48', 'Hours before upload token expires');

-- ==================== INDEXES ====================

CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deals_originator ON public.deals(originator_id);
CREATE INDEX idx_deals_exporter ON public.deals(exporter_id);
CREATE INDEX idx_exporters_originator ON public.exporters(originator_id);
CREATE INDEX idx_audit_logs_deal ON public.audit_logs(deal_id);
CREATE INDEX idx_audit_logs_exporter ON public.audit_logs(exporter_id);
CREATE INDEX idx_exporter_docs_exporter ON public.exporter_documents(exporter_id);
CREATE INDEX idx_deal_docs_deal ON public.deal_documents(deal_id);
CREATE INDEX idx_upload_tokens_token ON public.exporter_upload_tokens(token);
