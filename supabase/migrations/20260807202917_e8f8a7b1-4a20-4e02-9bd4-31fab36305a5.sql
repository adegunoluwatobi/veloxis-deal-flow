CREATE OR REPLACE FUNCTION public.v2_can_review_documents(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.app_user_roles
  WHERE user_id = _user_id AND role IN ('credit_officer','super_admin')
) $$;

ALTER VIEW public.v2_invoices_with_ageing SET (security_invoker = true);