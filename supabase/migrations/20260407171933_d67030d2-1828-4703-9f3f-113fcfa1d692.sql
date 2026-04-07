
DROP POLICY "Exporters can update own profile during onboarding" ON public.exporters;

CREATE POLICY "Exporters can update own profile during onboarding"
ON public.exporters
FOR UPDATE
TO authenticated
USING (
  (exporter_user_id = auth.uid()) AND 
  (onboarding_status = ANY (ARRAY['invited'::onboarding_status, 'password_set'::onboarding_status, 'onboarding_in_progress'::onboarding_status, 'onboarding_rejected'::onboarding_status]))
)
WITH CHECK (
  (exporter_user_id = auth.uid()) AND 
  (onboarding_status = ANY (ARRAY['password_set'::onboarding_status, 'onboarding_in_progress'::onboarding_status, 'onboarding_submitted'::onboarding_status, 'onboarding_rejected'::onboarding_status]))
);
