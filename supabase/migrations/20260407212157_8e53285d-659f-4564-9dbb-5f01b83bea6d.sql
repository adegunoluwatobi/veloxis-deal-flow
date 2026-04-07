
-- Drop the existing exporter update policy
DROP POLICY IF EXISTS "Exporters can update own draft deals" ON public.deals;

-- Recreate with a proper WITH CHECK that allows setting status to 'draft' or 'submitted'
CREATE POLICY "Exporters can update own draft deals"
ON public.deals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = deals.exporter_id AND e.exporter_user_id = auth.uid()
  )
  AND status IN ('draft', 'changes_requested')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = deals.exporter_id AND e.exporter_user_id = auth.uid()
  )
  AND status IN ('draft', 'submitted')
);
