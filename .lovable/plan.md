## Veloxis Deal Room — Build Plan (React + Vite + Lovable Cloud)

### Architecture Adaptation
- **No Next.js**: All pages are React client components with react-router-dom
- **No Server Actions**: Mutations go through Supabase client SDK (with RLS) or Edge Functions (for service-role operations like audit logging, token validation)
- **No API routes**: Replaced by Edge Functions (e.g., upload handler, HelloSign webhook)

### Step 1: Database Schema (enums, tables, RLS, functions, triggers)
Deploy the full schema via migrations:
- All enums (user_role, entity_type, commodity_type, deal_status, etc.)
- All tables (users, exporters, deals, deal_documents, exporter_documents, ipus, audit_logs, internal_notes, system_config, exporter_upload_tokens)
- RLS policies per your spec
- DB functions (insert_audit_log, calculate_deal_pricing, validate_status_transition, etc.)
- Triggers (audit log immutability, auto-supersede docs, user sync)
- Seed system_config defaults

### Step 2: Design System + Auth + Layout
- Professional finance-themed design system (navy/slate/gold accents)
- Login page (email/password)
- Auth context with role-based routing
- Dashboard shell with sidebar navigation
- Role-based route guards (originator vs deal_manager)

### Step 3: Originator Workflow
- Originator dashboard (my deals, my exporters)
- Create exporter form
- Generate upload token + shareable link
- SME upload page (/upload/:token) — public, no auth
- Edge Function for token-validated uploads
- 4-step deal submission wizard with live pricing preview
- Deal list with status filters

### Step 4: Deal Manager Workflow (Phase 3 from spec)
- Admin dashboard with all deals table
- Deal detail page (exporter, buyer, docs, pricing, audit, notes)
- Approval/rejection flows
- Document request flow
- Internal notes
- Advance % override + pricing recalculation

### Step 5: IPU, Funding, Capital (Phases 4-5)
- IPU generation + HelloSign integration (Edge Function + webhook)
- Funding recording form
- Repayment recording
- Capital dashboard
- Settings screen

### Step 6: Polish (Phase 6)
- Document expiry system
- Email notifications
- Audit log export
- Exporter profile detail page

---

**Shall I start with Step 1 (database schema migration)?** This is the foundation everything depends on.