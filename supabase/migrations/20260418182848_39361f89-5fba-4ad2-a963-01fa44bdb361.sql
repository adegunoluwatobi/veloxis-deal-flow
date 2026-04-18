-- Public lookup function: returns active partner names covering a given country.
-- Used by the anonymous exporter application form to route applications.
-- Exposes only the partner name + country (no contact/admin/internal fields).

CREATE OR REPLACE FUNCTION public.lookup_active_partners_for_country(p_country text)
RETURNS TABLE(name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.name
  FROM public.partner_organisations po
  WHERE po.is_active = true
    AND po.country = p_country;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_active_partners_for_country(text) TO anon, authenticated;