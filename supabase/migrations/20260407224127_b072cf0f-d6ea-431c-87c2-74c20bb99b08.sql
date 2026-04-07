
-- Update validate_status_transition to include new transitions
CREATE OR REPLACE FUNCTION public.validate_status_transition(p_current_status deal_status, p_new_status deal_status, p_user_role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_role = 'exporter' THEN
    RETURN (p_current_status = 'draft' AND p_new_status = 'submitted')
        OR (p_current_status = 'changes_requested' AND p_new_status = 'submitted');
  END IF;

  IF p_user_role IN ('partner_admin', 'partner_staff') THEN
    RETURN (p_current_status = 'submitted' AND p_new_status = 'sent_to_veloxis')
        OR (p_current_status = 'submitted' AND p_new_status = 'changes_requested')
        OR (p_current_status = 'submitted' AND p_new_status = 'rejected_by_partner')
        OR (p_current_status = 'changes_requested' AND p_new_status = 'submitted');
  END IF;

  IF p_user_role = 'deal_manager' THEN
    RETURN (p_current_status = 'sent_to_veloxis' AND p_new_status = 'under_review')
        OR (p_current_status = 'under_review' AND p_new_status IN ('docs_requested', 'ready_for_final_approval', 'rejection_pending_approval'))
        OR (p_current_status = 'docs_requested' AND p_new_status = 'under_review')
        OR (p_current_status = 'approved' AND p_new_status = 'ipu_sent')
        OR (p_current_status = 'ipu_sent' AND p_new_status IN ('ipu_sent', 'ipu_signed_awaiting_funding'))
        OR (p_current_status = 'ipu_signed_awaiting_funding' AND p_new_status = 'funded_active')
        OR (p_current_status = 'funded_active' AND p_new_status IN ('repayment_due', 'payment_received', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'repayment_due' AND p_new_status IN ('overdue', 'payment_received', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'overdue' AND p_new_status IN ('payment_received', 'in_collections', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'payment_received' AND p_new_status IN ('closed_repaid', 'closed_partial'))
        OR (p_current_status = 'in_collections' AND p_new_status IN ('closed_repaid', 'closed_partial'))
        OR (p_current_status = 'ipu_expired' AND p_new_status = 'ready_for_final_approval');
  END IF;

  IF p_user_role = 'super_admin' THEN
    RETURN (p_current_status = 'sent_to_veloxis' AND p_new_status = 'under_review')
        OR (p_current_status = 'under_review' AND p_new_status IN ('docs_requested', 'ready_for_final_approval', 'rejection_pending_approval', 'approved', 'rejected'))
        OR (p_current_status = 'ready_for_final_approval' AND p_new_status IN ('approved', 'rejected'))
        OR (p_current_status = 'rejection_pending_approval' AND p_new_status IN ('rejected', 'under_review'))
        OR (p_current_status = 'docs_requested' AND p_new_status = 'under_review')
        OR (p_current_status = 'approved' AND p_new_status = 'ipu_sent')
        OR (p_current_status = 'ipu_sent' AND p_new_status IN ('ipu_sent', 'ipu_signed_awaiting_funding'))
        OR (p_current_status = 'ipu_signed_awaiting_funding' AND p_new_status = 'funded_active')
        OR (p_current_status = 'funded_active' AND p_new_status IN ('repayment_due', 'payment_received', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'repayment_due' AND p_new_status IN ('overdue', 'payment_received', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'overdue' AND p_new_status IN ('payment_received', 'in_collections', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'payment_received' AND p_new_status IN ('closed_repaid', 'closed_partial'))
        OR (p_current_status = 'in_collections' AND p_new_status IN ('closed_repaid', 'closed_partial'))
        OR (p_current_status = 'ipu_expired' AND p_new_status IN ('approved', 'ready_for_final_approval'));
  END IF;

  RETURN false;
END;
$function$;

-- Update the Veloxis staff RLS policies to include new statuses
DROP POLICY IF EXISTS "Veloxis staff can update veloxis-stage deals" ON public.deals;
CREATE POLICY "Veloxis staff can update veloxis-stage deals"
ON public.deals FOR UPDATE TO authenticated
USING (
  is_veloxis_staff(auth.uid()) AND status IN (
    'sent_to_veloxis', 'under_review', 'docs_requested',
    'ready_for_final_approval', 'rejection_pending_approval',
    'approved', 'rejected', 'rejected_by_veloxis',
    'ipu_sent', 'ipu_expired', 'ipu_signed_awaiting_funding',
    'funded_active', 'repayment_due', 'overdue',
    'payment_received', 'in_collections',
    'closed_repaid', 'closed_partial'
  )
);

DROP POLICY IF EXISTS "Veloxis staff can view submitted deals only" ON public.deals;
CREATE POLICY "Veloxis staff can view submitted deals only"
ON public.deals FOR SELECT TO authenticated
USING (
  is_veloxis_staff(auth.uid()) AND status IN (
    'sent_to_veloxis', 'under_review', 'docs_requested',
    'ready_for_final_approval', 'rejection_pending_approval',
    'approved', 'rejected', 'rejected_by_veloxis',
    'ipu_sent', 'ipu_expired', 'ipu_signed_awaiting_funding',
    'funded_active', 'repayment_due', 'overdue',
    'payment_received', 'in_collections',
    'closed_repaid', 'closed_partial'
  )
);
