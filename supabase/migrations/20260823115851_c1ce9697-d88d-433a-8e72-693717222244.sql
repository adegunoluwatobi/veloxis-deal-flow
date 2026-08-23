CREATE OR REPLACE FUNCTION public.v2_notify_stage1_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_owner uuid; v_ref text; v_uid uuid;
BEGIN
  IF NEW.stage2_unlocked_at IS NULL OR OLD.stage2_unlocked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_user_id INTO v_owner FROM public.v2_exporters WHERE id = NEW.exporter_id;
  v_ref := COALESCE(NEW.reference, 'your application');

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_owner, 'Stage 1 approved',
            'Stage 1 documents for ' || v_ref || ' have been approved. You can now upload your Stage 2 documents.',
            'success', '/portal/invoices/' || NEW.id);
  END IF;

  FOR v_uid IN
    SELECT user_id FROM public.app_user_roles WHERE role IN ('originator')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_uid, 'Stage 1 approved',
            'Stage 1 documents for ' || v_ref || ' have been approved and Stage 2 is now open to the exporter.',
            'info', '/app/invoices/' || NEW.id);
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_v2_notify_stage1_approved ON public.v2_invoices;
CREATE TRIGGER trg_v2_notify_stage1_approved
AFTER UPDATE OF stage2_unlocked_at ON public.v2_invoices
FOR EACH ROW EXECUTE FUNCTION public.v2_notify_stage1_approved();