-- Add new audit action enum values for deal workflow
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_changes_requested';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_resubmitted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_sent_to_veloxis';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_rejected_by_partner';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_rejected_by_veloxis';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_funded';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_overdue';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_closed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_field_edited';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_document_requested';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deal_document_uploaded';

-- Allow exporters to view audit logs for their own deals
CREATE POLICY "Exporters can view audit logs for own deals"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  deal_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.exporters e ON e.id = d.exporter_id
    WHERE d.id = audit_logs.deal_id
      AND e.exporter_user_id = auth.uid()
  )
);

-- Partners can view audit logs for deals in their org
CREATE POLICY "Partners can view deal audit logs for org deals"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  deal_id IS NOT NULL AND is_partner(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.exporters e ON e.id = d.exporter_id
    WHERE d.id = audit_logs.deal_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);