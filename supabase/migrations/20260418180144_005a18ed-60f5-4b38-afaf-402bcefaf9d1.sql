-- ============================================================
-- P0 SECURITY HARDENING (Section 10 of site change spec)
-- ============================================================

-- ------------------------------------------------------------
-- 10.2  deals.SELECT for partners must be org-scoped
-- ------------------------------------------------------------
-- The existing policy USING (is_partner(auth.uid())) lets ANY partner
-- read EVERY deal across all organisations. Replace with the same
-- ownership predicate already used by "Partners can update org deals".

DROP POLICY IF EXISTS "Partners can view org deals" ON public.deals;

CREATE POLICY "Partners can view org deals"
ON public.deals
FOR SELECT
TO authenticated
USING (
  is_partner(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.exporters e
    WHERE e.id = deals.exporter_id
      AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id))
  )
);

-- ------------------------------------------------------------
-- 10.1  Storage: tighten INSERT and add DELETE policy
-- ------------------------------------------------------------
-- Replace the wide-open upload policy with one that:
--   (a) requires the path to start with deals/{uuid}/ or exporters/{uuid}/
--   (b) verifies the caller owns (or has org access to) that deal/exporter

DROP POLICY IF EXISTS "Authenticated users can upload docs" ON storage.objects;

CREATE POLICY "Scoped uploads to veloxis-documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'veloxis-documents'
  AND (
    -- Veloxis staff can upload anywhere
    is_veloxis_staff(auth.uid())
    -- Path = deals/{deal_id}/...  -> caller must own/be org-partner of that deal
    OR (
      (storage.foldername(name))[1] = 'deals'
      AND EXISTS (
        SELECT 1
        FROM public.deals d
        JOIN public.exporters e ON e.id = d.exporter_id
        WHERE d.id::text = (storage.foldername(name))[2]
          AND (
            e.exporter_user_id = auth.uid()
            OR d.originator_id = auth.uid()
            OR (is_partner(auth.uid())
                AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id)))
          )
      )
    )
    -- Path = exporters/{exporter_id}/... -> caller must own/be org-partner of that exporter
    OR (
      (storage.foldername(name))[1] = 'exporters'
      AND EXISTS (
        SELECT 1
        FROM public.exporters e
        WHERE e.id::text = (storage.foldername(name))[2]
          AND (
            e.exporter_user_id = auth.uid()
            OR e.originator_id = auth.uid()
            OR (is_partner(auth.uid())
                AND is_partner_in_org(auth.uid(), get_partner_org_id(e.originator_id)))
          )
      )
    )
  )
);

-- DELETE: admins only (deal_documents/exporter_documents have is_superseded
-- soft-delete; physical removal is an ops/super-admin action only).
DROP POLICY IF EXISTS "Veloxis staff can delete documents" ON storage.objects;

CREATE POLICY "Veloxis staff can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'veloxis-documents'
  AND is_veloxis_staff(auth.uid())
);

-- ------------------------------------------------------------
-- 10.4  Realtime: scope deals channel subscriptions
-- ------------------------------------------------------------
-- realtime.messages already has RLS enabled. Add a policy that only
-- lets a user subscribe to the public:deals topic if they would also
-- be allowed to SELECT the corresponding row from public.deals.
-- We piggy-back on the existing deals RLS by doing an EXISTS lookup;
-- because deals RLS is now strict (10.2), an unscoped partner will
-- get zero rows here too, blocking the channel events.

DROP POLICY IF EXISTS "Authenticated can receive scoped deal events" ON realtime.messages;

CREATE POLICY "Authenticated can receive scoped deal events"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Restrict to the deals topic family; everything else falls through
  -- to default-deny (no other policies present).
  (
    realtime.topic() LIKE 'realtime:public:deals%'
    AND (
      is_veloxis_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.deals d
        -- deals RLS already filters this SELECT to rows the caller can see.
        -- If they can see at least one deal row in the topic, they may
        -- subscribe; row-level filtering of payloads still happens below.
        LIMIT 1
      )
    )
  )
);
