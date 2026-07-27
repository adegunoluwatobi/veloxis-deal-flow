import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';
import { Button } from '@/components/ui/button';

export default function ExporterInvoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: e } = await supabase.from('v2_exporters').select('id').eq('owner_user_id', user!.id).maybeSingle();
      if (!e) return;
      const { data } = await supabase.from('v2_invoices').select('id, invoice_number, invoice_amount, invoice_currency, status, maturity_date, created_at, v2_buyers(company_name)').eq('exporter_id', e.id).order('created_at', { ascending: false });
      setRows((data ?? []) as any);
    })();
  }, [user]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl">My invoices</h1><p className="text-sm text-muted-foreground">{rows.length} total</p></div>
        <Button asChild><Link to="/portal/invoices/new">Submit new</Link></Button>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-4 py-3">Invoice</th><th className="text-left px-4 py-3">Buyer</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Maturity</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3"><Link to={`/portal/invoices/${r.id}`} className="text-accent hover:underline">{r.invoice_number}</Link></td>
                <td className="px-4 py-3">{r.v2_buyers?.company_name ?? '—'}</td>
                <td className="px-4 py-3 text-right">{r.invoice_currency} {Number(r.invoice_amount).toLocaleString()}</td>
                <td className="px-4 py-3">{INVOICE_STATUS_LABEL[r.status]}</td>
                <td className="px-4 py-3">{r.maturity_date ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No invoices — <Link to="/portal/invoices/new" className="text-accent">submit your first</Link></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
