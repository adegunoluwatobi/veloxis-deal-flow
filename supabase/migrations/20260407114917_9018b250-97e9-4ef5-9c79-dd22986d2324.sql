
-- Add new deal status enum value
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'ready_for_final_approval' AFTER 'docs_requested';

-- Update validate_status_transition to enforce new approval authority
CREATE OR REPLACE FUNCTION public.validate_status_transition(
  p_current_status deal_status,
  p_new_status deal_status,
  p_user_role app_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  -- Partners can submit and resubmit
  IF p_user_role IN ('partner_admin', 'partner_staff') THEN
    RETURN (p_current_status = 'draft' AND p_new_status = 'submitted')
        OR (p_current_status = 'docs_requested' AND p_new_status = 'submitted');
  END IF;

  -- Deal manager: review and processing, but NOT final approval/rejection
  IF p_user_role = 'deal_manager' THEN
    RETURN (p_current_status = 'submitted' AND p_new_status = 'under_review')
        OR (p_current_status = 'under_review' AND p_new_status IN ('docs_requested', 'ready_for_final_approval'))
        OR (p_current_status = 'docs_requested' AND p_new_status = 'under_review')
        OR (p_current_status = 'approved' AND p_new_status = 'ipu_sent')
        OR (p_current_status = 'ipu_sent' AND p_new_status IN ('ipu_sent', 'ipu_signed_awaiting_funding'))
        OR (p_current_status = 'ipu_signed_awaiting_funding' AND p_new_status = 'funded_active')
        OR (p_current_status = 'funded_active' AND p_new_status IN ('repayment_due', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'repayment_due' AND p_new_status IN ('overdue', 'closed_repaid', 'closed_partial'))
        OR (p_current_status = 'overdue' AND p_new_status IN ('closed_repaid', 'closed_partial'))
        OR (p_current_status = 'ipu_expired' AND p_new_status = 'ready_for_final_approval');
  END IF;

  -- Super admin: full authority including final approval and rejection
  IF p_user_role = 'super_admin' THEN
    RETURN (p_current_status = 'submitted' AND p_new_status = 'under_review')
        OR (p_current_status = 'under_review' AND p_new_status IN ('docs_requested', 'ready_for_final_approval', 'approved', 'rejected'))
        OR (p_current_status = 'ready_for_final_approval' AND p_new_status IN ('approved', 'rejected'))
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
