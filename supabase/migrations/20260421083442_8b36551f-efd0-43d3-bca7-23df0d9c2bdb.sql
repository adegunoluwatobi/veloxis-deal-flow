-- Lock registered address fields once saved.
-- Only super_admin can edit registered_address_* fields after they have been populated.
-- Exporters and partner staff must submit a kyc_profile_change_request to update them.
CREATE OR REPLACE FUNCTION public.lock_registered_address_after_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_was_set boolean;
  v_changed boolean;
BEGIN
  -- If no auth context (service role / migrations), allow
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Super admins bypass the lock
  IF public.is_platform_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  v_was_set := OLD.registered_address_line1 IS NOT NULL
            AND length(trim(OLD.registered_address_line1)) > 0;

  v_changed := COALESCE(NEW.registered_address_line1, '') IS DISTINCT FROM COALESCE(OLD.registered_address_line1, '')
            OR COALESCE(NEW.registered_address_line2, '') IS DISTINCT FROM COALESCE(OLD.registered_address_line2, '')
            OR COALESCE(NEW.registered_city, '')          IS DISTINCT FROM COALESCE(OLD.registered_city, '')
            OR COALESCE(NEW.registered_postcode, '')      IS DISTINCT FROM COALESCE(OLD.registered_postcode, '')
            OR COALESCE(NEW.registered_country, '')       IS DISTINCT FROM COALESCE(OLD.registered_country, '');

  IF v_was_set AND v_changed THEN
    RAISE EXCEPTION 'Registered address is locked. Submit a profile change request to update it.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_registered_address ON public.exporters;
CREATE TRIGGER trg_lock_registered_address
  BEFORE UPDATE ON public.exporters
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_registered_address_after_save();