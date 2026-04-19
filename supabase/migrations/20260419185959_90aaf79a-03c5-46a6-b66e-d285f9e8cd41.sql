-- Default internal recipient for ops/admin notifications
INSERT INTO public.system_config (key, value, description)
VALUES (
  'notification_recipient_admin',
  'ops@veloxis.co.uk',
  'Email address that receives internal Veloxis admin/ops notifications (e.g. exporter forwarded for review).'
)
ON CONFLICT (key) DO NOTHING;

-- Helper: read configured admin recipient
CREATE OR REPLACE FUNCTION public.get_notification_recipient_admin()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.system_config WHERE key = 'notification_recipient_admin' LIMIT 1;
$$;

-- Helper: resolve a partner organisation's notification email.
-- Preference order:
--   1. partner_organisations.admin_email
--   2. linked partner_admin user's email
--   3. linked partner_staff user's email (fallback)
CREATE OR REPLACE FUNCTION public.get_partner_admin_email(p_org_id uuid)
RETURNS TABLE(email text, full_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_user_email text;
  v_user_name text;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN;
  END IF;

  -- 1. Use admin_email column if set
  SELECT po.admin_email INTO v_admin_email
  FROM public.partner_organisations po
  WHERE po.id = p_org_id AND po.admin_email IS NOT NULL AND po.admin_email <> '';

  IF v_admin_email IS NOT NULL THEN
    -- Try to enrich with a name from users table
    SELECT u.full_name INTO v_user_name
    FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.partner_organisation_id = p_org_id
      AND ur.role = 'partner_admin'
      AND lower(u.email) = lower(v_admin_email)
    LIMIT 1;

    RETURN QUERY SELECT v_admin_email, COALESCE(v_user_name, '');
    RETURN;
  END IF;

  -- 2. Fall back to partner_admin user
  SELECT u.email, COALESCE(u.full_name, '') INTO v_user_email, v_user_name
  FROM public.user_roles ur
  JOIN public.users u ON u.id = ur.user_id
  WHERE ur.partner_organisation_id = p_org_id
    AND ur.role = 'partner_admin'
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_user_email IS NOT NULL THEN
    RETURN QUERY SELECT v_user_email, v_user_name;
    RETURN;
  END IF;

  -- 3. Fall back to partner_staff user
  SELECT u.email, COALESCE(u.full_name, '') INTO v_user_email, v_user_name
  FROM public.user_roles ur
  JOIN public.users u ON u.id = ur.user_id
  WHERE ur.partner_organisation_id = p_org_id
    AND ur.role = 'partner_staff'
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_user_email IS NOT NULL THEN
    RETURN QUERY SELECT v_user_email, v_user_name;
  END IF;
END;
$$;