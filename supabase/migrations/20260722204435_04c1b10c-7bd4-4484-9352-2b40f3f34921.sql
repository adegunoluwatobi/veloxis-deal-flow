
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deed_of_assignment_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deed_of_assignment_sent_by uuid,
  ADD COLUMN IF NOT EXISTS deed_of_assignment_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS deed_of_assignment_acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS notice_of_assignment_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notice_of_assignment_sent_by uuid,
  ADD COLUMN IF NOT EXISTS notice_of_assignment_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS notice_of_assignment_acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS buyer_direct_confirmation_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_direct_confirmation_by uuid,
  ADD COLUMN IF NOT EXISTS buyer_direct_confirmation_notes text,
  ADD COLUMN IF NOT EXISTS disbursement_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS disbursement_recorded_by uuid,
  ADD COLUMN IF NOT EXISTS disbursement_amount numeric,
  ADD COLUMN IF NOT EXISTS disbursement_reference text,
  ADD COLUMN IF NOT EXISTS repayment_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS repayment_recorded_by uuid,
  ADD COLUMN IF NOT EXISTS repayment_amount numeric,
  ADD COLUMN IF NOT EXISTS repayment_reference text;

CREATE OR REPLACE FUNCTION public.is_veloxis_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'deal_manager', 'admin_manager')
  )
$function$;

CREATE OR REPLACE FUNCTION public.validate_status_transition(
  p_current_status public.deal_status,
  p_new_status public.deal_status,
  p_user_role public.app_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_role = 'exporter' THEN
    RETURN (p_current_status = 'draft'              AND p_new_status = 'submitted')
        OR (p_current_status = 'docs_requested'     AND p_new_status = 'submitted')
        OR (p_current_status = 'changes_requested'  AND p_new_status = 'submitted');
  END IF;

  IF p_user_role IN ('super_admin', 'deal_manager', 'admin_manager') THEN
    RETURN (p_current_status = 'submitted'          AND p_new_status = 'under_review')
        OR (p_current_status = 'under_review'       AND p_new_status IN ('docs_requested','approved'))
        OR (p_current_status = 'docs_requested'     AND p_new_status IN ('under_review','submitted'))
        OR (p_current_status = 'approved'           AND p_new_status = 'deed_sent')
        OR (p_current_status = 'deed_sent'          AND p_new_status = 'deed_acknowledged')
        OR (p_current_status = 'deed_acknowledged'  AND p_new_status = 'funded_active')
        OR (p_current_status = 'funded_active'      AND p_new_status IN ('repayment_due','payment_received'))
        OR (p_current_status = 'repayment_due'      AND p_new_status IN ('payment_received','closed_partial'))
        OR (p_current_status = 'payment_received'   AND p_new_status IN ('closed_repaid','closed_partial'));
  END IF;

  RETURN false;
END;
$function$;
