
# Onboarding & KYC Compliance

## Phase 1: Database Changes

### New enums
- `sanctions_screening_status`: pending_screening, clear, flagged
- `buyer_credit_check_status`: pending, pass, refer, fail

### New columns on `exporters` table
- `source_of_funds_statement` (text) — free-text description
- `sanctions_screening_status` (enum, default: pending_screening)
- `edd_required` (boolean, default: true)
- `edd_completed` (boolean, default: false)

### New table: `ubo_declarations`
- id, exporter_id, full_name, nationality, date_of_birth, residential_address, ownership_percentage
- RLS: exporter can CRUD own, partner can view org, Veloxis can view all

### New exporter_document_type enum values
- `ubo_declaration_doc`
- `source_of_funds_doc`
- `bank_statements`

### New columns on `deals` table (Buyer KYC)
- `buyer_country_of_incorporation` (text)
- `buyer_sanctions_status` (sanctions_screening_status enum, default: pending_screening)
- `buyer_credit_check_status` (buyer_credit_check_status enum, default: pending)
- `buyer_underwriter_notes` (text)

### New deal_document_type enum values
- `buyer_registration_doc`

## Phase 2: UI Changes

### Exporter Onboarding page
- Add "Compliance & Due Diligence" section with:
  - UBO Declaration form (add/remove UBO persons)
  - Source of Funds free-text + upload
  - Bank Statements multi-file upload

### Exporter Detail pages (Partner + Veloxis)
- Show compliance docs in a dedicated section
- Veloxis-only: Sanctions/PEP status dropdown, EDD toggle

### Deal Detail page (Partner + Veloxis)
- Add "Buyer Compliance" sub-section (hidden from exporter)
- Buyer registration doc upload
- Buyer country of incorporation
- Buyer sanctions status (Veloxis only)
- Buyer credit check status (Veloxis only)
- Underwriter notes (Veloxis only)

## Phase 3: Gating Logic
- EDD flag blocks deal approval until edd_completed = true
- Sanctions "flagged" status shows warning on deal detail
