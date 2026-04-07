
-- 1. Replace the validate_status_transition function with strict workflow gating
CREATE OR REPLACE FUNCTION public.validate_status_transition(p_current_status deal_status, p_new_status deal_status, p_user_role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Exporter: can only submit draft or resubmit after changes requested
  IF p_user_role = 'exporter' THEN
    RETURN (p_current_status = 'draft' AND p_new_status = 'submitted')
        OR (p_current_status = 'changes_requested' AND p_new_status = 'submitted');
  END IF;

  -- Partners: submit, request changes, reject — never approve/fund/review
  IF p_user_role IN ('partner_admin', 'partner_staff') THEN
    RETURN (p_current_status = 'submitted' AND p_new_status = 'sent_to_veloxis')
        OR (p_current_status = 'submitted' AND p_new_status = 'changes_requested')
        OR (p_current_status = 'submitted' AND p_new_status = 'rejected_by_partner')
        OR (p_current_status = 'changes_requested' AND p_new_status = 'submitted');
  END IF;

  -- Deal manager: can only act on deals at sent_to_veloxis or beyond
  IF p_user_role = 'deal_manager' THEN
    RETURN (p_current_status = 'sent_to_veloxis' AND p_new_status = 'under_review')
        OR (p_current_status = 'under_review' AND p_new_status IN ('docs_requested', 'ready_for_final_approval', 'rejection_pending_approval'))
        OR (p_current_status = 'docs_requested' AND p_new_status = 'under_review')
        OR (p_current_status = 'approved' AND p_new_status = 'ipu_sent')
        OR (p_current_status = 'ipu_sent' AND p_new_status IN ('ipu_sent', 'ipu_signed_awaiting_funding'))
        OR (p_current_status = 'ipu_signed_awaiting_funding' AND p_new_status = 'funded_active')
        OR (p_current_status = 'funded_active' AND p_new_status IN ('repayment_due', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'repayment_due' AND p_new_status IN ('overdue', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'overdue' AND p_new_status IN ('closed_repaid', 'closed_partial'))
        OR (p_current_status = 'ipu_expired' AND p_new_status = 'ready_for_final_approval');
  END IF;

  -- Super admin: full authority but ONLY on deals at sent_to_veloxis or beyond
  IF p_user_role = 'super_admin' THEN
    RETURN (p_current_status = 'sent_to_veloxis' AND p_new_status = 'under_review')
        OR (p_current_status = 'under_review' AND p_new_status IN ('docs_requested', 'ready_for_final_approval', 'rejection_pending_approval', 'approved', 'rejected'))
        OR (p_current_status = 'ready_for_final_approval' AND p_new_status IN ('approved', 'rejected'))
        OR (p_current_status = 'rejection_pending_approval' AND p_new_status IN ('rejected', 'under_review'))
        OR (p_current_status = 'docs_requested' AND p_new_status = 'under_review')
        OR (p_current_status = 'approved' AND p_new_status = 'ipu_sent')
        OR (p_current_status = 'ipu_sent' AND p_new_status IN ('ipu_sent', 'ipu_signed_awaiting_funding'))
        OR (p_current_status = 'ipu_signed_awaiting_funding' AND p_new_status = 'funded_active')
        OR (p_current_status = 'funded_active' AND p_new_status IN ('repayment_due', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'repayment_due' AND p_new_status IN ('overdue', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'overdue' AND p_new_status IN ('closed_repaid', 'closed_partial'))
        OR (p_current_status = 'ipu_expired' AND p_new_status IN ('approved', 'ready_for_final_approval'));
  END IF;

  RETURN false;
END;
$function$;

-- 2. Drop the existing overly broad Veloxis SELECT policy on deals
DROP POLICY IF EXISTS "Owners and veloxis staff can view deals" ON public.deals;

-- 3. Re-create: originator can view own deals (all statuses)
CREATE POLICY "Originators can view own deals"
  ON public.deals FOR SELECT
  TO authenticated
  USING (originator_id = auth.uid());

-- 4. Veloxis staff can only see deals at sent_to_veloxis or beyond
CREATE POLICY "Veloxis staff can view submitted deals only"
  ON public.deals FOR SELECT
  TO authenticated
  USING (
    is_veloxis_staff(auth.uid())
    AND status IN (
      'sent_to_veloxis', 'under_review', 'docs_requested',
      'ready_for_final_approval', 'rejection_pending_approval',
      'approved', 'rejected', 'rejected_by_veloxis',
      'ipu_sent', 'ipu_expired', 'ipu_signed_awaiting_funding',
      'funded_active', 'repayment_due', 'overdue',
      'closed_repaid', 'closed_partial'
    )
  );

-- 5. Drop the old overly broad Veloxis update policy
DROP POLICY IF EXISTS "Owners and veloxis staff can update deals" ON public.deals;

-- 6. Originators can update own draft/docs_requested deals
CREATE POLICY "Originators can update own deals"
  ON public.deals FOR UPDATE
  TO authenticated
  USING (
    originator_id = auth.uid()
    AND status IN ('draft', 'docs_requested', 'submitted', 'changes_requested')
  );

-- 7. Veloxis staff can only update deals at sent_to_veloxis or beyond
CREATE POLICY "Veloxis staff can update veloxis-stage deals"
  ON public.deals FOR UPDATE
  TO authenticated
  USING (
    is_veloxis_staff(auth.uid())
    AND status IN (
      'sent_to_veloxis', 'under_review', 'docs_requested',
      'ready_for_final_approval', 'rejection_pending_approval',
      'approved', 'rejected', 'rejected_by_veloxis',
      'ipu_sent', 'ipu_expired', 'ipu_signed_awaiting_funding',
      'funded_active', 'repayment_due', 'overdue',
      'closed_repaid', 'closed_partial'
    )
  );
