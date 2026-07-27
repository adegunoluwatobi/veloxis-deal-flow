
CREATE TYPE public.v2_app_role AS ENUM ('exporter','originator','credit_officer','approver','super_admin');
CREATE TYPE public.v2_onboarding_status AS ENUM ('pending','active','suspended');
CREATE TYPE public.v2_verification_status AS ENUM ('pending','clear','flagged');
CREATE TYPE public.v2_invoice_status AS ENUM (
  'draft','submitted','verified','approved','funded','monitoring','settled',
  'returned_for_revision','rejected','defaulted'
);
CREATE TYPE public.v2_invoice_currency AS ENUM ('GBP','USD','EUR');
CREATE TYPE public.v2_doc_type AS ENUM (
  'pro_forma','commercial_invoice','bill_of_lading','quality_cert',
  'deed_of_assignment','notice_of_assignment','tripartite','kyc','other'
);
CREATE TYPE public.v2_movement_type AS ENUM ('advance_out','settlement_in','residual_out');
CREATE TYPE public.v2_decision_type AS ENUM ('returned','rejected','approved','verified','funded','settled','override');
CREATE TYPE public.v2_nepc_status AS ENUM ('valid','expired','none');

-- PROFILES
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- APP USER ROLES
CREATE TABLE public.app_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.v2_app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.app_user_roles TO authenticated;
GRANT ALL ON public.app_user_roles TO service_role;
ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_app_role(_user_id uuid, _role public.v2_app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.app_user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.is_v2_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.app_user_roles WHERE user_id=_user_id AND role IN ('originator','credit_officer','approver','super_admin')) $$;

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_v2_staff(auth.uid()));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_app_role(auth.uid(),'super_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_app_role(auth.uid(),'super_admin'));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_app_role(auth.uid(),'super_admin'));

CREATE POLICY roles_read ON public.app_user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_v2_staff(auth.uid()));

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- EXPORTERS
CREATE TABLE public.v2_exporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  rc_number text,
  contact_name text,
  phone text,
  email text,
  commodity text,
  nepc_status public.v2_nepc_status NOT NULL DEFAULT 'none',
  address text,
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_status public.v2_onboarding_status NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.v2_exporters TO authenticated;
GRANT ALL ON public.v2_exporters TO service_role;
ALTER TABLE public.v2_exporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY exp_read ON public.v2_exporters FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_v2_staff(auth.uid()));
CREATE POLICY exp_update ON public.v2_exporters FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_v2_staff(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() OR public.is_v2_staff(auth.uid()));
CREATE POLICY exp_insert ON public.v2_exporters FOR INSERT TO authenticated
  WITH CHECK (
    public.has_app_role(auth.uid(),'originator')
    OR public.has_app_role(auth.uid(),'super_admin')
    OR owner_user_id = auth.uid()
  );

CREATE TRIGGER trg_v2_exporters_updated BEFORE UPDATE ON public.v2_exporters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BUYERS
CREATE TABLE public.v2_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  country text,
  companies_house_id text,
  credit_status public.v2_verification_status NOT NULL DEFAULT 'pending',
  sanctions_status public.v2_verification_status NOT NULL DEFAULT 'pending',
  credit_limit numeric(14,2),
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.v2_buyers TO authenticated;
GRANT ALL ON public.v2_buyers TO service_role;
ALTER TABLE public.v2_buyers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_v2_buyers_updated BEFORE UPDATE ON public.v2_buyers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVOICES
CREATE TABLE public.v2_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  exporter_id uuid NOT NULL REFERENCES public.v2_exporters(id) ON DELETE RESTRICT,
  buyer_id uuid REFERENCES public.v2_buyers(id) ON DELETE SET NULL,
  commodity text,
  invoice_currency public.v2_invoice_currency NOT NULL DEFAULT 'GBP',
  invoice_amount numeric(14,2) NOT NULL,
  terms_days int NOT NULL DEFAULT 30 CHECK (terms_days IN (30,45,60)),
  advance_rate numeric(5,2) NOT NULL DEFAULT 80,
  fee_percent numeric(5,2) NOT NULL DEFAULT 3.5,
  status public.v2_invoice_status NOT NULL DEFAULT 'draft',
  shipment_date date,
  maturity_date date,
  funded_date date,
  settled_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.v2_invoices TO authenticated;
