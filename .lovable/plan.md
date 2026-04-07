## Deal Submission Flow — Implementation Plan

This is a large feature spanning database changes, three portals, and workflow logic. I'll implement it in phases.

### Phase 0 — Database Schema Changes
1. **Add new deal statuses** to the `deal_status` enum: `changes_requested`, `sent_to_veloxis`, `rejected_by_partner`, `rejected_by_veloxis`
2. **Add new columns to `deals` table**: `deal_reference`, `buyer_contact_phone`, `export_destination`, `export_licence_number`, `hs_code`, `incoterms`, `export_licence_document_id`, `bank_name`, `bank_account_name`, `bank_account_number`, `bank_sort_code_iban`, `bank_country`, `bank_name_match`, `buyer_name_match`, `licence_name_match`, `submitted_at`, `sent_to_veloxis_at`, `approved_at`, `funded_at`, `rejected_at`, `partner_notes`, `payment_due_date`, `invoice_file_url`, `advance_currency`, `fx_rate`, `repayment_due_date`, `repayment_amount`, `partner_organisation_id`
3. **Create `exporter_bank_accounts` table**: `id`, `exporter_id`, `bank_name`, `account_name`, `account_number`, `sort_code_iban`, `bank_country`, `is_default`, `created_at`
4. **Auto-generate deal reference** via trigger: `VLX-YYYY-NNNN`
5. **Update RLS policies** for exporter access to deals

### Phase 1 — Exporter Portal: Submit a Deal
1. Add "Deals" nav item to exporter sidebar
2. Create **Exporter Deals List** page (`/exporter/deals`)
3. Create **Exporter Deal Submission** form (`/exporter/deals/new`) — 5-step wizard:
   - Step 1: Bank Account Details (with name match warning)
   - Step 2: Invoice Details (with file upload)
   - Step 3: Buyer Details
   - Step 4: Export Details (with verified export licence reference)
   - Step 5: Review & Submit (name match summary, save draft or submit)
4. Create **Exporter Deal Detail** page (`/exporter/deals/:id`) — read-only view with status

### Phase 2 — Partner Admin Portal: Deal Review
1. Add "Deals" nav item to Greystar sidebar
2. Create **Partner Deals List** page (`/greystar/deals`) with filter tabs
3. Create **Partner Deal Detail** page (`/greystar/deals/:id`) with:
   - Full deal data view
   - Name matching summary
   - Actions: Request Changes, Request Documents, Reject, Submit to Veloxis

### Phase 3 — Veloxis Deal Room
1. Update existing **DealDetail** page to show new fields (bank details, export details, name matches)
2. Add actions: Approve, Reject, Request Documents, Mark as Funded
3. Update deals list to show new statuses

### Update types and status maps
- Add new statuses to `DealStatus`, `DEAL_STATUS_LABELS`, `DEAL_STATUS_COLORS`
- Add `InvoiceCurrency` to include `NGN`

### Notifications
- Deferred to a follow-up — will use toast notifications for now, email notifications can be added later with the email infrastructure
