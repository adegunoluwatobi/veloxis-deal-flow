import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/v2/useAuth';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';
import { toast } from '@/hooks/use-toast';

export default function StaffBuyerDetail() {
  const { id } = useParams<{ id: string }>();
  const [b, setB] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [limit, setLimit] = useState('');
  const [kyb, setKyb] = useState<any>({});
  const { roles, user } = useAuth();
  // Final approval (verify / reject / credit / sanctions) sits with Credit & Compliance.
  const canVerify = roles.includes('credit_officer') || roles.includes('super_admin');
  // Business Developers may prepare and review the KYB record.
  const canReview = canVerify || roles.includes('originator');
  const isSuperAdmin = roles.includes('super_admin');

  const load = async () => {
    const [{ data: buyer }, { data: iv }] = await Promise.all([
      supabase.from('v2_buyers').select('*').eq('id', id!).maybeSingle(),
      supabase.from('v2_invoices').select('id, invoice_number, invoice_amount, invoice_currency, status, v2_exporters(company_name)').eq('buyer_id', id!),
    ]);
    setB(buyer); setInvoices((iv ?? []) as any);
    setLimit(String(buyer?.credit_limit ?? ''));
    setKyb({
      registration_number: buyer?.registration_number ?? '',
      incorporation_date: buyer?.incorporation_date ?? '',
      country_of_incorporation: buyer?.country_of_incorporation ?? '',
      tax_id: buyer?.tax_id ?? '',
      industry: buyer?.industry ?? '',
      registered_address: buyer?.registered_address ?? '',
      companies_house_id: buyer?.companies_house_id ?? '',
      country: buyer?.country ?? '',
      contact_name: buyer?.contact_name ?? '',
      contact_email: buyer?.contact_email ?? '',
      contact_phone: buyer?.contact_phone ?? '',
      kyb_notes: buyer?.kyb_notes ?? '',
    });
  };
  useEffect(() => { load(); }, [id]);

  if (!b) return <div className="text-muted-foreground">Loading…</div>;

  const set = async (patch: any) => {
    await supabase.from('v2_buyers').update({ ...patch, verified_by: user?.id, verified_at: new Date().toISOString() }).eq('id', id!);
    load(); toast({ title: 'Updated' });
  };

  const saveKyb = async () => {
    const payload: any = { ...kyb, incorporation_date: kyb.incorporation_date || null };
    const { error } = await supabase.from('v2_buyers').update(payload).eq('id', id!);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'KYB saved' }); load();
  };

  const setKybStatus = async (status: 'verified' | 'rejected' | 'in_review' | 'pending') => {
    const patch: any = { kyb_status: status };
    if (status === 'verified' || status === 'rejected') {
      patch.kyb_verified_at = new Date().toISOString();
      patch.kyb_verified_by = user?.id;
    }
    const { error } = await supabase.from('v2_buyers').update(patch).eq('id', id!);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    load();
  };

  const exposure = invoices.reduce((s, i) => s + Number(i.invoice_amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">{b.company_name}</h1>
        <p className="text-sm text-muted-foreground">{b.country ?? '—'} · Reg {b.registration_number ?? b.companies_house_id ?? '—'}</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="card-elevated p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground">KYB — Know Your Business</h3>
            <StatusPill s={b.kyb_status ?? 'pending'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Registration number"><Input value={kyb.registration_number} onChange={(e) => setKyb({ ...kyb, registration_number: e.target.value })} disabled={!canVerify} /></F>
            <F label="Companies House ID"><Input value={kyb.companies_house_id} onChange={(e) => setKyb({ ...kyb, companies_house_id: e.target.value })} disabled={!canVerify} /></F>
            <F label="Incorporation date"><Input type="date" value={kyb.incorporation_date} onChange={(e) => setKyb({ ...kyb, incorporation_date: e.target.value })} disabled={!canVerify} /></F>
            <F label="Country of incorporation"><Input value={kyb.country_of_incorporation} onChange={(e) => setKyb({ ...kyb, country_of_incorporation: e.target.value })} disabled={!canVerify} /></F>
            <F label="Country"><Input value={kyb.country} onChange={(e) => setKyb({ ...kyb, country: e.target.value })} disabled={!canVerify} /></F>
            <F label="Tax ID / VAT"><Input value={kyb.tax_id} onChange={(e) => setKyb({ ...kyb, tax_id: e.target.value })} disabled={!canVerify} /></F>
            <F label="Industry"><Input value={kyb.industry} onChange={(e) => setKyb({ ...kyb, industry: e.target.value })} disabled={!canVerify} /></F>
            <div className="col-span-2"><F label="Registered address"><Input value={kyb.registered_address} onChange={(e) => setKyb({ ...kyb, registered_address: e.target.value })} disabled={!canVerify} /></F></div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
            <F label="Contact name"><Input value={kyb.contact_name} onChange={(e) => setKyb({ ...kyb, contact_name: e.target.value })} disabled={!canVerify} /></F>
            <F label="Contact email"><Input type="email" value={kyb.contact_email} onChange={(e) => setKyb({ ...kyb, contact_email: e.target.value })} disabled={!canVerify} /></F>
            <F label="Contact phone"><Input value={kyb.contact_phone} onChange={(e) => setKyb({ ...kyb, contact_phone: e.target.value })} disabled={!canVerify} /></F>
          </div>
          <F label="Reviewer notes"><Textarea rows={2} value={kyb.kyb_notes} onChange={(e) => setKyb({ ...kyb, kyb_notes: e.target.value })} disabled={!canVerify} /></F>
          {canVerify && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={saveKyb}>Save KYB</Button>
              <Button size="sm" variant="outline" onClick={() => setKybStatus('in_review')}>Mark in review</Button>
              <Button size="sm" variant="default" onClick={() => setKybStatus('verified')}>Verify</Button>
              <Button size="sm" variant="destructive" onClick={() => setKybStatus('rejected')}>Reject</Button>
            </div>
          )}
          <div className="text-xs text-muted-foreground pt-1">Verified: {b.kyb_verified_at ? new Date(b.kyb_verified_at).toLocaleString() : '—'}</div>
        </section>

        <section className="card-elevated p-5 space-y-3">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Credit & Sanctions</h3>
          <div className="flex justify-between items-center"><span>Credit</span>
            {canVerify ? (
              <div className="space-x-1">
                <Button size="sm" variant={b.credit_status === 'clear' ? 'default' : 'outline'} onClick={() => set({ credit_status: 'clear' })}>Clear</Button>
                <Button size="sm" variant={b.credit_status === 'flagged' ? 'destructive' : 'outline'} onClick={() => set({ credit_status: 'flagged' })}>Flag</Button>
              </div>
            ) : <StatusPill s={b.credit_status} />}
          </div>
          <div className="flex justify-between items-center"><span>Sanctions</span>
            {canVerify ? (
              <div className="space-x-1">
                <Button size="sm" variant={b.sanctions_status === 'clear' ? 'default' : 'outline'} onClick={() => set({ sanctions_status: 'clear' })}>Clear</Button>
                <Button size="sm" variant={b.sanctions_status === 'flagged' ? 'destructive' : 'outline'} onClick={() => set({ sanctions_status: 'flagged' })}>Flag</Button>
              </div>
            ) : <StatusPill s={b.sanctions_status} />}
          </div>
          <div className="pt-2 border-t border-border">
            <Label className="text-xs">Credit limit (£)</Label>
            <div className="flex gap-2 mt-1">
              <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} disabled={!canVerify} />
              {canVerify && <Button onClick={() => set({ credit_limit: Number(limit) || null })}>Save</Button>}
            </div>
          </div>
          <div className="text-xs text-muted-foreground pt-2">Verified: {b.verified_at ? new Date(b.verified_at).toLocaleDateString() : '—'}</div>

          <div className="pt-4 border-t border-border">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Exposure</div>
            <div className="text-2xl font-semibold">£{exposure.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">across {invoices.length} invoices</div>
          </div>
        </section>
      </div>

      <section className="card-elevated p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Invoices</h3>
        <div className="space-y-1 text-sm">
          {invoices.map((i) => (
            <Link key={i.id} to={`/app/invoices/${i.id}`} className="grid grid-cols-4 gap-2 hover:text-accent border-t border-border pt-1">
              <span>{i.invoice_number}</span>
              <span className="text-muted-foreground">{i.v2_exporters?.company_name}</span>
              <span>{i.invoice_currency} {Number(i.invoice_amount).toLocaleString()}</span>
              <span className="text-muted-foreground">{INVOICE_STATUS_LABEL[i.status]}</span>
            </Link>
          ))}
          {invoices.length === 0 && <p className="text-muted-foreground text-sm">No invoices</p>}
        </div>
      </section>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    clear: 'bg-success/20 text-success',
    verified: 'bg-success/20 text-success',
    flagged: 'bg-destructive/20 text-destructive',
    rejected: 'bg-destructive/20 text-destructive',
    pending: 'bg-muted text-muted-foreground',
    in_review: 'bg-primary/20 text-accent',
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${map[s] ?? 'bg-muted text-muted-foreground'}`}>{s}</span>;
}
