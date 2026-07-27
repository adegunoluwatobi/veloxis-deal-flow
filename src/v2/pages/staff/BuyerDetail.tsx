import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/v2/useAuth';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';
import { toast } from '@/hooks/use-toast';

export default function StaffBuyerDetail() {
  const { id } = useParams<{ id: string }>();
  const [b, setB] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [limit, setLimit] = useState('');
  const { roles, user } = useAuth();
  const canVerify = roles.includes('credit_officer') || roles.includes('super_admin');

  const load = async () => {
    const [{ data: buyer }, { data: iv }] = await Promise.all([
      supabase.from('v2_buyers').select('*').eq('id', id!).maybeSingle(),
      supabase.from('v2_invoices').select('id, invoice_number, invoice_amount, invoice_currency, status, v2_exporters(company_name)').eq('buyer_id', id!),
    ]);
    setB(buyer); setInvoices((iv ?? []) as any); setLimit(String(buyer?.credit_limit ?? ''));
  };
  useEffect(() => { load(); }, [id]);

  if (!b) return <div className="text-muted-foreground">Loading…</div>;

  const set = async (patch: any) => {
    await supabase.from('v2_buyers').update({ ...patch, verified_by: user?.id, verified_at: new Date().toISOString() }).eq('id', id!);
    load(); toast({ title: 'Updated' });
  };

  const exposure = invoices.reduce((s, i) => s + Number(i.invoice_amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">{b.company_name}</h1>
        <p className="text-sm text-muted-foreground">{b.country ?? '—'} · CH {b.companies_house_id ?? '—'}</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <section className="card-elevated p-5 space-y-3">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Verification</h3>
          <div className="flex justify-between items-center"><span>Credit</span>
            {canVerify ? (
              <div className="space-x-1">
                <Button size="sm" variant={b.credit_status === 'clear' ? 'default' : 'outline'} onClick={() => set({ credit_status: 'clear' })}>Clear</Button>
                <Button size="sm" variant={b.credit_status === 'flagged' ? 'destructive' : 'outline'} onClick={() => set({ credit_status: 'flagged' })}>Flag</Button>
              </div>
            ) : <span>{b.credit_status}</span>}
          </div>
          <div className="flex justify-between items-center"><span>Sanctions</span>
            {canVerify ? (
              <div className="space-x-1">
                <Button size="sm" variant={b.sanctions_status === 'clear' ? 'default' : 'outline'} onClick={() => set({ sanctions_status: 'clear' })}>Clear</Button>
                <Button size="sm" variant={b.sanctions_status === 'flagged' ? 'destructive' : 'outline'} onClick={() => set({ sanctions_status: 'flagged' })}>Flag</Button>
              </div>
            ) : <span>{b.sanctions_status}</span>}
          </div>
          <div className="pt-2 border-t border-border">
            <Label className="text-xs">Credit limit (£)</Label>
            <div className="flex gap-2 mt-1">
              <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} disabled={!canVerify} />
              {canVerify && <Button onClick={() => set({ credit_limit: Number(limit) || null })}>Save</Button>}
            </div>
          </div>
          <div className="text-xs text-muted-foreground pt-2">Verified: {b.verified_at ? new Date(b.verified_at).toLocaleDateString() : '—'}</div>
        </section>
        <section className="card-elevated p-5">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Exposure</h3>
          <div className="text-2xl font-semibold">£{exposure.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mb-3">across {invoices.length} invoices</div>
          <div className="space-y-1 text-sm">
            {invoices.map((i) => (
              <Link key={i.id} to={`/app/invoices/${i.id}`} className="flex justify-between hover:text-accent border-t border-border pt-1">
                <span>{i.invoice_number}</span>
                <span className="text-muted-foreground">{i.v2_exporters?.company_name}</span>
                <span>{i.invoice_currency} {Number(i.invoice_amount).toLocaleString()}</span>
                <span className="text-muted-foreground">{INVOICE_STATUS_LABEL[i.status]}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
