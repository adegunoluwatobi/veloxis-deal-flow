
-- 1) Deactivate Brikk so it never shows up as a selectable partner anywhere
UPDATE public.partner_organisations
SET is_active = false,
    suspended_at = now(),
    suspension_reason = 'Removed from partner roster'
WHERE name = 'Brikk';

-- 2) Track the assigned partner organisation id on exporter_applications
ALTER TABLE public.exporter_applications
  ADD COLUMN IF NOT EXISTS assigned_partner_id uuid REFERENCES public.partner_organisations(id),
  ADD COLUMN IF NOT EXISTS exporter_id uuid REFERENCES public.exporters(id);

-- 3) Helper RPC: pick a default originator user for a given partner organisation
--    (first partner_admin, falling back to partner_staff). Used when admin assigns
--    an exporter application to a partner so we can create an exporters row.
CREATE OR REPLACE FUNCTION public.default_originator_for_partner_org(p_org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.user_roles
  WHERE partner_organisation_id = p_org_id
    AND role IN ('partner_admin', 'partner_staff')
  ORDER BY CASE role WHEN 'partner_admin' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.default_originator_for_partner_org(uuid) TO authenticated;
