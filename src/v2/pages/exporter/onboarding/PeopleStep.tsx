import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { OptionSelect, COUNTRIES, NATIONALITIES } from '@/v2/lib/formOptions';
import { NIGERIAN_STATES, PERSON_ID_TYPES, isNin, holdsShares, isDirector } from '@/v2/lib/onboardingRules';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Field, Section, SensitiveInput } from './ui';
import DocUpload from './DocUpload';
import CompanyAuthority from './CompanyAuthority';
import { latest, type OnboardingCtx, type Person } from './useOnboarding';

const PERSON_COLS = [
  'person_role', 'shareholding_pct', 'full_name', 'dob', 'nationality', 'email', 'phone', 'address_street', 'address_city',
  'address_state', 'address_country', 'id_type', 'id_number', 'id_expiry', 'bvn',
] as const;

const ROLE_OPTS = ['Director', 'Shareholder', 'Both'];
const roleLabel = (r: string) => (r === 'both' ? 'Both' : r === 'shareholder' ? 'Shareholder' : 'Director');

export default function PeopleStep({ ctx, errFor, listError, showErrors }: {
  ctx: OnboardingCtx; errFor: (personId: string, k: string) => string | undefined; listError: string | null; showErrors: boolean;
}) {
  const { people, setPeople, docs, uploadDoc, saveCompany, lock, expId } = ctx;
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const locked = lock.formLocked;

  // Debounced autosave for edited people, plus sync of the main director onto the company record
  // so existing staff screens keep showing it.
  useEffect(() => {
    if (!dirtyIds.size || locked) return;
    const t = setTimeout(async () => {
      const ids = [...dirtyIds];
      setDirtyIds(new Set());
      for (const id of ids) {
        const p = peopleRef.current.find((x) => x.id === id);
        if (!p) continue;
        const payload: any = Object.fromEntries(PERSON_COLS.map((k) => [k, (p as any)[k] === '' ? null : (p as any)[k]]));
        payload.full_name = p.full_name || '';
        payload.address = [p.address_street, p.address_city, p.address_state, p.address_country].filter(Boolean).join(', ') || null;
        payload.position = roleLabel(p.person_role);
        payload.shareholding_pct = holdsShares(p.person_role) && p.shareholding_pct !== null && String(p.shareholding_pct) !== '' ? Number(p.shareholding_pct) : null;
        const { error } = await supabase.from('v2_exporter_directors').update(payload).eq('id', id);
        if (error) toast({ title: 'Could not save this person', description: 'Please check the details and try again.', variant: 'destructive' });
      }
      const main = peopleRef.current.find((x) => isDirector(x.person_role));
      const exId = expId();
      if (main && exId) {
        await supabase.from('v2_exporters').update({
          director_name: main.full_name || null, director_email: main.email || null, director_phone: main.phone || null,
          director_dob: main.dob || null, director_nationality: main.nationality || null, director_id_type: main.id_type || null,
          director_id_number: main.id_number || null,
          director_address: [main.address_street, main.address_city, main.address_state, main.address_country].filter(Boolean).join(', ') || null,
        }).eq('id', exId);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [dirtyIds, locked, expId]);

  const update = (id: string, k: keyof Person, v: any) => {
    setPeople((list) => list.map((p) => (p.id === id ? { ...p, [k]: v } : p)));
    setDirtyIds((s) => new Set(s).add(id));
  };

  const add = async () => {
    const exId = expId() ?? (await saveCompany());
    if (!exId) return toast({ title: 'Save your business details first', variant: 'destructive' });
    const { data, error } = await supabase.from('v2_exporter_directors').insert({
      exporter_id: exId, full_name: '', person_role: people.length ? 'shareholder' : 'director', address_country: 'Nigeria',
      nationality: 'Nigeria', is_primary: people.length === 0,
    } as any).select('*').single();
    if (error) return toast({ title: 'Could not add person', variant: 'destructive' });
    setPeople((l) => [...l, data as any]);
  };

  const remove = async (p: Person) => {
    if (!confirm(`Remove ${p.full_name || 'this person'}?`)) return;
    const { error } = await supabase.from('v2_exporter_directors').delete().eq('id', p.id);
    if (error) return toast({ title: 'Could not remove person', variant: 'destructive' });
    await supabase.from('company_documents').delete().eq('person_id', p.id);
    setPeople((l) => l.filter((x) => x.id !== p.id));
  };

  const pdoc = (code: string, p: Person) => {
    const own = docs.filter((d) => d.code === code && d.person_id === p.id);
    if (own.length) return own;
    const legacy = p.is_primary ? latest(docs, code, null) : undefined;
    return legacy ? [legacy] : [];
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
        Add every director, and every shareholder who owns 5% or more of the company.
      </div>
      {showErrors && listError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" data-invalid="true">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{listError}
        </div>
      )}

      {people.map((p, i) => {
        const e = (k: string) => errFor(p.id, k);
        return (
          <Section key={p.id} title={`Person ${i + 1}${p.full_name ? ` · ${p.full_name}` : ''}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Role *" error={e('person_role')}>
                <OptionSelect value={roleLabel(p.person_role)} onChange={(v) => update(p.id, 'person_role', v.toLowerCase())} options={ROLE_OPTS} />
              </Field>
              {holdsShares(p.person_role) && (
                <Field label="Shareholding % *" error={e('shareholding_pct')}>
                  <Input type="number" min={0} max={100} step="0.01" value={p.shareholding_pct ?? ''} onChange={(ev) => update(p.id, 'shareholding_pct', ev.target.value)} />
                </Field>
              )}
              <Field label="Full legal name *" error={e('full_name')} className="sm:col-span-2">
                <Input value={p.full_name ?? ''} onChange={(ev) => update(p.id, 'full_name', ev.target.value)} maxLength={150} />
              </Field>
              <Field label="Date of birth *" error={e('dob')}><Input type="date" value={p.dob ?? ''} onChange={(ev) => update(p.id, 'dob', ev.target.value)} /></Field>
              <Field label="Nationality *" error={e('nationality')}><OptionSelect value={p.nationality} onChange={(v) => update(p.id, 'nationality', v)} options={NATIONALITIES} placeholder="Select nationality" /></Field>
              <Field label="Email *" error={e('email')}><Input type="email" value={p.email ?? ''} onChange={(ev) => update(p.id, 'email', ev.target.value)} maxLength={255} /></Field>
              <Field label="Phone *" error={e('phone')} hint="+234 format"><Input type="tel" placeholder="+234" value={p.phone ?? ''} onChange={(ev) => update(p.id, 'phone', ev.target.value)} maxLength={20} /></Field>
              <Field label="Residential street *" error={e('address_street')} className="sm:col-span-2"><Input value={p.address_street ?? ''} onChange={(ev) => update(p.id, 'address_street', ev.target.value)} maxLength={200} /></Field>
              <Field label="City *" error={e('address_city')}><Input value={p.address_city ?? ''} onChange={(ev) => update(p.id, 'address_city', ev.target.value)} maxLength={80} /></Field>
              <Field label="State *" error={e('address_state')}>
                {p.address_country === 'Nigeria' || !p.address_country
                  ? <OptionSelect value={p.address_state} onChange={(v) => update(p.id, 'address_state', v)} options={NIGERIAN_STATES} placeholder="Select state" />
                  : <Input value={p.address_state ?? ''} onChange={(ev) => update(p.id, 'address_state', ev.target.value)} maxLength={80} />}
              </Field>
              <Field label="Country *" error={e('address_country')}><OptionSelect value={p.address_country} onChange={(v) => update(p.id, 'address_country', v)} options={COUNTRIES} /></Field>
              <Field label="ID type *" error={e('id_type')}><OptionSelect value={p.id_type} onChange={(v) => update(p.id, 'id_type', v)} options={PERSON_ID_TYPES} placeholder="Select ID type" /></Field>
              <Field label="ID number *" error={e('id_number')}><SensitiveInput inputMode="text" value={p.id_number ?? ''} onChange={(v) => update(p.id, 'id_number', v)} maxLength={20} /></Field>
              {!isNin(p.id_type) && (
                <Field label="ID expiry date *" error={e('id_expiry')}><Input type="date" value={p.id_expiry ?? ''} onChange={(ev) => update(p.id, 'id_expiry', ev.target.value)} /></Field>
              )}
              <Field label="BVN *" error={e('bvn')}><SensitiveInput value={p.bvn ?? ''} onChange={(v) => update(p.id, 'bvn', v)} maxLength={11} /></Field>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <DocUpload label="ID document" required files={pdoc('director_id', p)} locked={locked} error={e('doc_id')}
                onUpload={(file) => uploadDoc(file, 'director_id', { personId: p.id })} />
              <DocUpload label="Proof of residential address" hint="Must be issued within the last 3 months." required needsIssueDate files={pdoc('proof_of_address', p)} locked={locked} error={e('doc_address')}
                onUpload={(file, d) => uploadDoc(file, 'proof_of_address', { personId: p.id, issueDate: d })} />
              <DocUpload label="Passport photograph" hint="JPG or PNG." required photoOnly files={pdoc('passport_photo', p)} locked={locked} error={e('doc_photo')}
                onUpload={(file) => uploadDoc(file, 'passport_photo', { personId: p.id })} />
            </div>
            {!locked && people.length > 1 && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => remove(p)}>
                <Trash2 className="mr-1 h-4 w-4" />Remove
              </Button>
            )}
          </Section>
        );
      })}

      {!locked && <Button type="button" variant="outline" onClick={add} className="w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" />Add person</Button>}

      <CompanyAuthority ctx={ctx} />
    </div>
  );
}
