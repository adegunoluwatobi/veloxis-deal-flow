import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';
import { Link } from 'react-router-dom';

interface Metrics {
  capitalBase: number;
  deployed: number;
  liveCount: number;
  fundedCount: number;
  submittedCount: number;
  verifiedCount: number;
  approvedCount: number;
  settledCount: number;
  rejectedCount: number;
  feesEarned: number;
  feesPending: number;
  avgInvoice: number;
  totalInvoices: number;
  maturing7: number;
  maturing30: number;
  largestBuyerPct: number;
  largestExporterPct: number;
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="card-elevated p-4">
      <div className="stat-label">{label}</div>
      <div className={`stat-value mt-1 ${warn ? 'text-destructive' : ''}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function StaffDashboard() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: settings }, { data: invoices }] = await Promise.all([
        supabase.from('v2_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('v2_invoices').select('id, exporter_id, buyer_id, invoice_amount, advance_rate, fee_percent, terms_days, status, maturity_date, settled_date, funded_date'),
      ]);

      const list = invoices ?? [];
      const live = list.filter((i) => ['funded', 'monitoring'].includes(i.status));
      const deployed = live.reduce((s, i) => s + Number(i.invoice_amount) * Number(i.advance_rate) / 100, 0);
      const feesEarned = list.filter((i) => i.status === 'settled').reduce((s, i) => s + Number(i.invoice_amount) * Number(i.fee_percent) / 100, 0);
      const feesPending = live.reduce((s, i) => s + Number(i.invoice_amount) * Number(i.fee_percent) / 100, 0);

      const buyerTotals = new Map<string, number>();
      const expTotals = new Map<string, number>();
      live.forEach((i) => {
        if (i.buyer_id) buyerTotals.set(i.buyer_id, (buyerTotals.get(i.buyer_id) ?? 0) + Number(i.invoice_amount));
        expTotals.set(i.exporter_id, (expTotals.get(i.exporter_id) ?? 0) + Number(i.invoice_amount));
      });
      const total = live.reduce((s, i) => s + Number(i.invoice_amount), 0) || 1;
      const lbp = Math.max(0, ...Array.from(buyerTotals.values())) / total * 100;
      const lep = Math.max(0, ...Array.from(expTotals.values())) / total * 100;

      const now = Date.now();
      const day = 86400000;
      const maturing7 = live.filter((i) => i.maturity_date && new Date(i.maturity_date).getTime() - now < 7 * day && new Date(i.maturity_date).getTime() >= now).length;
      const maturing30 = live.filter((i) => i.maturity_date && new Date(i.maturity_date).getTime() - now < 30 * day && new Date(i.maturity_date).getTime() >= now).length;

      const byStatus = (s: string) => list.filter((i) => i.status === s).length;

      setM({
        capitalBase: Number(settings?.capital_base ?? 100000),
        deployed,
        liveCount: live.length,
        fundedCount: byStatus('funded'),
        submittedCount: byStatus('submitted'),
        verifiedCount: byStatus('verified'),
        approvedCount: byStatus('approved'),
        settledCount: byStatus('settled'),
        rejectedCount: byStatus('rejected'),
        feesEarned,
        feesPending,
        avgInvoice: list.length ? list.reduce((s, i) => s + Number(i.invoice_amount), 0) / list.length : 0,
        totalInvoices: list.length,
        maturing7,
        maturing30,
        largestBuyerPct: lbp,
        largestExporterPct: lep,
      });
    })();
  }, []);

  if (!m) return <div className="text-muted-foreground">Loading…</div>;
  const available = m.capitalBase - m.deployed;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Live metrics across your book</p>
      </div>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Capital</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Capital base" value={fmt(m.capitalBase)} />
          <Stat label="Deployed" value={fmt(m.deployed)} />
          <Stat label="Available" value={fmt(available)} warn={available < 0} />
          <Stat label="Live invoices" value={String(m.liveCount)} />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Pipeline</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat label="Submitted" value={String(m.submittedCount)} />
          <Stat label="Verified" value={String(m.verifiedCount)} />
          <Stat label="Approved" value={String(m.approvedCount)} />
          <Stat label="Settled" value={String(m.settledCount)} />
          <Stat label="Rejected" value={String(m.rejectedCount)} />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Financial</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Fees earned" value={fmt(m.feesEarned)} />
          <Stat label="Fees pending" value={fmt(m.feesPending)} />
          <Stat label="Avg invoice" value={fmt(m.avgInvoice)} />
          <Stat label="Total invoices" value={String(m.totalInvoices)} />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Concentration & maturity</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Largest buyer %" value={`${m.largestBuyerPct.toFixed(1)}%`} warn={m.largestBuyerPct > 25} hint="Red > 25%" />
          <Stat label="Largest exporter %" value={`${m.largestExporterPct.toFixed(1)}%`} warn={m.largestExporterPct > 25} hint="Red > 25%" />
          <Stat label="Maturing in 7 days" value={String(m.maturing7)} />
          <Stat label="Maturing in 30 days" value={String(m.maturing30)} />
        </div>
      </section>

      <div className="text-xs text-muted-foreground">
        <Link to="/app/invoices" className="text-accent hover:underline">Open the invoice queue →</Link>
      </div>
    </div>
  );
}

export { INVOICE_STATUS_LABEL };