GRANT ALL ON public.v2_invoices TO service_role;
ALTER TABLE public.v2_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX v2_invoices_exporter_idx ON public.v2_invoices(exporter_id);
CREATE INDEX v2_invoices_buyer_idx ON public.v2_invoices(buyer_id);
CREATE INDEX v2_invoices_status_idx ON public.v2_invoices(status);

CREATE OR REPLACE FUNCTION public.v2_owns_exporter(_user_id uuid, _exporter_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.v2_exporters WHERE id=_exporter_id AND owner_user_id=_user_id) $$;

CREATE OR REPLACE FUNCTION public.v2_owns_invoice(_user_id uuid, _invoice_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.v2_invoices i
  JOIN public.v2_exporters e ON e.id=i.exporter_id
  WHERE i.id=_invoice_id AND e.owner_user_id=_user_id
) $$;

CREATE OR REPLACE FUNCTION public.v2_exporter_can_see_buyer(_user_id uuid, _buyer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.v2_invoices i
  JOIN public.v2_exporters e ON e.id=i.exporter_id
  WHERE i.buyer_id=_buyer_id AND e.owner_user_id=_user_id
) $$;

CREATE POLICY inv_read ON public.v2_invoices FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_owns_exporter(auth.uid(), exporter_id));
CREATE POLICY inv_insert ON public.v2_invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_v2_staff(auth.uid()) OR public.v2_owns_exporter(auth.uid(), exporter_id));
CREATE POLICY inv_update ON public.v2_invoices FOR UPDATE TO authenticated
  USING (
    public.is_v2_staff(auth.uid())
    OR (public.v2_owns_exporter(auth.uid(), exporter_id) AND status IN ('draft','returned_for_revision'))
  )
  WITH CHECK (
    public.is_v2_staff(auth.uid())
    OR (public.v2_owns_exporter(auth.uid(), exporter_id) AND status IN ('draft','submitted','returned_for_revision'))
  );

CREATE POLICY buyers_read ON public.v2_buyers FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_exporter_can_see_buyer(auth.uid(), id));
CREATE POLICY buyers_insert ON public.v2_buyers FOR INSERT TO authenticated
  WITH CHECK (public.is_v2_staff(auth.uid()) OR public.has_app_role(auth.uid(),'exporter'));
CREATE POLICY buyers_update ON public.v2_buyers FOR UPDATE TO authenticated
  USING (public.has_app_role(auth.uid(),'credit_officer') OR public.has_app_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_app_role(auth.uid(),'credit_officer') OR public.has_app_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.v2_invoice_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.fee_percent := CASE NEW.terms_days
    WHEN 30 THEN 3.5 WHEN 45 THEN 4.5 WHEN 60 THEN 5.5
    ELSE NEW.fee_percent END;
  IF NEW.shipment_date IS NOT NULL THEN
    NEW.maturity_date := NEW.shipment_date + (NEW.terms_days || ' days')::interval;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_v2_invoice_defaults BEFORE INSERT OR UPDATE OF terms_days, shipment_date ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.v2_invoice_defaults();
CREATE TRIGGER trg_v2_invoices_updated BEFORE UPDATE ON public.v2_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVOICE DOCUMENTS
CREATE TABLE public.v2_invoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.v2_invoices(id) ON DELETE CASCADE,
  doc_type public.v2_doc_type NOT NULL,
  file_url text NOT NULL,
  file_name text,
  verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.v2_invoice_documents TO authenticated;
GRANT ALL ON public.v2_invoice_documents TO service_role;
ALTER TABLE public.v2_invoice_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX v2_invoice_docs_invoice_idx ON public.v2_invoice_documents(invoice_id);

CREATE POLICY doc_read ON public.v2_invoice_documents FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_owns_invoice(auth.uid(), invoice_id));
CREATE POLICY doc_insert ON public.v2_invoice_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_v2_staff(auth.uid()) OR public.v2_owns_invoice(auth.uid(), invoice_id));
CREATE POLICY doc_update ON public.v2_invoice_documents FOR UPDATE TO authenticated
  USING (
    public.has_app_role(auth.uid(),'credit_officer')
    OR public.has_app_role(auth.uid(),'super_admin')
    OR (public.v2_owns_invoice(auth.uid(), invoice_id) AND verified = false)
  )
  WITH CHECK (
    public.has_app_role(auth.uid(),'credit_officer')
    OR public.has_app_role(auth.uid(),'super_admin')
    OR (public.v2_owns_invoice(auth.uid(), invoice_id) AND verified = false)
  );

