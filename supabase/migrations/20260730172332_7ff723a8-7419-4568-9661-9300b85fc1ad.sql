CREATE TABLE public.v2_exporter_directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exporter_id uuid NOT NULL REFERENCES public.v2_exporters(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  dob date,
  nationality text,
  id_type text,
  id_number text,
  address text,
  position text,
  is_primary boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX v2_exporter_directors_exporter_idx ON public.v2_exporter_directors(exporter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_exporter_directors TO authenticated;
GRANT ALL ON public.v2_exporter_directors TO service_role;

ALTER TABLE public.v2_exporter_directors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exporter can manage own directors"
ON public.v2_exporter_directors FOR ALL TO authenticated
USING (public.v2_owns_exporter(auth.uid(), exporter_id))
WITH CHECK (public.v2_owns_exporter(auth.uid(), exporter_id));

CREATE POLICY "Staff can read all directors"
ON public.v2_exporter_directors FOR SELECT TO authenticated
USING (public.is_v2_staff(auth.uid()));

CREATE POLICY "Credit & Super can update directors"
ON public.v2_exporter_directors FOR UPDATE TO authenticated
USING (public.has_app_role(auth.uid(), 'credit_officer'::v2_app_role) OR public.has_app_role(auth.uid(), 'super_admin'::v2_app_role))
WITH CHECK (public.has_app_role(auth.uid(), 'credit_officer'::v2_app_role) OR public.has_app_role(auth.uid(), 'super_admin'::v2_app_role));

CREATE TRIGGER v2_exporter_directors_updated_at
BEFORE UPDATE ON public.v2_exporter_directors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();