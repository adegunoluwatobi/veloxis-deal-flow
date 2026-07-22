# Veloxis Restructure Plan

Same product, same backend, same storage bucket. This is a structural cleanup + new assignment-based deal lifecycle. No data drops; only additive schema changes and code removal.

## 1. Scope confirmation

- **Keep data**: no `DROP TABLE`. Deprecated tables become unused; we stop reading/writing them from the app.
- **Keep secrets & edge functions**: only add what the new flow requires; remove nothing.
- **Keep** `veloxis-documents` bucket and files.
- **Same product**: Veloxis cross-border trade finance for African commodity exporters.

## 2. Removals (frontend + routing only)

Delete from the running app (files removed from `src/`):

- All `src/pages/greystar/*` pages and `/greystar/*` routes
- All partner-facing components: `GreystarLayout`, `PartnerKybStatusBadge`, `PartnerKyb.tsx`, `PartnerDetail.tsx`, `PartnersPage.tsx`, `AdminPartnerKybQueue.tsx`, `account/PartnerOrgProfile.tsx`, `account/PartnerTeamMembers.tsx`
- IPU UI: `IpuUploadSection.tsx`, IPU steps in `DealLifecycleBanner`, IPU columns in deal detail
- Nav links to partner/greystar sections in `DashboardLayout` and elsewhere
- `NotificationsRoleShell` branch for partner roles
- Partner routing branches in `ProtectedRoute`, `Dashboard`

Kept top-level pages: Dashboard, Exporters, Applications, Capital Pool, Pricing, Opportunities, User Management, Account.

## 3. Role changes

- Enum `app_role`: add value `admin_manager`. Leave `partner_admin` and `partner_staff` in the enum (Postgres can't drop enum values safely) but stop assigning them and stop checking them in RLS/UI.
- Update `has_role` usage sites and RLS policies that gate on partner roles → gate on `super_admin | deal_manager | admin_manager` instead.
- `is_veloxis_staff` extended to include `admin_manager`.
- New role `admin_manager` gets the same read/write access as `deal_manager` unless specified otherwise.
- Existing users with partner roles: left as-is in `user_roles`; they simply lose access because no partner routes exist.

## 4. New deal status pipeline

Replace the current status flow. New enum values added to `deal_status`:

```text
draft
 → submitted
 → under_review
 → docs_requested (loops back to under_review)
 → approved
 → deed_sent
 → deed_acknowledged
 → funded_active
 → repayment_due
 → payment_received
 → closed_repaid | closed_partial
```

- Add missing values (`deed_sent`, `deed_acknowledged`) to the `deal_status` enum.
- Rewrite `validate_status_transition` to enforce the new graph for `super_admin | deal_manager | admin_manager` and the exporter transitions (`draft → submitted`, `docs_requested → submitted`).
- Remove all IPU-related transitions (`ipu_sent`, `ipu_signed_awaiting_funding`, `ipu_expired`) from the validator; existing rows in those statuses remain valid data but cannot be transitioned into anymore. Admin can migrate them to `approved` via a one-off script if needed later.

## 5. New assignment + settlement tracking

All manual admin actions on the deal detail page (no automated buyer flows).

New columns on `public.deals` (nullable, additive):

- `deed_of_assignment_sent_at timestamptz`, `deed_of_assignment_sent_by uuid`
- `deed_of_assignment_acknowledged_at timestamptz`, `deed_of_assignment_acknowledged_by uuid`
- `notice_of_assignment_sent_at timestamptz`, `notice_of_assignment_sent_by uuid`
- `notice_of_assignment_acknowledged_at timestamptz`, `notice_of_assignment_acknowledged_by uuid`
- `buyer_direct_confirmation_at timestamptz`, `buyer_direct_confirmation_by uuid`, `buyer_direct_confirmation_notes text`
- `disbursement_recorded_at timestamptz`, `disbursement_recorded_by uuid`, `disbursement_amount numeric`, `disbursement_reference text`
- `repayment_recorded_at timestamptz`, `repayment_recorded_by uuid`, `repayment_amount numeric`, `repayment_reference text`

New `document_type` values for `deal_documents`: `deed_of_assignment`, `notice_of_assignment`, `buyer_confirmation`, `disbursement_proof`, `repayment_proof`. (IPU document type stays in the enum for historic rows; no new uploads.)

## 6. Deal detail UI (admin)

New panel `AssignmentTrackingPanel` on `DealDetail.tsx` with sequential cards, each showing status badge + timestamp + actor + "Mark …" button gated by role and prior step:

1. Deed of Assignment — Sent → Acknowledged (each with optional file upload to `deal_documents`)
2. Notice of Assignment — Sent → Acknowledged
3. Buyer direct confirmation — single action with notes
4. Disbursement — amount + reference + optional proof upload; sets status to `funded_active`
5. Repayment — amount + reference + optional proof upload; sets status to `payment_received`; admin then closes to `closed_repaid` or `closed_partial`

Each action writes an `audit_logs` row via existing `insert_audit_log` RPC.

Remove `IpuUploadSection` from the page.

## 7. Migrations (single migration, in order)

1. `ALTER TYPE app_role ADD VALUE 'admin_manager'` (idempotent guard)
2. `ALTER TYPE deal_status ADD VALUE 'deed_sent'`, `'deed_acknowledged'` (idempotent guards)
3. `ALTER TABLE public.deals ADD COLUMN …` for all new columns above
4. Extend `document_type` enum with the new values
5. Replace `validate_status_transition` with the new graph
6. Update `is_veloxis_staff` to include `admin_manager`

GRANTs unchanged (existing `deals` grants already cover new columns).

## 8. Files touched (high level)

- **Delete**: partner/greystar pages + components, IPU section, partner nav entries
- **Edit**: `src/App.tsx` (routes), `DashboardLayout`, `ProtectedRoute`, `Dashboard`, `NotificationsRoleShell`, `DealDetail`, `AdminUserDirectory` (role dropdown), `types/index.ts` (deal status labels/colors, roles)
- **Add**: `src/components/AssignmentTrackingPanel.tsx`
- **DB**: one migration as described above
- **Edge functions**: none added or removed in this pass — role/status changes are enforced in the DB and UI

## 9. Out of scope for this pass

- Migrating historical deals stuck in IPU statuses (can be handled with a follow-up data script)
- Emails/notifications for the new assignment steps (can be added after the UI ships)
- Removing partner-related tables from the database

If this looks right, approve and I'll run the migration first, then land the code changes.
