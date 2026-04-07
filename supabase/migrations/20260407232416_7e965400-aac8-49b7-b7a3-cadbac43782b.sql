
-- Update the validate_status_transition function
CREATE OR REPLACE FUNCTION public.validate_status_transition(p_current_status deal_status, p_new_status deal_status, p_user_role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_role = 'exporter' THEN
    RETURN (p_current_status = 'draft' AND p_new_status = 'submitted')
        OR (p_current_status = 'changes_requested' AND p_new_status = 'submitted')
        OR (p_current_status = 'pending_exporter_acceptance' AND p_new_status = 'approved')
        OR (p_current_status = 'pending_exporter_acceptance' AND p_new_status = 'declined_by_exporter');
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
        OR (p_current_status = 'under_review' AND p_new_status IN ('docs_requested', 'ready_for_final_approval', 'rejection_pending_approval'))
        OR (p_current_status = 'ready_for_final_approval' AND p_new_status IN ('pending_exporter_acceptance', 'rejected'))
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
        OR (p_current_status = 'ipu_expired' AND p_new_status IN ('approved', 'ready_for_final_approval'))
        OR (p_current_status = 'declined_by_exporter' AND p_new_status = 'pending_exporter_acceptance');
  END IF;

  RETURN false;
END;
$function$;

-- RLS policy for exporter to update deal for offer acceptance/decline
CREATE POLICY "Exporter can accept or decline offer"
ON public.deals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = deals.exporter_id
    AND e.exporter_user_id = auth.uid()
  )
  AND status = 'pending_exporter_acceptance'
)
WITH CHECK (
  status IN ('approved', 'declined_by_exporter')
);
