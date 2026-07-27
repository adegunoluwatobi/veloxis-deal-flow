import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

export default function ExporterProfile() {
  const { user, profile } = useAuth();
  const [exp, setExp] = useState<any>(null);
  const [f, setF] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).maybeSingle();
      setExp(data); setF(data ?? { company_name: '', rc_number: '', contact_name: '', phone: '', email: profile?.email, commodity: '', address: '', bank_details: {} });
    })();
  }, [user, profile]);

  if (!f) return <div className="text-muted-foreground">Loading…</div>;

  const save = async () => {
    if (exp) {
      const { error } = await supabase.from('v2_exporters').update({
        company_name: f.company_name, rc_number: f.rc_number, contact_name: f.contact_name,
        phone: f.phone, email: f.email, commodity: f.commodity, address: f.address, bank_details: f.bank_details ?? {},
      }).eq('id', exp.id);
      if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } else {
      const { error } = await supabase.from('v2_exporters').insert({
        owner_user_id: user!.id, company_name: f.company_name, rc_number: f.rc_number || null,
        contact_name: f.contact_name, phone: f.phone, email: f.email, commodity: f.commodity,
        address: f.address, bank_details: f.bank_details ?? {}, onboarding_status: 'pending',
      });
      if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    }
    toast({ title: 'Saved' });
  };

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const setBank = (k: string, v: string) => setF((x: any) => ({ ...x, bank_details: { ...(x.bank_details ?? {}), [k]: v } }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">My company</h1>
        {exp && <p className="text-sm text-muted-foreground">Status: {exp.onboarding_status}</p>}
      </div>
      <div className="card-elevated p-6 grid grid-cols-2 gap-4">
        <Field label="Company *"><Input value={f.company_name ?? ''} onChange={(e) => set('company_name', e.target.value)} /></Field>
        <Field label="RC number"><Input value={f.rc_number ?? ''} onChange={(e) => set('rc_number', e.target.value)} /></Field>
        <Field label="Contact name"><Input value={f.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><Input value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Commodity"><Input value={f.commodity ?? ''} onChange={(e) => set('commodity', e.target.value)} /></Field>
        <Field label="Address"><Input value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <div className="col-span-2 border-t border-border pt-4 mt-2">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Bank details</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank name"><Input value={f.bank_details?.bank_name ?? ''} onChange={(e) => setBank('bank_name', e.target.value)} /></Field>
            <Field label="Account name"><Input value={f.bank_details?.account_name ?? ''} onChange={(e) => setBank('account_name', e.target.value)} /></Field>
            <Field label="Account number"><Input value={f.bank_details?.account_number ?? ''} onChange={(e) => setBank('account_number', e.target.value)} /></Field>
            <Field label="SWIFT / BIC"><Input value={f.bank_details?.swift ?? ''} onChange={(e) => setBank('swift', e.target.value)} /></Field>
          </div>
        </div>
        <div className="col-span-2"><Button onClick={save}>Save</Button></div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
