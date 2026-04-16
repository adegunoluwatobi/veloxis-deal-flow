
-- Exporter applications table
CREATE TABLE public.exporter_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company_name text NOT NULL,
  country text NOT NULL,
  commodity text NOT NULL,
  buyer_countries text[] NOT NULL DEFAULT '{}',
  invoice_size text NOT NULL,
  shipment_frequency text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  deal_description text,
  assigned_partner text,
  status text NOT NULL DEFAULT 'pending',
  expansion_activated boolean NOT NULL DEFAULT false,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exporter_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form)
CREATE POLICY "Anyone can submit exporter application"
  ON public.exporter_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only platform admins can view
CREATE POLICY "Admins can view exporter applications"
  ON public.exporter_applications FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Only platform admins can update
CREATE POLICY "Admins can update exporter applications"
  ON public.exporter_applications FOR UPDATE
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Partner applications table
CREATE TABLE public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company_name text NOT NULL,
  countries_covered text[] NOT NULL DEFAULT '{}',
  partner_type text NOT NULL,
  sectors text[] NOT NULL DEFAULT '{}',
  network_size text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  description text,
  website text,
  status text NOT NULL DEFAULT 'under_review',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form)
CREATE POLICY "Anyone can submit partner application"
  ON public.partner_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only platform admins can view
CREATE POLICY "Admins can view partner applications"
  ON public.partner_applications FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Only platform admins can update
CREATE POLICY "Admins can update partner applications"
  ON public.partner_applications FOR UPDATE
  TO authenticated
  USING (is_platform_admin(auth.uid()));
