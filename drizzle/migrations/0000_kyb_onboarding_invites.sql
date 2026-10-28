CREATE TABLE public.kyb_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  internal_note text,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','opened','registered','revoked')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  registered_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  registered_user_id uuid,
  exporter_id uuid,
  send_count int NOT NULL DEFAULT 1,
  last_sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kyb_invites TO authenticated;
GRANT ALL ON public.kyb_invites TO service_role;
ALTER TABLE public.kyb_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin reads all KYB invites" ON public.kyb_invites FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));
CREATE POLICY "BD reads own KYB invites" ON public.kyb_invites FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'originator'::public.v2_app_role) AND created_by = auth.uid());

CREATE TABLE public.kyb_invite_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kyb_invite_events TO authenticated;
GRANT ALL ON public.kyb_invite_events TO service_role;
ALTER TABLE public.kyb_invite_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin reads KYB invite events" ON public.kyb_invite_events FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'super_admin'::public.v2_app_role));
CREATE POLICY "BD reads events of own invites" ON public.kyb_invite_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kyb_invites i WHERE i.id = invite_id AND i.created_by = auth.uid()));

CREATE TABLE public.kyb_invite_rate_limits (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kyb_invite_rate_limits_ip_idx ON public.kyb_invite_rate_limits (ip_hash, created_at);
GRANT ALL ON public.kyb_invite_rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kyb_invite_rate_limits_id_seq TO service_role;
ALTER TABLE public.kyb_invite_rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.v2_exporters ADD COLUMN IF NOT EXISTS invite_id uuid;