-- MONEY MOVEMENTS
CREATE TABLE public.v2_money_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.v2_invoices(id) ON DELETE CASCADE,
  type public.v2_movement_type NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency public.v2_invoice_currency NOT NULL DEFAULT 'GBP',
  note text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.v2_money_movements TO authenticated;
GRANT ALL ON public.v2_money_movements TO service_role;
ALTER TABLE public.v2_money_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY mv_read ON public.v2_money_movements FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_owns_invoice(auth.uid(), invoice_id));
CREATE POLICY mv_insert ON public.v2_money_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_app_role(auth.uid(),'approver') OR public.has_app_role(auth.uid(),'super_admin'));

-- DECISIONS
CREATE TABLE public.v2_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.v2_invoices(id) ON DELETE CASCADE,
  decision_type public.v2_decision_type NOT NULL,
  reason text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.v2_decisions TO authenticated;
GRANT ALL ON public.v2_decisions TO service_role;
ALTER TABLE public.v2_decisions ENABLE ROW LEVEL SECURITY;
CREATE INDEX v2_decisions_invoice_idx ON public.v2_decisions(invoice_id);

CREATE POLICY dec_read ON public.v2_decisions FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()) OR public.v2_owns_invoice(auth.uid(), invoice_id));
CREATE POLICY dec_insert ON public.v2_decisions FOR INSERT TO authenticated
  WITH CHECK (public.is_v2_staff(auth.uid()));

-- AUDIT LOG
CREATE TABLE public.v2_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.v2_invoices(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_status public.v2_invoice_status,
  to_status public.v2_invoice_status,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.v2_audit_log TO authenticated;
GRANT ALL ON public.v2_audit_log TO service_role;
ALTER TABLE public.v2_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_read ON public.v2_audit_log FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()));
CREATE POLICY audit_insert ON public.v2_audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.v2_prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'v2_audit_log is append-only'; END $$;
CREATE TRIGGER trg_v2_audit_no_update BEFORE UPDATE ON public.v2_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.v2_prevent_audit_mutation();
CREATE TRIGGER trg_v2_audit_no_delete BEFORE DELETE ON public.v2_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.v2_prevent_audit_mutation();

-- SETTINGS
CREATE TABLE public.v2_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  capital_base numeric(14,2) NOT NULL DEFAULT 100000,
  currency public.v2_invoice_currency NOT NULL DEFAULT 'GBP',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.v2_settings TO authenticated;
GRANT ALL ON public.v2_settings TO service_role;
ALTER TABLE public.v2_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY set_read ON public.v2_settings FOR SELECT TO authenticated
  USING (public.is_v2_staff(auth.uid()));
CREATE POLICY set_update ON public.v2_settings FOR UPDATE TO authenticated
  USING (public.has_app_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_app_role(auth.uid(),'super_admin'));

INSERT INTO public.v2_settings (id, capital_base, currency) VALUES (1, 100000, 'GBP')
  ON CONFLICT (id) DO NOTHING;

-- Create profile row automatically
CREATE OR REPLACE FUNCTION public.v2_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON auth.users;
CREATE TRIGGER on_auth_user_created_v2
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.v2_handle_new_user();
