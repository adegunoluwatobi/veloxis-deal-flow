import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { logAudit } from '@/v2/audit';
import { getAdvanceRatePct } from '@/v2/lib/config';

export default function StaffInvoiceNew() {
  const nav = useNavigate();
  const [exporters, setExporters] = useState<{ id: string; company_name: string }[]>([]);
  const [buyers, setBuyers] = useState<{ id: string; company_name: string }[]>([]);
  const [form, setForm] = useState({
    invoice_number: '', exporter_id: '', buyer_id: '', commodity: '',
    invoice_currency: 'GBP', invoice_amount: '', terms_days: '30',
    advance_rate: '', shipment_date: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: exps }, { data: buys }, advancePct] = await Promise.all([
        supabase.from('v2_exporters').select('id, company_name').eq('onboarding_status', 'active').order('company_name'),
        supabase.from('v2_buyers').select('id, company_name').order('company_name'),
        getAdvanceRatePct(),
      ]);
      setExporters(exps ?? []);
      setBuyers(buys ?? []);
      setForm((f) => (f.advance_rate ? f : { ...f, advance_rate: String(advancePct) }));
    })();
  }, []);


  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent, submitForReview: boolean) => {
    e.preventDefault();
    if (!form.invoice_number || !form.exporter_id || !form.invoice_amount) {
      toast({ title: 'Missing fields', variant: 'destructive' }); return;
    }
    setBusy(true);
    const { data, error } = await supabase.from('v2_invoices').insert({
      invoice_number: form.invoice_number,
      exporter_id: form.exporter_id,
      buyer_id: form.buyer_id || null,
      commodity: form.commodity || null,
      invoice_currency: form.invoice_currency as any,
      invoice_amount: Number(form.invoice_amount),
      terms_days: Number(form.terms_days),
      advance_rate: Number(form.advance_rate),
      shipment_date: form.shipment_date || null,
      status: submitForReview ? 'submitted' : 'draft',
    }).select('id').single();
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setBusy(false); return; }
    await logAudit({ invoice_id: data.id, action: submitForReview ? 'created_and_submitted' : 'created', to_status: (submitForReview ? 'submitted' : 'draft') as any });
    nav(`/app/invoices/${data.id}`);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">New invoice</h1>
        <p className="text-sm text-muted-foreground">Create on behalf of an exporter</p>
      </div>
      <form className="card-elevated p-6 space-y-4" onSubmit={(e) => submit(e, true)}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Invoice number *</Label>
            <Input value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Exporter *</Label>
            <Select value={form.exporter_id} onValueChange={(v) => set('exporter_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{exporters.map((x) => <SelectItem key={x.id} value={x.id}>{x.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Buyer</Label>
            <Select value={form.buyer_id} onValueChange={(v) => set('buyer_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
              <SelectContent>{buyers.map((x) => <SelectItem key={x.id} value={x.id}>{x.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Commodity</Label>
            <Input value={form.commodity} onChange={(e) => set('commodity', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.invoice_currency} onValueChange={(v) => set('invoice_currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['GBP', 'USD', 'EUR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount *</Label>
            <Input type="number" step="0.01" value={form.invoice_amount} onChange={(e) => set('invoice_amount', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Terms (days)</Label>
            <Select value={form.terms_days} onValueChange={(v) => set('terms_days', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['30', '45', '60'].map((c) => <SelectItem key={c} value={c}>{c} — {c === '30' ? '3.5' : c === '45' ? '4.5' : '5.5'}%</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Advance rate %</Label>
            <Input type="number" step="0.01" value={form.advance_rate} onChange={(e) => set('advance_rate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Shipment date</Label>
            <Input type="date" value={form.shipment_date} onChange={(e) => set('shipment_date', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" disabled={busy} onClick={(e) => submit(e as any, false)}>Save as draft</Button>
          <Button type="submit" disabled={busy}>Submit for review</Button>
        </div>
      </form>
    </div>
  );
}
