
DROP POLICY IF EXISTS "Originators can update own deals" ON public.deals;

CREATE POLICY "Originators can update own deals"
ON public.deals
FOR UPDATE
TO authenticated
USING (
  originator_id = auth.uid()
  AND status = ANY (ARRAY['draft'::deal_status, 'docs_requested'::deal_status, 'submitted'::deal_status, 'changes_requested'::deal_status])
)
WITH CHECK (
  originator_id = auth.uid()
  AND status = ANY (ARRAY['draft'::deal_status, 'docs_requested'::deal_status, 'submitted'::deal_status, 'changes_requested'::deal_status])
);
