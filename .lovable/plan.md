## Plan

### 1. Multi-currency display on admin dashboard
- Show deployed amounts by currency (GBP/USD/EUR) on the admin dashboard overview cards
- Already have FX rates from the exchange-rates edge function

### 2. Exporter & Partner deal pricing visibility
- Ensure both exporter and partner deal detail pages show the locked-in pricing (advance amount, platform fee, discount fee, net advance) in read-only format

### 3. Post-approval transactional email notifications (7 email templates)
This requires setting up Lovable's email infrastructure first, then creating templates for each lifecycle event:

- **deal-approved** — sent to exporter + partner on approval
- **ipu-signed** — sent to exporter when buyer signs IPU
- **deal-funded** — sent to exporter + partner when deal marked funded
- **deal-overdue** — sent to exporter + partner when deal goes overdue
- **payment-received** — sent to exporter + partner when payment advice uploaded
- **deal-closed** — sent to exporter + partner when exporter confirms receipt

### 4. Portal status displays
- Exporter deal detail: status-appropriate banners (Approved → Awaiting IPU, IPU Signed, Funded with countdown, Overdue with penalty, Payment Received with settlement summary)
- Partner deal detail: matching read-only status displays

### 5. Wire up email triggers
- Add `supabase.functions.invoke('send-transactional-email', ...)` calls at each status transition point in the deal detail pages

### Order of execution
1. Check email domain status → setup infrastructure → scaffold templates
2. Create all email templates
3. Update dashboard with multi-currency
4. Update exporter/partner deal pages with pricing + status banners
5. Wire up email triggers at status transition points
