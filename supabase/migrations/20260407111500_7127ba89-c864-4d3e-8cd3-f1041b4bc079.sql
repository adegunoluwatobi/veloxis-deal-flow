
-- 1. Create helper functions
CREATE OR REPLACE FUNCTION public.is_veloxis_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'deal_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_originator(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('originator_admin', 'originator_staff')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- 2. Migrate existing role data
UPDATE public.user_roles SET role = 'super_admin' WHERE role = 'deal_manager';
UPDATE public.user_roles SET role = 'originator_staff' WHERE role = 'greystar_originator';
UPDATE public.user_roles SET role = 'deal_manager' WHERE role = 'originator';

-- 3. Update validate_status_transition
CREATE OR REPLACE FUNCTION public.validate_status_transition(p_current_status deal_status, p_new_status deal_status, p_user_role app_role)
RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = public
AS $function$
BEGIN
  IF p_user_role IN ('originator_admin', 'originator_staff') THEN
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
$function$;

-- =====================================================
-- 4. UPDATE ALL RLS POLICIES
-- =====================================================

-- === audit_logs ===
DROP POLICY IF EXISTS "Greystar originators can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Originators can view own deal audit logs" ON public.audit_logs;

CREATE POLICY "Originators can view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_originator(auth.uid()));

CREATE POLICY "Veloxis staff and deal owners can view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  ((deal_id IS NOT NULL) AND EXISTS (
    SELECT 1 FROM deals WHERE deals.id = audit_logs.deal_id AND deals.originator_id = auth.uid()
  ))
  OR ((exporter_id IS NOT NULL) AND EXISTS (
    SELECT 1 FROM exporters WHERE exporters.id = audit_logs.exporter_id AND exporters.originator_id = auth.uid()
  ))
  OR public.is_veloxis_staff(auth.uid())
);

-- === deal_documents ===
DROP POLICY IF EXISTS "Deal managers can insert deal docs" ON public.deal_documents;
DROP POLICY IF EXISTS "Deal managers can update deal docs" ON public.deal_documents;
DROP POLICY IF EXISTS "Originators can insert docs on own deals" ON public.deal_documents;
DROP POLICY IF EXISTS "Originators can view own deal docs" ON public.deal_documents;

CREATE POLICY "Veloxis staff can insert deal docs" ON public.deal_documents
FOR INSERT TO authenticated
WITH CHECK (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Veloxis staff can update deal docs" ON public.deal_documents
FOR UPDATE TO authenticated
USING (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Originators can insert docs on own deals" ON public.deal_documents
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM deals
  WHERE deals.id = deal_documents.deal_id
    AND deals.originator_id = auth.uid()
    AND deals.status IN ('draft', 'docs_requested')
));

CREATE POLICY "Users can view deal docs" ON public.deal_documents
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_documents.deal_id AND deals.originator_id = auth.uid())
  OR public.is_veloxis_staff(auth.uid())
);

-- === deals ===
DROP POLICY IF EXISTS "Greystar originators can view all deals" ON public.deals;
DROP POLICY IF EXISTS "Originators can insert own deals" ON public.deals;
DROP POLICY IF EXISTS "Originators can update own draft/docs_requested deals" ON public.deals;
DROP POLICY IF EXISTS "Originators can view own deals" ON public.deals;

CREATE POLICY "Originators can view all deals" ON public.deals
FOR SELECT TO authenticated
USING (public.is_originator(auth.uid()));

CREATE POLICY "Staff can insert deals" ON public.deals
FOR INSERT TO authenticated
WITH CHECK (
  originator_id = auth.uid()
  AND (public.is_originator(auth.uid()) OR public.has_role(auth.uid(), 'deal_manager'))
);

CREATE POLICY "Owners and veloxis staff can update deals" ON public.deals
FOR UPDATE TO authenticated
USING (
  ((originator_id = auth.uid()) AND status IN ('draft', 'docs_requested'))
  OR public.is_veloxis_staff(auth.uid())
);

CREATE POLICY "Owners and veloxis staff can view deals" ON public.deals
FOR SELECT TO authenticated
USING (
  originator_id = auth.uid()
  OR public.is_veloxis_staff(auth.uid())
);

-- === exporter_documents ===
DROP POLICY IF EXISTS "Deal managers can update exporter docs" ON public.exporter_documents;
DROP POLICY IF EXISTS "Deal managers can view all exporter docs" ON public.exporter_documents;
DROP POLICY IF EXISTS "Greystar originators can insert exporter docs" ON public.exporter_documents;
DROP POLICY IF EXISTS "Greystar originators can update exporter docs" ON public.exporter_documents;
DROP POLICY IF EXISTS "Greystar originators can view all exporter docs" ON public.exporter_documents;
DROP POLICY IF EXISTS "Originators can insert own exporter docs" ON public.exporter_documents;
DROP POLICY IF EXISTS "Originators can view own exporter docs" ON public.exporter_documents;
DROP POLICY IF EXISTS "Exporters can upload own docs" ON public.exporter_documents;
DROP POLICY IF EXISTS "Exporters can view own exporter docs" ON public.exporter_documents;

