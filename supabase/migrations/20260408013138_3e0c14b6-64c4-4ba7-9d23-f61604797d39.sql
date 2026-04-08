CREATE POLICY "Exporter can confirm receipt of funds"
ON public.deals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = deals.exporter_id AND e.exporter_user_id = auth.uid()
  )
  AND status = 'payment_received'
)
WITH CHECK (
  status = 'closed_repaid'
);