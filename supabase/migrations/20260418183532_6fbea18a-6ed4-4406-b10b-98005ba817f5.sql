-- Extend the public lookup function to return id + name, so admins can
-- assign exporter applications to specific partner organisations.

DROP FUNCTION IF EXISTS public.lookup_active_partners_for_country(text);

CREATE OR REPLACE FUNCTION public.lookup_active_partners_for_country(p_country text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.id, po.name
  FROM public.partner_organisations po
  WHERE po.is_active = true
    AND po.country = p_country
  ORDER BY po.name;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_active_partners_for_country(text) TO anon, authenticated;