import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Row = {
  id: string; invoice_number: string; invoice_amount: number; invoice_currency: string;
  status: string; maturity_date: string | null; created_at: string;
  exporter_id: string; buyer_id: string | null;
  v2_exporters?: { company_name: string } | null;
  v2_buyers?: { company_name: string } | null;
};

export default function StaffInvoices() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v2_invoices')
        .select('id, invoice_number, invoice_amount, invoice_currency, status, maturity_date, created_at, exporter_id, buyer_id, v2_exporters(company_name), v2_buyers(company_name)')
        .order('created_at', { ascending: false });
      setRows((data ?? []) as any);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return r.invoice_number.toLowerCase().includes(s)
      || r.v2_exporters?.company_name?.toLowerCase().includes(s)
      || r.v2_buyers?.company_name?.toLowerCase().includes(s);
  }), [rows, q, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl">Applications</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length}</p>
        </div>
        <Button asChild><Link to="/app/invoices/new">New application</Link></Button>
      </div>

      <div className="flex gap-3">
        <Input placeholder="Search invoice, exporter, buyer" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(INVOICE_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Invoice</th>
              <th className="text-left px-4 py-3">Exporter</th>
              <th className="text-left px-4 py-3">Buyer</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Maturity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => navigate(`/app/invoices/${r.id}`)}
                className="border-t border-border hover:bg-muted/20 cursor-pointer"
              >
                <td className="px-4 py-3 text-accent">{r.invoice_number}</td>
                <td className="px-4 py-3">{r.v2_exporters?.company_name ?? '—'}</td>
                <td className="px-4 py-3">{r.v2_buyers?.company_name ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.invoice_currency} {Number(r.invoice_amount).toLocaleString()}</td>
                <td className="px-4 py-3">{INVOICE_STATUS_LABEL[r.status] ?? r.status}</td>
                <td className="px-4 py-3">{r.maturity_date ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No applications</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
