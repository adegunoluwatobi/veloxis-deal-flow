import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { logAudit } from '@/v2/audit';

export default function ExporterInvoiceNew() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [exp, setExp] = useState<any>(null);
  const [myBuyers, setMyBuyers] = useState<{ id: string; company_name: string }[]>([]);
  const [addingBuyer, setAddingBuyer] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ company_name: '', country: '' });
  const [f, setF] = useState({ invoice_number: '', buyer_id: '', commodity: '', invoice_currency: 'GBP', invoice_amount: '', terms_days: '30', shipment_date: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: e } = await supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).maybeSingle();
      setExp(e);
      const { data: b } = await supabase.from('v2_buyers').select('id, company_name');
      setMyBuyers((b ?? []) as any);
    })();
  }, [user]);

  const submit = async (e: React.FormEvent, submitForReview: boolean) => {
    e.preventDefault();
    if (!exp) { toast({ title: 'Your exporter profile is not set up yet.', variant: 'destructive' }); return; }
    if (!f.invoice_number || !f.invoice_amount) { toast({ title: 'Missing fields', variant: 'destructive' }); return; }
    setBusy(true);
    let buyerId = f.buyer_id || null;
    if (addingBuyer && newBuyer.company_name) {
      const { data: nb, error: bErr } = await supabase.from('v2_buyers').insert({ company_name: newBuyer.company_name, country: newBuyer.country || null }).select('id').single();
      if (bErr) { toast({ title: 'Buyer failed', description: bErr.message, variant: 'destructive' }); setBusy(false); return; }
      buyerId = nb.id;
    }
    const { data, error } = await supabase.from('v2_invoices').insert({
      invoice_number: f.invoice_number,
      exporter_id: exp.id,
      buyer_id: buyerId,
      commodity: f.commodity || null,
      invoice_currency: f.invoice_currency as any,
      invoice_amount: Number(f.invoice_amount),
      terms_days: Number(f.terms_days),
      shipment_date: f.shipment_date || null,
      status: submitForReview ? 'submitted' : 'draft',
    }).select('id').single();
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setBusy(false); return; }
    await logAudit({ invoice_id: data.id, action: submitForReview ? 'exporter_submitted' : 'exporter_draft', to_status: (submitForReview ? 'submitted' : 'draft') as any });
    nav(`/portal/invoices/${data.id}`);
  };

  if (exp === null) return <div className="text-muted-foreground">Loading…</div>;
  if (!exp) return <div className="card-elevated p-6 text-sm">Your exporter profile is not set up yet. Please contact Veloxis.</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl">Submit invoice</h1>
      <form className="card-elevated p-6 space-y-4" onSubmit={(e) => submit(e, true)}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Label>Invoice number *</Label><Input required value={f.invoice_number} onChange={(e) => setF({ ...f, invoice_number: e.target.value })} /></div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1"><Label>Buyer</Label>
              <button type="button" onClick={() => setAddingBuyer((s) => !s)} className="text-xs text-accent">{addingBuyer ? 'Choose existing' : 'Add new'}</button>
            </div>
            {addingBuyer ? (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Company name" value={newBuyer.company_name} onChange={(e) => setNewBuyer({ ...newBuyer, company_name: e.target.value })} />
                <Input placeholder="Country" value={newBuyer.country} onChange={(e) => setNewBuyer({ ...newBuyer, country: e.target.value })} />
              </div>
            ) : (
              <Select value={f.buyer_id} onValueChange={(v) => setF({ ...f, buyer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{myBuyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.company_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div><Label>Commodity</Label><Input value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })} /></div>
          <div><Label>Currency</Label>
            <Select value={f.invoice_currency} onValueChange={(v) => setF({ ...f, invoice_currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['GBP', 'USD', 'EUR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Amount *</Label><Input type="number" step="0.01" required value={f.invoice_amount} onChange={(e) => setF({ ...f, invoice_amount: e.target.value })} /></div>
          <div><Label>Terms</Label>
            <Select value={f.terms_days} onValueChange={(v) => setF({ ...f, terms_days: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['30', '45', '60'].map((c) => <SelectItem key={c} value={c}>{c} days</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Shipment date</Label><Input type="date" value={f.shipment_date} onChange={(e) => setF({ ...f, shipment_date: e.target.value })} /></div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={(e) => submit(e as any, false)} disabled={busy}>Save draft</Button>
          <Button type="submit" disabled={busy}>Submit for review</Button>
        </div>
      </form>
    </div>
  );
}
