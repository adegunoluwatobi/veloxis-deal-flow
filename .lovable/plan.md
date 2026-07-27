
# Veloxis Rebuild — Invoice Finance Management

Rebuild the app around a clean invoice-finance data model with **hard RLS isolation** between exporters, five roles, and a strict invoice lifecycle. Keep the Supabase project, the `veloxis-documents` bucket, and existing edge functions. Old tables stay in place but are no longer used by the new UI.

## Scope

**In:** Auth-only app, staff side + sandboxed exporter side, RLS-enforced isolation, invoice lifecycle with role gates, 5-point funding checklist, buyer verification reuse, mandatory rejection/return reasons, staff metrics dashboard, audit log, user management.

**Out (v1):** Payments, external APIs (Ship24, Creditsafe, Companies House), public marketing pages, IPU/Partner/Greystar flows (already removed), old deal detail UI.

## Roles

`exporter`, `originator`, `credit_officer`, `approver`, `super_admin`. Staff users may hold multiple staff roles; exporter users hold only `exporter`. Segregation of duties: creator/submitter cannot approve without an explicit override recorded in audit log.

## Data model (new tables, `public` schema)

- `profiles` — user_id (pk, fk auth.users), name, email, phone, active, joined_at, last_login
- `app_user_roles` — user_id, role (enum), unique(user_id, role) — separate from existing `user_roles` to avoid enum churn
- `v2_exporters` — id, owner_user_id, company_name, rc_number, contact_name, phone, email, commodity, nepc_status, address, bank_details (jsonb), onboarding_status (pending/active/suspended), created_by, created_at
- `v2_buyers` — id, company_name, country, companies_house_id, credit_status, sanctions_status, credit_limit, verified_by, verified_at, created_at
- `v2_invoices` — id, invoice_number, exporter_id, buyer_id, commodity, invoice_currency, invoice_amount, terms_days, advance_rate, fee_percent, status, created_by, verified_by, approved_by, shipment_date, maturity_date, funded_date, settled_date, created_at
- `v2_invoice_documents` — id, invoice_id, doc_type, file_url, verified, verified_by, uploaded_by, uploaded_at
- `v2_money_movements` — id, invoice_id, type, amount, currency, recorded_by, recorded_at
- `v2_decisions` — id, invoice_id, decision_type, reason, actor_user_id, created_at
- `v2_audit_log` — id, invoice_id, actor_user_id, action, from_status, to_status, note, created_at
- `v2_settings` — singleton (capital_base, currency)

Prefixed `v2_` so existing tables and their data stay untouched. Once verified, we can drop the legacy tables in a later migration.

## RLS (hard requirement)

- Exporter can SELECT/INSERT/UPDATE only rows tied to their own `v2_exporters.id` (via `owner_user_id = auth.uid()`). Blocked on all other tables except their own profile and their own invoices/documents/decisions (read-only for decisions).
- Exporter UPDATE on invoice allowed only when status ∈ {draft, returned_for_revision}.
- Staff policies via `has_app_role(uid, role)` security-definer function.
- Super admin unrestricted.
- Test with a second exporter account to confirm isolation.

## Invoice lifecycle

`draft → submitted → verified → approved → funded → monitoring → settled`, side-states `returned_for_revision`, `rejected`, `defaulted`. Each transition role-gated in a DB function `v2_transition_invoice(invoice_id, new_status, reason?)` that also writes `v2_audit_log` and `v2_decisions` when needed.

## Five-point funding gate

`Approve for Funding` disabled until:
1. Deed of Assignment verified
2. Tripartite Domiciliation verified
3. Notice of Assignment verified
4. Buyer credit=clear AND sanctions=clear
5. Bill of Lading verified

Live checklist on staff invoice view lists what's missing.

## Fee auto-calc

`terms_days` 30→3.5%, 45→4.5%, 60→5.5%. Advance default 80%. Computed columns on invoice detail (staff only): advance, fee, residual, maturity, days-to-maturity. Exporter sees only invoice_amount, status, advance amount, residual amount.

## Screens

**Staff:**
- `/app` Metrics Dashboard (portfolio, credit, velocity, pipeline, financial, relationships, "needs my action")
- `/app/invoices` list + `/app/invoices/:id` detail
- `/app/invoices/new` (Originator/Super Admin)
- `/app/exporters` list + detail
- `/app/buyers` list + detail (verify — Credit only)
- `/app/users` (Super Admin)
- `/app/audit`
- `/app/settings` (Super Admin)

**Exporter (sandboxed, visually distinct):**
- `/portal` My Dashboard
- `/portal/invoices` + `/portal/invoices/new` + `/portal/invoices/:id`
- `/portal/documents`
- `/portal/profile`

## Design tokens

Update `src/index.css` and `tailwind.config.ts` to the new palette: bg `#0A1E1C`, primary `#15946F`, accent `#3DE8B8`, foreground `#F8FAF9`. Bold sans-serif headings. Two distinct layouts: `StaffLayout` (dense admin) and `ExporterPortalLayout` (calmer, customer-facing).

## What gets removed from UI

- Old `DealDetail`, `AssignmentTrackingPanel`, `DealsList`, `ExportersList`, `ExporterNew`, `ExporterDetail`, `AdminDashboard`, capital pool page (replaced), opportunities/marketing/verification screens stay only if still on nav — cut from nav for the rebuild.
- `App.tsx` route table rebuilt around `/app/*` and `/portal/*`. Old `/admin/*`, `/exporter/*`, `/greystar/*` routes redirect to the new equivalents.
- Website / marketing pages stay as-is (public unauth entry lands on `/login`).

## Migration approach

1. Migration 1: enums, new `v2_*` tables, GRANTs, RLS, `has_app_role`, `v2_transition_invoice`, seed `v2_settings`.
2. After types regen, build the new UI (layouts, pages, hooks).
3. Manually create test users for each role, verify RLS with a second exporter.

## Out of this plan

- Data migration from legacy `deals`/`exporters` into `v2_*` — not requested; legacy remains dormant.
- Deleting old tables/edge functions — deferred until the new build is validated.

Reply **approve** to proceed, or tell me what to change (e.g. reuse existing `exporters`/`deals` tables instead of `v2_*`, kill legacy tables immediately, keep marketing pages linked from staff nav, etc.).
