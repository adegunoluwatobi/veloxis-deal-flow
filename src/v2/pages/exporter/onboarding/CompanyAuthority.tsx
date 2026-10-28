import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { OptionSelect } from '@/v2/lib/formOptions';
import { FileDown, Plus, Printer, Trash2 } from 'lucide-react';
import { openBoardResolutionTemplate, downloadBoardResolutionPdf } from '@/v2/lib/boardResolutionTemplate';
import { Field, Section } from './ui';
import DocUpload from './DocUpload';
import { allOf, type OnboardingCtx } from './useOnboarding';
import { isDirector } from '@/v2/lib/onboardingRules';

type Sig = { name: string; designation: string; email: string; phone: string; person_id?: string };

export default function CompanyAuthority({ ctx }: { ctx: OnboardingCtx }) {
  const { f, set, docs, uploadDoc, people, lock, profile } = ctx;
  const sigs: Sig[] = f.proposed_signatories ?? [];
  const [pdfBusy, setPdfBusy] = useState(false);
  const locked = lock.formLocked;
  const setSigs = (v: Sig[]) => set('proposed_signatories', v);
  const directors = people.filter((p) => isDirector(p.person_role) && p.full_name);
  const unused = directors.filter((d) => !sigs.some((s) => s.person_id === d.id));

  const tpl = () => ({
    companyName: f.company_name, registrationNumber: f.company_registration_number,
    registeredAddress: [f.address_street, f.address_city, f.address_state, f.address_country].filter(Boolean).join(', '),
    companyEmail: f.email ?? profile?.email,
    signatories: sigs.length ? sigs.map((s) => ({ name: s.name, designation: s.designation, email: s.email })) : [{}, {}],
  });
  const ready = () => {
    if (f.company_name && f.company_registration_number && f.address_street) return true;
    toast({ title: 'Complete your business details first', description: 'The template needs your company name, RC number and address.', variant: 'destructive' });
    return false;
  };

  return (
    <Section title="Company Authority" description="Upload the board resolution authorising the facility and tell us who your authorised signatories are. The resolution is valid for 1 year. You can upload it later, but no invoice can be created until it is uploaded and approved.">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { if (ready() && !openBoardResolutionTemplate(tpl())) toast({ title: 'Allow pop-ups to print the template', variant: 'destructive' }); }}>
          <Printer className="mr-1 h-4 w-4" />Print template
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pdfBusy} onClick={async () => {
          if (!ready()) return; setPdfBusy(true);
          try { await downloadBoardResolutionPdf(tpl()); } catch { toast({ title: 'Could not create the PDF', variant: 'destructive' }); } finally { setPdfBusy(false); }
        }}>
          <FileDown className="mr-1 h-4 w-4" />{pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
        </Button>
      </div>
      <DocUpload label="Board resolution authorising the facility" optional files={allOf(docs, 'board_resolution')} locked={locked}
        onUpload={(file) => uploadDoc(file, 'board_resolution')} />

      <div className="space-y-3 border-t border-border pt-4">
        <div className="text-sm font-medium">Authorised signatories</div>
        {sigs.map((s, i) => {
          const upd = (k: keyof Sig, v: string) => setSigs(sigs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
          return (
            <div key={i} className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
              <Field label="Full name"><Input value={s.name} disabled={locked || !!s.person_id} onChange={(e) => upd('name', e.target.value)} maxLength={150} /></Field>
              <Field label="Designation"><Input value={s.designation} disabled={locked} onChange={(e) => upd('designation', e.target.value)} maxLength={80} /></Field>
              <Field label="Email"><Input type="email" value={s.email} disabled={locked} onChange={(e) => upd('email', e.target.value)} maxLength={255} /></Field>
              <Field label="Phone"><Input type="tel" value={s.phone} disabled={locked} onChange={(e) => upd('phone', e.target.value)} maxLength={20} /></Field>
              {!locked && (
                <Button type="button" variant="ghost" size="sm" className="justify-self-start text-destructive" onClick={() => setSigs(sigs.filter((_, j) => j !== i))}>
                  <Trash2 className="mr-1 h-4 w-4" />Remove signatory
                </Button>
              )}
            </div>
          );
        })}
        {!locked && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {unused.length > 0 && (
              <div className="sm:w-72">
                <OptionSelect value="" placeholder="Add a director as signatory" options={unused.map((d) => d.full_name)}
                  onChange={(name) => {
                    const d = unused.find((x) => x.full_name === name)!;
                    setSigs([...sigs, { name: d.full_name, designation: 'Director', email: d.email ?? '', phone: d.phone ?? '', person_id: d.id }]);
                  }} />
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setSigs([...sigs, { name: '', designation: '', email: '', phone: '' }])}>
              <Plus className="mr-1 h-4 w-4" />Add someone else
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Your reviewer confirms the signatories and the authorised limit from the signed resolution.</p>
      </div>
    </Section>
  );
}