CREATE POLICY "Veloxis staff can manage exporter docs" ON public.exporter_documents
FOR ALL TO authenticated
USING (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Originators can manage own exporter docs" ON public.exporter_documents
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM exporters
  WHERE exporters.id = exporter_documents.exporter_id AND exporters.originator_id = auth.uid()
));

CREATE POLICY "Exporters can view own docs" ON public.exporter_documents
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM exporters
  WHERE exporters.id = exporter_documents.exporter_id AND exporters.exporter_user_id = auth.uid()
));

CREATE POLICY "Exporters can upload own docs" ON public.exporter_documents
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM exporters
  WHERE exporters.id = exporter_documents.exporter_id AND exporters.exporter_user_id = auth.uid()
));

-- === exporter_upload_tokens ===
DROP POLICY IF EXISTS "Deal managers can view all tokens" ON public.exporter_upload_tokens;
DROP POLICY IF EXISTS "Greystar originators can manage upload tokens" ON public.exporter_upload_tokens;
DROP POLICY IF EXISTS "Originators manage own tokens" ON public.exporter_upload_tokens;

CREATE POLICY "Veloxis staff can view all tokens" ON public.exporter_upload_tokens
FOR SELECT TO authenticated
USING (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Originators can manage own tokens" ON public.exporter_upload_tokens
FOR ALL TO authenticated
USING (
  public.is_originator(auth.uid())
  OR EXISTS (
    SELECT 1 FROM exporters
    WHERE exporters.id = exporter_upload_tokens.exporter_id AND exporters.originator_id = auth.uid()
  )
);

-- === exporters ===
DROP POLICY IF EXISTS "Exporters can view own profile" ON public.exporters;
DROP POLICY IF EXISTS "Greystar originators can create exporters" ON public.exporters;
DROP POLICY IF EXISTS "Greystar originators can update exporters" ON public.exporters;
DROP POLICY IF EXISTS "Greystar originators can view all exporters" ON public.exporters;
DROP POLICY IF EXISTS "Originators can create exporters" ON public.exporters;
DROP POLICY IF EXISTS "Originators can update own pending exporters" ON public.exporters;
DROP POLICY IF EXISTS "Originators can view own exporters" ON public.exporters;

CREATE POLICY "Exporters can view own profile" ON public.exporters
FOR SELECT TO authenticated
USING (exporter_user_id = auth.uid());

CREATE POLICY "Originators can create exporters" ON public.exporters
FOR INSERT TO authenticated
WITH CHECK (originator_id = auth.uid() AND public.is_originator(auth.uid()));

CREATE POLICY "Originators and veloxis can update exporters" ON public.exporters
FOR UPDATE TO authenticated
USING (
  (originator_id = auth.uid() AND kyc_status = 'pending_documents')
  OR public.is_veloxis_staff(auth.uid())
);

CREATE POLICY "Originators and veloxis can view exporters" ON public.exporters
FOR SELECT TO authenticated
USING (
  originator_id = auth.uid()
  OR public.is_veloxis_staff(auth.uid())
);

-- === internal_notes ===
DROP POLICY IF EXISTS "Deal managers can insert notes as themselves" ON public.internal_notes;
DROP POLICY IF EXISTS "Deal managers have full access to internal notes" ON public.internal_notes;

CREATE POLICY "Veloxis staff have full access to internal notes" ON public.internal_notes
FOR ALL TO authenticated
USING (public.is_veloxis_staff(auth.uid()));

-- === ipus ===
DROP POLICY IF EXISTS "Deal managers have full access to IPUs" ON public.ipus;

CREATE POLICY "Veloxis staff have full access to IPUs" ON public.ipus
FOR ALL TO authenticated
USING (public.is_veloxis_staff(auth.uid()));

-- === system_config ===
DROP POLICY IF EXISTS "Deal managers can update system config" ON public.system_config;
DROP POLICY IF EXISTS "Everyone can read system config" ON public.system_config;

CREATE POLICY "Super admin can update all system config" ON public.system_config
FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Deal managers can update operational settings" ON public.system_config
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'deal_manager')
  AND key IN ('pilot_pool_gbp', 'pool_warning_threshold', 'pool_hard_block_threshold')
);

CREATE POLICY "Authenticated users can read system config" ON public.system_config
FOR SELECT TO authenticated
USING (true);

-- === user_roles ===
DROP POLICY IF EXISTS "Deal managers can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Super admin can read all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Originator admin can read originator roles" ON public.user_roles
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'originator_admin')
  AND role IN ('originator_admin', 'originator_staff')
);

CREATE POLICY "Users can read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- === users ===
DROP POLICY IF EXISTS "Deal managers can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Super admin can read all users" ON public.users
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Veloxis staff can read all users" ON public.users
FOR SELECT TO authenticated
USING (public.is_veloxis_staff(auth.uid()));

CREATE POLICY "Users can read own profile" ON public.users
FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE TO authenticated
USING (id = auth.uid());
