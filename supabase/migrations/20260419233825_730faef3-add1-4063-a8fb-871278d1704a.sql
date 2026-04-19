
-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','action_required')),
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypasses RLS automatically; no INSERT policy = blocked for clients
-- Triggers run as SECURITY DEFINER so they can insert.

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- ============================================================
-- HELPER: get partner user ids for a partner_organisation_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_partner_org(
  p_org_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_link TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ur.user_id, p_title, p_message, p_type, p_link
  FROM public.user_roles ur
  WHERE ur.partner_organisation_id = p_org_id
    AND ur.role IN ('partner_admin','partner_staff');
END;
$$;

-- ============================================================
-- TRIGGER 1: Exporter submits deal → notify partner
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_deal_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exporter_name TEXT;
  v_org_id UUID;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    SELECT e.company_name, get_partner_org_id(e.originator_id)
      INTO v_exporter_name, v_org_id
    FROM public.exporters e WHERE e.id = NEW.exporter_id;

    PERFORM notify_partner_org(
      v_org_id,
      'New application requires review',
      'New application from ' || COALESCE(v_exporter_name,'an exporter') ||
        COALESCE(' (' || NEW.invoice_number || ')',''),
      'action_required',
      '/greystar/deals/' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deal_submission ON public.deals;
CREATE TRIGGER trg_notify_deal_submission
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.notify_on_deal_submission();

-- ============================================================
-- TRIGGER 2 + 3 + 6: deal status changes → notify exporter / partner
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_deal_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exporter_user UUID;
  v_org_id UUID;
  v_invoice TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT e.exporter_user_id, get_partner_org_id(e.originator_id)
    INTO v_exporter_user, v_org_id
  FROM public.exporters e WHERE e.id = NEW.exporter_id;

  v_invoice := COALESCE(NEW.invoice_number, NEW.deal_reference, 'your application');

  -- Partner approved → moves to under_review or sent_to_veloxis
  IF NEW.status IN ('under_review','sent_to_veloxis') AND OLD.status = 'submitted' THEN
    IF v_exporter_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_exporter_user,
        'Application approved by partner',
        'Your application ' || v_invoice || ' has been approved by your partner.',
        'success',
        '/exporter/deals/' || NEW.id::text);
    END IF;
  END IF;

  -- Partner rejected
  IF NEW.status = 'rejected_by_partner' AND v_exporter_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_exporter_user,
      'Application returned',
      'Your application ' || v_invoice || ' was returned' ||
        COALESCE(' — ' || NEW.rejection_reason, '') || '.',
      'warning',
      '/exporter/deals/' || NEW.id::text);
  END IF;

  -- Funded
  IF NEW.status = 'funded_active' AND OLD.status IS DISTINCT FROM 'funded_active' THEN
    IF v_exporter_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (v_exporter_user,
        'Your deal has been funded',
        'Your deal ' || v_invoice || ' has been funded — your advance is on its way.',
        'success',
        '/exporter/deals/' || NEW.id::text);
    END IF;
    PERFORM notify_partner_org(
      v_org_id,
      'Deal funded',
      'Deal ' || v_invoice || ' has been funded by Veloxis.',
      'success',
      '/greystar/deals/' || NEW.id::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deal_status_change ON public.deals;
CREATE TRIGGER trg_notify_deal_status_change
AFTER UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.notify_on_deal_status_change();

-- ============================================================
-- TRIGGER 4: Exporter submits profile change request → notify partner
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_kyc_change_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_org UUID;
BEGIN
  SELECT e.company_name, get_partner_org_id(e.originator_id)
    INTO v_name, v_org
  FROM public.exporters e WHERE e.id = NEW.exporter_id;

  PERFORM notify_partner_org(
    v_org,
    'Profile update needs approval',
    'Profile update request from ' || COALESCE(v_name,'an exporter') || ' requires approval.',
    'action_required',
    '/greystar/exporters/' || NEW.exporter_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_kyc_change_request ON public.kyc_profile_change_requests;
CREATE TRIGGER trg_notify_kyc_change_request
AFTER INSERT ON public.kyc_profile_change_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_kyc_change_request();

-- ============================================================
-- TRIGGER 5: KYC change request approved/rejected → notify exporter
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_kyc_change_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;

  SELECT e.exporter_user_id INTO v_user
  FROM public.exporters e WHERE e.id = NEW.exporter_id;

  IF v_user IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (v_user,
    'Profile update ' || NEW.status,
    'Your profile update has been ' || NEW.status ||
      COALESCE('. Reviewer note: ' || NEW.review_notes, '.'),
    CASE WHEN NEW.status = 'approved' THEN 'success' ELSE 'warning' END,
    '/exporter/account/profile');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_kyc_change_review ON public.kyc_profile_change_requests;
CREATE TRIGGER trg_notify_kyc_change_review
AFTER UPDATE OF status ON public.kyc_profile_change_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_kyc_change_review();

-- ============================================================
-- TRIGGER 7: New exporter created under a partner → notify partner
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_exporter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  v_org := get_partner_org_id(NEW.originator_id);
  PERFORM notify_partner_org(
    v_org,
    'New exporter registered',
    'New exporter ' || NEW.company_name || ' has been added and is pending KYC review.',
    'info',
    '/greystar/exporters/' || NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_exporter ON public.exporters;
CREATE TRIGGER trg_notify_new_exporter
AFTER INSERT ON public.exporters
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_exporter();

-- ============================================================
-- TRIGGER 8: KYC docs uploaded → notify partner
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_kyc_doc_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_org UUID;
BEGIN
  SELECT e.company_name, get_partner_org_id(e.originator_id)
    INTO v_name, v_org
  FROM public.exporters e WHERE e.id = NEW.exporter_id;

  PERFORM notify_partner_org(
    v_org,
    'KYC documents uploaded',
    COALESCE(v_name,'An exporter') || ' has uploaded a KYC document — review required.',
    'action_required',
    '/greystar/exporters/' || NEW.exporter_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_kyc_doc_upload ON public.exporter_documents;
CREATE TRIGGER trg_notify_kyc_doc_upload
AFTER INSERT ON public.exporter_documents
FOR EACH ROW EXECUTE FUNCTION public.notify_on_kyc_doc_upload();
