
-- 1. Create partner_organisations table
CREATE TABLE public.partner_organisations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_organisations ENABLE ROW LEVEL SECURITY;

-- 2. Add column to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN partner_organisation_id UUID REFERENCES public.partner_organisations(id);

-- 3. Now add RLS on partner_organisations (column exists now)
CREATE POLICY "Veloxis staff can manage partner orgs"
  ON public.partner_organisations FOR ALL
  USING (is_veloxis_staff(auth.uid()));

CREATE POLICY "Partner users can view own org"
  ON public.partner_organisations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.partner_organisation_id = partner_organisations.id
  ));

-- 4. Rename enum values
ALTER TYPE public.app_role RENAME VALUE 'originator_admin' TO 'partner_admin';
ALTER TYPE public.app_role RENAME VALUE 'originator_staff' TO 'partner_staff';

DO $$ BEGIN
  ALTER TYPE public.app_role RENAME VALUE 'originator' TO 'partner_admin';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role RENAME VALUE 'greystar_originator' TO 'partner_staff';
EXCEPTION WHEN others THEN NULL;
END $$;

-- 5. Seed default org and link existing users
INSERT INTO public.partner_organisations (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Greystar Nigeria');

UPDATE public.user_roles
SET partner_organisation_id = '00000000-0000-0000-0000-000000000001'
WHERE role IN ('partner_admin', 'partner_staff');

-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.is_partner(_user_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('partner_admin', 'partner_staff')) $$;

CREATE OR REPLACE FUNCTION public.is_originator(_user_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.is_partner(_user_id) $$;

CREATE OR REPLACE FUNCTION public.is_partner_in_org(_user_id uuid, _org_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('partner_admin', 'partner_staff') AND partner_organisation_id = _org_id) $$;

CREATE OR REPLACE FUNCTION public.get_partner_org_id(_user_id uuid)
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT partner_organisation_id FROM public.user_roles WHERE user_id = _user_id AND role IN ('partner_admin', 'partner_staff') LIMIT 1 $$;

-- 7. Update validate_status_transition
CREATE OR REPLACE FUNCTION public.validate_status_transition(p_current_status deal_status, p_new_status deal_status, p_user_role app_role)
  RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_role IN ('partner_admin', 'partner_staff') THEN
    RETURN (p_current_status = 'draft' AND p_new_status = 'submitted')
        OR (p_current_status = 'docs_requested' AND p_new_status = 'submitted');
  END IF;
  IF p_user_role IN ('deal_manager', 'super_admin') THEN
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

-- 8. Update RLS policies
-- user_roles
DROP POLICY IF EXISTS "Originator admin can read originator roles" ON public.user_roles;
CREATE POLICY "Partner admin can read own org roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'partner_admin') AND role IN ('partner_admin', 'partner_staff') AND partner_organisation_id = public.get_partner_org_id(auth.uid()));

-- users
CREATE POLICY "Partner admin can read org users"
  ON public.users FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = users.id AND ur.partner_organisation_id = public.get_partner_org_id(auth.uid())));

-- deals
DROP POLICY IF EXISTS "Originators can view all deals" ON public.deals;
CREATE POLICY "Partners can view org deals" ON public.deals FOR SELECT USING (is_partner(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert deals" ON public.deals;
CREATE POLICY "Partner and veloxis can insert deals" ON public.deals FOR INSERT
  WITH CHECK ((originator_id = auth.uid()) AND (is_partner(auth.uid()) OR has_role(auth.uid(), 'deal_manager')));

-- exporters
DROP POLICY IF EXISTS "Originators can create exporters" ON public.exporters;
CREATE POLICY "Partners can create exporters" ON public.exporters FOR INSERT
  WITH CHECK ((originator_id = auth.uid()) AND is_partner(auth.uid()));

DROP POLICY IF EXISTS "Originators and veloxis can update exporters" ON public.exporters;
CREATE POLICY "Partners and veloxis can update exporters" ON public.exporters FOR UPDATE
  USING (((originator_id = auth.uid()) AND (kyc_status = 'pending_documents')) OR is_veloxis_staff(auth.uid()));

DROP POLICY IF EXISTS "Originators and veloxis can view exporters" ON public.exporters;
CREATE POLICY "Partners and veloxis can view exporters" ON public.exporters FOR SELECT
  USING ((originator_id = auth.uid()) OR is_veloxis_staff(auth.uid()));

-- audit_logs
DROP POLICY IF EXISTS "Originators can view audit logs" ON public.audit_logs;
CREATE POLICY "Partners can view audit logs" ON public.audit_logs FOR SELECT USING (is_partner(auth.uid()));

-- deal_documents
DROP POLICY IF EXISTS "Originators can insert docs on own deals" ON public.deal_documents;
CREATE POLICY "Partners can insert docs on own deals" ON public.deal_documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_documents.deal_id AND deals.originator_id = auth.uid() AND deals.status = ANY (ARRAY['draft'::deal_status, 'docs_requested'::deal_status])));

-- upload tokens
DROP POLICY IF EXISTS "Originators can manage own tokens" ON public.exporter_upload_tokens;
CREATE POLICY "Partners can manage own tokens" ON public.exporter_upload_tokens FOR ALL
  USING (is_partner(auth.uid()) OR EXISTS (SELECT 1 FROM exporters WHERE exporters.id = exporter_upload_tokens.exporter_id AND exporters.originator_id = auth.uid()));

-- trigger
CREATE TRIGGER update_partner_orgs_updated_at BEFORE UPDATE ON public.partner_organisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
