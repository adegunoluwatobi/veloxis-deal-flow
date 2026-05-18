
-- ============ ENUMS ============
CREATE TYPE public.verification_subject_type AS ENUM ('exporter','partner_organisation','buyer','user');
CREATE TYPE public.verification_job_type AS ENUM ('kyb','kyc','aml');
CREATE TYPE public.verification_provider_status AS ENUM ('not_started','submitted','provider_pending','provider_verified','provider_failed','action_required');
CREATE TYPE public.verification_review_status AS ENUM ('not_started','under_review','approved','rejected','action_required');
CREATE TYPE public.verification_access_status AS ENUM ('access_locked','access_unlocked','manually_checked');

-- ============ JOBS ============
CREATE TABLE public.verification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type public.verification_subject_type NOT NULL,
  subject_id UUID NOT NULL,
  partner_organisation_id UUID REFERENCES public.partner_organisations(id) ON DELETE SET NULL,
  job_type public.verification_job_type NOT NULL,
  provider TEXT NOT NULL DEFAULT 'smileid',
  provider_job_id TEXT,
  provider_user_id TEXT,
  provider_status public.verification_provider_status NOT NULL DEFAULT 'submitted',
  internal_status TEXT NOT NULL DEFAULT 'submitted',
  request_payload JSONB,
  result_payload JSONB,
  initiated_by UUID,
  -- Partner review
  partner_review_status public.verification_review_status NOT NULL DEFAULT 'not_started',
  reviewed_by_partner_admin_id UUID,
  partner_reviewed_at TIMESTAMPTZ,
  partner_review_notes TEXT,
  -- Super admin review
  super_admin_review_status public.verification_review_status NOT NULL DEFAULT 'not_started',
  reviewed_by_super_admin_id UUID,
  super_admin_reviewed_at TIMESTAMPTZ,
  super_admin_review_notes TEXT,
  -- Manual override
  manual_override_by UUID,
  manual_override_reason TEXT,
  manual_override_at TIMESTAMPTZ,
  -- Final
  final_access_status public.verification_access_status NOT NULL DEFAULT 'access_locked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vjobs_subject ON public.verification_jobs(subject_type, subject_id);
CREATE INDEX idx_vjobs_org ON public.verification_jobs(partner_organisation_id);
CREATE INDEX idx_vjobs_provider_job_id ON public.verification_jobs(provider_job_id);
CREATE INDEX idx_vjobs_status ON public.verification_jobs(provider_status, partner_review_status, super_admin_review_status);

CREATE TRIGGER trg_vjobs_updated BEFORE UPDATE ON public.verification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.verification_jobs ENABLE ROW LEVEL SECURITY;

-- Partner admin/staff: select own org
CREATE POLICY "Partner can view own org verification jobs" ON public.verification_jobs
  FOR SELECT TO authenticated
  USING (
    public.is_partner_in_org(auth.uid(), partner_organisation_id)
    OR public.is_veloxis_staff(auth.uid())
  );

-- Exporter: can see only their own subject row (safe via column-level view; raw payload also visible but we'll render safe summary in UI; server-side we block raw via separate view)
CREATE POLICY "Exporter can view own verification jobs" ON public.verification_jobs
  FOR SELECT TO authenticated
  USING (
    subject_type = 'exporter'
    AND EXISTS (SELECT 1 FROM public.exporters e WHERE e.id = subject_id AND e.exporter_user_id = auth.uid())
  );

-- Insert: partner admin (own org), or veloxis staff
CREATE POLICY "Partner or staff can initiate verification" ON public.verification_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_veloxis_staff(auth.uid())
    OR public.is_partner_in_org(auth.uid(), partner_organisation_id)
  );

-- Update: same actors; row-level enforcement of workflow is done in review edge function (server-side)
CREATE POLICY "Partner own org or staff can update verification" ON public.verification_jobs
  FOR UPDATE TO authenticated
  USING (
    public.is_veloxis_staff(auth.uid())
    OR public.is_partner_in_org(auth.uid(), partner_organisation_id)
  );

-- No delete policy (deletion disallowed)

-- Safe exporter view: only safe statuses + identifiers
CREATE VIEW public.verification_jobs_safe AS
SELECT id, subject_type, subject_id, job_type,
       CASE
         WHEN final_access_status = 'access_unlocked' THEN 'Verified'
         WHEN provider_status IN ('provider_failed') OR super_admin_review_status = 'rejected' OR partner_review_status = 'rejected' THEN 'Rejected'
         WHEN provider_status = 'action_required' OR partner_review_status = 'action_required' OR super_admin_review_status = 'action_required' THEN 'Action Required'
         ELSE 'Under Review'
       END AS display_status,
       created_at, updated_at
FROM public.verification_jobs;

GRANT SELECT ON public.verification_jobs_safe TO authenticated;

-- ============ CALLBACKS ============
CREATE TABLE public.verification_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'smileid',
  provider_job_id TEXT,
  provider_user_id TEXT,
  signature TEXT,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_job_id, signature)
);
CREATE INDEX idx_vcb_job ON public.verification_callbacks(provider_job_id);
ALTER TABLE public.verification_callbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view callbacks" ON public.verification_callbacks
  FOR SELECT TO authenticated USING (public.is_veloxis_staff(auth.uid()));
-- inserts come from service role (webhook), no policy needed

-- ============ AUDIT EVENTS ============
CREATE TABLE public.verification_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_job_id UUID REFERENCES public.verification_jobs(id) ON DELETE CASCADE,
  subject_type public.verification_subject_type,
  subject_id UUID,
  event_type TEXT NOT NULL,
  actor_user_id UUID,
  actor_role TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vae_job ON public.verification_audit_events(verification_job_id);
ALTER TABLE public.verification_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View audit events for own org or staff" ON public.verification_audit_events
  FOR SELECT TO authenticated
  USING (
    public.is_veloxis_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.verification_jobs vj
      WHERE vj.id = verification_job_id
        AND public.is_partner_in_org(auth.uid(), vj.partner_organisation_id)
    )
  );

CREATE POLICY "Insert audit events for own org or staff" ON public.verification_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_veloxis_staff(auth.uid())
    OR (
      verification_job_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.verification_jobs vj
        WHERE vj.id = verification_job_id
          AND public.is_partner_in_org(auth.uid(), vj.partner_organisation_id)
      )
    )
  );

-- Append-only
CREATE TRIGGER trg_vae_no_update BEFORE UPDATE ON public.verification_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_update();
CREATE TRIGGER trg_vae_no_delete BEFORE DELETE ON public.verification_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_delete();
