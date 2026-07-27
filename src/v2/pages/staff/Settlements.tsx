import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Row = {
  id: string; invoice_number: string; invoice_amount: number; invoice_currency: string;
  status: string; maturity_date: string | null; settled_date: string | null;
};

export default function Settlements() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v2_invoices')
        .select('id,invoice_number,invoice_amount,invoice_currency,status,maturity_date,settled_date')
        .in('status', ['funded', 'monitoring', 'settled'])
        .order('maturity_date', { ascending: true });
      setRows((data as any) ?? []);
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const due = rows.filter(r => r.status !== 'settled' && r.maturity_date && r.maturity_date >= today);
  const overdue = rows.filter(r => r.status !== 'settled' && r.maturity_date && r.maturity_date < today);
  const collected = rows.filter(r => r.status === 'settled');

  const fmt = (n: number, c: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: c }).format(n);
  const sum = (arr: Row[]) => arr.reduce((s, r) => s + Number(r.invoice_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settlements</h1>
        <p className="text-sm text-muted-foreground">Due, overdue and collected invoices with maturity tracking.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Due</div>
          <div className="text-2xl font-semibold mt-1">{due.length}</div>
          <div className="text-xs text-muted-foreground">{fmt(sum(due), 'GBP')} face value</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Overdue</div>
          <div className="text-2xl font-semibold mt-1 text-destructive">{overdue.length}</div>
          <div className="text-xs text-muted-foreground">{fmt(sum(overdue), 'GBP')} face value</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Collected</div>
          <div className="text-2xl font-semibold mt-1 text-accent">{collected.length}</div>
          <div className="text-xs text-muted-foreground">{fmt(sum(collected), 'GBP')} face value</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Invoice</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Maturity</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No settlement activity yet.</td></tr>
            )}
            {rows.map(r => {
              const isOverdue = r.status !== 'settled' && r.maturity_date && r.maturity_date < today;
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3"><Link to={`/app/invoices/${r.id}`} className="hover:text-accent">{r.invoice_number}</Link></td>
                  <td className="p-3">{fmt(Number(r.invoice_amount), r.invoice_currency)}</td>
                  <td className="p-3">{r.maturity_date ?? '—'}</td>
                  <td className="p-3"><Badge variant={isOverdue ? 'destructive' : 'secondary'}>{isOverdue ? 'overdue' : r.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
