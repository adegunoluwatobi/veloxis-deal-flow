import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';
import { Button } from '@/components/ui/button';

export default function ExporterDashboard() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [received, setReceived] = useState(0);
  const [exp, setExp] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: e } = await supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).maybeSingle();
      setExp(e);
      if (!e) return;
      const { data: iv } = await supabase.from('v2_invoices').select('id, invoice_number, status, invoice_amount, invoice_currency, advance_rate').eq('exporter_id', e.id).order('created_at', { ascending: false });
      setInvoices(iv ?? []);
      const { data: mv } = await supabase.from('v2_money_movements').select('amount, type, invoice_id').in('invoice_id', (iv ?? []).map((x) => x.id));
      const rec = (mv ?? []).filter((m) => m.type === 'advance_out' || m.type === 'residual_out').reduce((s, m) => s + Number(m.amount), 0);
      setReceived(rec);
    })();
  }, [user]);

  const returned = invoices.filter((i) => i.status === 'returned_for_revision');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl">Welcome{exp?.company_name ? `, ${exp.company_name}` : ''}</h1></div>
        <Button asChild><Link to="/portal/invoices/new">Submit invoice</Link></Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Invoices" value={String(invoices.length)} />
        <Stat label="Received to date" value={`£${received.toLocaleString()}`} />
        <Stat label="Awaiting action" value={String(returned.length)} highlight={returned.length > 0} />
      </div>

      {returned.length > 0 && (
        <section className="card-elevated p-5 border-warning/60">
          <h3 className="font-medium mb-2">Invoices returned to you</h3>
          <div className="space-y-1 text-sm">
            {returned.map((i) => <Link key={i.id} to={`/portal/invoices/${i.id}`} className="block hover:text-accent">{i.invoice_number} · {i.invoice_currency} {Number(i.invoice_amount).toLocaleString()}</Link>)}
          </div>
        </section>
      )}

      <section className="card-elevated p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Recent invoices</h3>
        <div className="space-y-1 text-sm">
          {invoices.slice(0, 8).map((i) => (
            <Link key={i.id} to={`/portal/invoices/${i.id}`} className="flex justify-between border-t border-border pt-2 hover:text-accent">
              <span>{i.invoice_number}</span>
              <span>{i.invoice_currency} {Number(i.invoice_amount).toLocaleString()}</span>
              <span className="text-muted-foreground">{INVOICE_STATUS_LABEL[i.status]}</span>
            </Link>
          ))}
          {invoices.length === 0 && <p className="text-muted-foreground">No invoices yet.</p>}
        </div>
      </section>
    </div>
  );
}
function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className="card-elevated p-4"><div className="stat-label">{label}</div><div className={`stat-value mt-1 ${highlight ? 'text-warning' : ''}`}>{value}</div></div>;
}
