CREATE OR REPLACE FUNCTION public.retry_failed_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD; v_count integer := 0; v_msg uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_app_role(auth.uid(),'super_admin'::public.v2_app_role) THEN
    RAISE EXCEPTION 'Only a Super Admin may run notification retries' USING ERRCODE='insufficient_privilege';
  END IF;

  FOR r IN
    SELECT * FROM public.notification_deliveries
    WHERE status = 'failed' AND channel = 'email' AND attempts < 3
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
    ORDER BY created_at
    LIMIT 200
  LOOP
    IF EXISTS (SELECT 1 FROM public.suppressed_emails WHERE email = lower(r.recipient)) THEN
      UPDATE public.notification_deliveries
      SET status = 'suppressed', provider_response = 'Recipient is on the suppression list'
      WHERE id = r.id;
      CONTINUE;
    END IF;

    v_msg := gen_random_uuid();
    BEGIN
      PERFORM public.enqueue_email('transactional_emails',
        COALESCE(r.payload, '{}'::jsonb)
        || jsonb_build_object('message_id', v_msg, 'idempotency_key', v_msg::text, 'queued_at', now()));
      UPDATE public.notification_deliveries
      SET status = 'queued', attempts = attempts + 1, message_id = v_msg,
          provider_response = NULL, next_attempt_at = NULL
      WHERE id = r.id;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.notification_deliveries
      SET attempts = attempts + 1,
          provider_response = SQLERRM,
          next_attempt_at = now() + (power(3, attempts + 1) || ' minutes')::interval
      WHERE id = r.id;
    END;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.retry_failed_notifications() TO authenticated;

SELECT cron.schedule('retry-failed-notifications', '*/5 * * * *',
  $cron$ SELECT public.retry_failed_notifications(); $cron$);