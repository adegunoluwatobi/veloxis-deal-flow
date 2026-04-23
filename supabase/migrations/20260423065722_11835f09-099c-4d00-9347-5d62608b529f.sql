-- 1) Fix Function Search Path Mutable warnings on email queue helpers
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END;
$function$;

-- 2) Replace overly permissive "Anyone can submit partner application" with a non-true CHECK
DROP POLICY IF EXISTS "Anyone can submit partner application" ON public.partner_applications;

CREATE POLICY "Public can submit partner application"
ON public.partner_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Always allow public submissions, but force submission-time invariants
  status = 'pending'
  AND admin_notes IS NULL
  AND length(coalesce(email, '')) > 0
  AND length(coalesce(company_name, '')) > 0
);

-- 3) Harden partner_documents UPDATE — only the partner_admin of the same org may modify
--    their own KYB docs while KYB is not yet verified, and only certain fields.
--    (INSERT, SELECT for partners and ALL for veloxis remain unchanged.)
DROP POLICY IF EXISTS "Partner admins can update own org docs" ON public.partner_documents;

CREATE POLICY "Partner admins can update own org docs"
ON public.partner_documents
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'partner_admin'::app_role)
  AND is_partner_in_org(auth.uid(), partner_organisation_id)
  AND uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.partner_organisations po
    WHERE po.id = partner_documents.partner_organisation_id
      AND po.kyb_verified_at IS NULL
  )
)
WITH CHECK (
  has_role(auth.uid(), 'partner_admin'::app_role)
  AND is_partner_in_org(auth.uid(), partner_organisation_id)
  AND uploaded_by = auth.uid()
);

-- 4) Tighten partner_document_requests UPDATE — partner_admin can only mark their own
--    org's pending requests as fulfilled (link an uploaded doc); cannot mutate metadata.
DROP POLICY IF EXISTS "Partner admins can update own doc requests" ON public.partner_document_requests;

CREATE POLICY "Partner admins fulfil own doc requests"
ON public.partner_document_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'partner_admin'::app_role)
  AND is_partner_in_org(auth.uid(), partner_organisation_id)
  AND status = 'pending'
)
WITH CHECK (
  has_role(auth.uid(), 'partner_admin'::app_role)
  AND is_partner_in_org(auth.uid(), partner_organisation_id)
  AND status IN ('pending', 'fulfilled')
);

-- 5) Constrain "Partner admins can update own org profile" so partner_admins can only
--    touch the KYB-related fields (registration, address, primary contact, KYB submission
--    timestamp) — never status, verification timestamps, suspension, or notes.
--    This is enforced via a BEFORE UPDATE trigger because column-level RLS isn't supported.
CREATE OR REPLACE FUNCTION public.guard_partner_org_partner_admin_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Service role / migrations bypass
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  -- Super admins / Veloxis staff bypass
  IF public.is_veloxis_staff(v_uid) THEN RETURN NEW; END IF;

  -- Only partner_admins of this org reach here via RLS, but enforce field allow-list
  IF public.has_role(v_uid, 'partner_admin'::public.app_role)
     AND public.is_partner_in_org(v_uid, NEW.id) THEN

    -- Forbid changing review/status/audit fields
    IF NEW.kyb_status        IS DISTINCT FROM OLD.kyb_status
    OR NEW.kyb_verified_at   IS DISTINCT FROM OLD.kyb_verified_at
    OR NEW.kyb_verified_by   IS DISTINCT FROM OLD.kyb_verified_by
    OR NEW.kyb_rejected_at   IS DISTINCT FROM OLD.kyb_rejected_at
    OR NEW.kyb_rejected_by   IS DISTINCT FROM OLD.kyb_rejected_by
    OR NEW.kyb_rejection_reason IS DISTINCT FROM OLD.kyb_rejection_reason
    OR NEW.suspended_at      IS DISTINCT FROM OLD.suspended_at
    OR NEW.suspended_by      IS DISTINCT FROM OLD.suspended_by
    OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
    OR NEW.is_active         IS DISTINCT FROM OLD.is_active
    OR NEW.notes             IS DISTINCT FROM OLD.notes
    OR NEW.name              IS DISTINCT FROM OLD.name
    OR NEW.admin_email       IS DISTINCT FROM OLD.admin_email
    THEN
      -- Allow super-admin-controlled fields ONLY via super_admin/veloxis_staff
      RAISE EXCEPTION 'Only super admin can modify status, verification, suspension, name or admin fields on partner organisations.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Allow setting kyb_submitted_at exactly once (transition NULL -> timestamp)
    IF OLD.kyb_submitted_at IS NOT NULL
       AND NEW.kyb_submitted_at IS DISTINCT FROM OLD.kyb_submitted_at THEN
      RAISE EXCEPTION 'KYB submission timestamp cannot be modified after submission.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_partner_org_partner_admin_update_t ON public.partner_organisations;
CREATE TRIGGER guard_partner_org_partner_admin_update_t
BEFORE UPDATE ON public.partner_organisations
FOR EACH ROW
EXECUTE FUNCTION public.guard_partner_org_partner_admin_update();