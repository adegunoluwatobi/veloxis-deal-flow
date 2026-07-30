import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { OptionSelect, ID_TYPES, COUNTRIES, NIGERIAN_BANKS } from '@/v2/lib/formOptions';

const KYC_BADGE: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-500/20 text-amber-400',
  verified: 'bg-primary/20 text-accent',
  rejected: 'bg-destructive/20 text-destructive',
};

function StatusPill({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded ${KYC_BADGE[status] ?? KYC_BADGE.not_started}`}>
        {status.replace('_', ' ')}
      </span>
    </div>
  );
}

export default function ExporterProfile() {
  const { user, profile } = useAuth();
  const [exp, setExp] = useState<any>(null);
  const [f, setF] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).maybeSingle();
      setExp(data);
      setF(data ?? {
        company_name: '', rc_number: '', contact_name: '', phone: '', email: profile?.email, commodity: '',
        address: '', bank_details: {},
        company_registration_number: '', incorporation_date: '', country_of_incorporation: '', tax_id: '', industry: '',
        director_name: '', director_email: '', director_phone: '', director_dob: '', director_nationality: '',
        director_id_type: '', director_id_number: '', director_address: '',
      });
    })();
  }, [user, profile]);

  if (!f) return <div className="text-muted-foreground">Loading…</div>;

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const setBank = (k: string, v: string) => setF((x: any) => ({ ...x, bank_details: { ...(x.bank_details ?? {}), [k]: v } }));

  const save = async () => {
    const payload: any = {
      company_name: f.company_name, rc_number: f.rc_number || null, contact_name: f.contact_name,
      phone: f.phone, email: f.email, commodity: f.commodity, address: f.address, bank_details: f.bank_details ?? {},
      company_registration_number: f.company_registration_number || null,
      incorporation_date: f.incorporation_date || null,
      country_of_incorporation: f.country_of_incorporation || null,
      tax_id: f.tax_id || null, industry: f.industry || null,
      director_name: f.director_name || null, director_email: f.director_email || null,
      director_phone: f.director_phone || null, director_dob: f.director_dob || null,
      director_nationality: f.director_nationality || null,
      director_id_type: f.director_id_type || null, director_id_number: f.director_id_number || null,
      director_address: f.director_address || null,
    };
    if (exp) {
      const { error } = await supabase.from('v2_exporters').update(payload).eq('id', exp.id);
      if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } else {
      const { error } = await supabase.from('v2_exporters').insert({
        owner_user_id: user!.id, ...payload, onboarding_status: 'pending',
      });
      if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    }
    toast({ title: 'Saved' });
    const { data } = await supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).maybeSingle();
    setExp(data);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl">My company</h1>
          {exp && <p className="text-sm text-muted-foreground">Onboarding: {exp.onboarding_status}</p>}
        </div>
        {exp && (
          <div className="flex flex-col gap-2 items-end">
            <StatusPill label="KYB (Company)" status={exp.kyb_status ?? 'not_started'} />
            <StatusPill label="KYC (Director)" status={exp.kyc_status ?? 'not_started'} />
          </div>
        )}
      </div>

      <section className="card-elevated p-6 space-y-4">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Company (KYB)</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company name *"><Input value={f.company_name ?? ''} onChange={(e) => set('company_name', e.target.value)} /></Field>
          <Field label="RC / Registration number"><Input value={f.company_registration_number ?? f.rc_number ?? ''} onChange={(e) => { set('company_registration_number', e.target.value); set('rc_number', e.target.value); }} /></Field>
          <Field label="Country of incorporation"><OptionSelect value={f.country_of_incorporation} onChange={(v) => set('country_of_incorporation', v)} options={COUNTRIES} placeholder="Select country" /></Field>
          <Field label="Incorporation date"><Input type="date" value={f.incorporation_date ?? ''} onChange={(e) => set('incorporation_date', e.target.value)} /></Field>
          <Field label="Tax ID / TIN"><Input value={f.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} /></Field>
          <Field label="Industry"><Input value={f.industry ?? ''} onChange={(e) => set('industry', e.target.value)} /></Field>
          <Field label="Commodity"><Input value={f.commodity ?? ''} onChange={(e) => set('commodity', e.target.value)} /></Field>
          <Field label="Company phone"><Input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Company email"><Input value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Registered address"><Input value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field></div>
        </div>
      </section>

      <section className="card-elevated p-6 space-y-4">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Director (KYC)</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Director full name *"><Input value={f.director_name ?? ''} onChange={(e) => set('director_name', e.target.value)} /></Field>
          <Field label="Director email"><Input value={f.director_email ?? ''} onChange={(e) => set('director_email', e.target.value)} /></Field>
          <Field label="Director phone"><Input value={f.director_phone ?? ''} onChange={(e) => set('director_phone', e.target.value)} /></Field>
          <Field label="Date of birth"><Input type="date" value={f.director_dob ?? ''} onChange={(e) => set('director_dob', e.target.value)} /></Field>
          <Field label="Nationality"><Input value={f.director_nationality ?? ''} onChange={(e) => set('director_nationality', e.target.value)} /></Field>
          <Field label="ID type"><OptionSelect value={f.director_id_type} onChange={(v) => set('director_id_type', v)} options={ID_TYPES} placeholder="Select ID type" /></Field>
          <Field label="ID number"><Input value={f.director_id_number ?? ''} onChange={(e) => set('director_id_number', e.target.value)} /></Field>
          <Field label="Contact name (day-to-day)"><Input value={f.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Director residential address"><Input value={f.director_address ?? ''} onChange={(e) => set('director_address', e.target.value)} /></Field></div>
        </div>
      </section>

      <section className="card-elevated p-6 space-y-4">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Bank details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bank name"><OptionSelect value={f.bank_details?.bank_name} onChange={(v) => setBank('bank_name', v)} options={NIGERIAN_BANKS} placeholder="Select bank" /></Field>
          <Field label="Account name"><Input value={f.bank_details?.account_name ?? ''} onChange={(e) => setBank('account_name', e.target.value)} /></Field>
          <Field label="Account number / IBAN"><Input value={f.bank_details?.account_number ?? ''} onChange={(e) => setBank('account_number', e.target.value)} /></Field>
          <Field label="SWIFT / BIC"><Input value={f.bank_details?.swift ?? ''} onChange={(e) => setBank('swift', e.target.value)} /></Field>
        </div>
      </section>

      <div><Button onClick={save}>Save profile</Button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
