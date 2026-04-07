CREATE POLICY "Exporters can delete own draft deals"
ON public.deals
FOR DELETE
TO authenticated
USING (
  status = 'draft'
  AND EXISTS (
    SELECT 1 FROM exporters e
    WHERE e.id = deals.exporter_id
    AND e.exporter_user_id = auth.uid()
  )
);