import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';

export default function StaffBuyers() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const { roles, user } = useAuth();
  const navigate = useNavigate();
  const canVerify = roles.includes('credit_officer') || roles.includes('super_admin');

  const load = async () => {
    const { data } = await supabase.from('v2_buyers').select('*').order('created_at', { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const verify = async (id: string, field: 'credit_status' | 'sanctions_status', value: 'clear' | 'flagged') => {
    const patch: any = { [field]: value, verified_by: user?.id, verified_at: new Date().toISOString() };
    await supabase.from('v2_buyers').update(patch).eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl">Buyers</h1><p className="text-sm text-muted-foreground">{rows.length} total</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Add buyer</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New buyer</DialogTitle></DialogHeader>
            <NewBuyerForm onDone={() => { setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">Country</th>
              <th className="text-left px-4 py-3">KYB</th>
              <th className="text-left px-4 py-3">Credit</th>
              <th className="text-left px-4 py-3">Sanctions</th>
              <th className="text-right px-4 py-3">Limit</th>
              {canVerify && <th className="text-right px-4 py-3">Quick verify</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => navigate(`/app/buyers/${r.id}`)}
                className="border-t border-border hover:bg-muted/20 cursor-pointer"
              >
                <td className="px-4 py-3 text-accent">{r.company_name}</td>
                <td className="px-4 py-3">{r.country ?? '—'}</td>
                <td className="px-4 py-3"><Pill s={r.kyb_status ?? 'pending'} /></td>
                <td className="px-4 py-3"><Pill s={r.credit_status} /></td>
                <td className="px-4 py-3"><Pill s={r.sanctions_status} /></td>
                <td className="px-4 py-3 text-right">{r.credit_limit ? `£${Number(r.credit_limit).toLocaleString()}` : '—'}</td>
                {canVerify && (
                  <td className="px-4 py-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => verify(r.id, 'credit_status', 'clear')}>Credit ✓</Button>
                    <Button size="sm" variant="ghost" onClick={() => verify(r.id, 'sanctions_status', 'clear')}>Sanc ✓</Button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No buyers</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ s }: { s: string }) {
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

function NewBuyerForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    company_name: '', country: '', companies_house_id: '', credit_limit: '',
    registration_number: '', incorporation_date: '', country_of_incorporation: '',
    tax_id: '', industry: '', registered_address: '',
    contact_name: '', contact_email: '', contact_phone: '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const payload: any = {
      company_name: f.company_name,
      country: f.country || null,
      companies_house_id: f.companies_house_id || null,
      credit_limit: f.credit_limit ? Number(f.credit_limit) : null,
      registration_number: f.registration_number || null,
      incorporation_date: f.incorporation_date || null,
      country_of_incorporation: f.country_of_incorporation || null,
      tax_id: f.tax_id || null,
      industry: f.industry || null,
      registered_address: f.registered_address || null,
      contact_name: f.contact_name || null,
      contact_email: f.contact_email || null,
      contact_phone: f.contact_phone || null,
    };
    const { error } = await supabase.from('v2_buyers').insert(payload);
    setBusy(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Company</h3>
      <div className="grid grid-cols-2 gap-3">
        <Fld label="Company *"><Input required value={f.company_name} onChange={(e) => set('company_name', e.target.value)} /></Fld>
        <Fld label="Industry"><Input value={f.industry} onChange={(e) => set('industry', e.target.value)} /></Fld>
        <Fld label="Country"><Input value={f.country} onChange={(e) => set('country', e.target.value)} /></Fld>
        <Fld label="Country of incorporation"><Input value={f.country_of_incorporation} onChange={(e) => set('country_of_incorporation', e.target.value)} /></Fld>
        <Fld label="Registration number"><Input value={f.registration_number} onChange={(e) => set('registration_number', e.target.value)} /></Fld>
        <Fld label="Companies House ID"><Input value={f.companies_house_id} onChange={(e) => set('companies_house_id', e.target.value)} /></Fld>
        <Fld label="Incorporation date"><Input type="date" value={f.incorporation_date} onChange={(e) => set('incorporation_date', e.target.value)} /></Fld>
        <Fld label="Tax ID / VAT"><Input value={f.tax_id} onChange={(e) => set('tax_id', e.target.value)} /></Fld>
        <div className="col-span-2"><Fld label="Registered address"><Input value={f.registered_address} onChange={(e) => set('registered_address', e.target.value)} /></Fld></div>
      </div>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground pt-2">Primary contact</h3>
      <div className="grid grid-cols-2 gap-3">
        <Fld label="Contact name"><Input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Fld>
        <Fld label="Contact email"><Input type="email" value={f.contact_email} onChange={(e) => set('contact_email', e.target.value)} /></Fld>
        <Fld label="Contact phone"><Input value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} /></Fld>
        <Fld label="Credit limit (£)"><Input type="number" value={f.credit_limit} onChange={(e) => set('credit_limit', e.target.value)} /></Fld>
      </div>
      <Button type="submit" disabled={busy}>Create buyer</Button>
    </form>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
