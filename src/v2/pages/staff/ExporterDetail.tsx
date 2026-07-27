import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';

export default function StaffExporterDetail() {
  const { id } = useParams<{ id: string }>();
  const [exp, setExp] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: iv }] = await Promise.all([
        supabase.from('v2_exporters').select('*').eq('id', id!).maybeSingle(),
        supabase.from('v2_invoices').select('id, invoice_number, invoice_amount, invoice_currency, status, maturity_date').eq('exporter_id', id!).order('created_at', { ascending: false }),
      ]);
      setExp(e); setInvoices(iv ?? []);
    })();
  }, [id]);
  if (!exp) return <div className="text-muted-foreground">Loading…</div>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">{exp.company_name}</h1>
        <p className="text-sm text-muted-foreground">RC {exp.rc_number ?? '—'} · {exp.commodity ?? '—'} · Status: {exp.onboarding_status}</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <section className="card-elevated p-5 space-y-2 text-sm">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Details</h3>
          <Row label="Contact">{exp.contact_name ?? '—'}</Row>
          <Row label="Email">{exp.email ?? '—'}</Row>
          <Row label="Phone">{exp.phone ?? '—'}</Row>
          <Row label="Address">{exp.address ?? '—'}</Row>
          <Row label="NEPC">{exp.nepc_status}</Row>
        </section>
        <section className="card-elevated p-5">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Invoices ({invoices.length})</h3>
          <div className="space-y-2 text-sm">
            {invoices.map((i) => (
              <Link key={i.id} to={`/app/invoices/${i.id}`} className="flex justify-between border-t border-border pt-2 hover:text-accent">
                <span>{i.invoice_number}</span>
                <span>{i.invoice_currency} {Number(i.invoice_amount).toLocaleString()}</span>
                <span className="text-muted-foreground">{INVOICE_STATUS_LABEL[i.status]}</span>
              </Link>
            ))}
            {invoices.length === 0 && <p className="text-muted-foreground">No invoices</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{children}</span></div>;
}
