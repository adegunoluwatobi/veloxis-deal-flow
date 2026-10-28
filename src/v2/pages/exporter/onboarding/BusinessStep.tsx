import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OptionSelect, COUNTRIES, INDUSTRIES, NIGERIAN_BANKS } from '@/v2/lib/formOptions';
import { NIGERIAN_STATES } from '@/v2/lib/onboardingRules';
import { Field, MultiSelect, Section, SensitiveInput } from './ui';
import DocUpload from './DocUpload';
import { allOf, type OnboardingCtx } from './useOnboarding';

export default function BusinessStep({ ctx, err }: { ctx: OnboardingCtx; err: (k: string) => string | undefined }) {
  const { f, set, setBank, docs, uploadDoc, lock } = ctx;
  const b = f.bank_details ?? {};
  const up = (code: string) => (file: File, issueDate: string | null) => uploadDoc(file, code, { issueDate });
  const docProps = (code: string) => ({ files: allOf(docs, code), locked: lock.formLocked, onUpload: up(code), error: err(`doc_${code}`) });

  return (
    <div className="space-y-6">
      <Section title="Company">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Registered company name *" error={err('company_name')} className="sm:col-span-2">
            <Input value={f.company_name ?? ''} onChange={(e) => set('company_name', e.target.value)} maxLength={200} />
          </Field>
          <Field label="CAC RC number *" error={err('company_registration_number')} hint="Digits, optionally starting with RC.">
            <Input value={f.company_registration_number ?? ''} onChange={(e) => set('company_registration_number', e.target.value.toUpperCase())} maxLength={12} />
          </Field>
          <Field label="Date of incorporation *" error={err('incorporation_date')}>
            <Input type="date" max={new Date().toISOString().slice(0, 10)} value={f.incorporation_date ?? ''} onChange={(e) => set('incorporation_date', e.target.value)} />
          </Field>
          <Field label="TIN *" error={err('tax_id')}>
            <Input value={f.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} maxLength={20} />
          </Field>
          <Field label="NEPC export registration number *" error={err('nepc_number')}>
            <Input value={f.nepc_number ?? ''} onChange={(e) => set('nepc_number', e.target.value)} maxLength={40} />
          </Field>
          <Field label="Industry"><OptionSelect value={f.industry} onChange={(v) => set('industry', v)} options={INDUSTRIES} placeholder="Select industry" /></Field>
          <Field label="Primary commodity"><Input value={f.commodity ?? ''} onChange={(e) => set('commodity', e.target.value)} maxLength={120} /></Field>
        </div>
      </Section>

      <Section title="Registered address & contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Street *" error={err('address_street')} className="sm:col-span-2">
            <Input value={f.address_street ?? ''} onChange={(e) => set('address_street', e.target.value)} maxLength={200} />
          </Field>
          <Field label="City *" error={err('address_city')}><Input value={f.address_city ?? ''} onChange={(e) => set('address_city', e.target.value)} maxLength={80} /></Field>
          <Field label="State *" error={err('address_state')}><OptionSelect value={f.address_state} onChange={(v) => set('address_state', v)} options={NIGERIAN_STATES} placeholder="Select state" /></Field>
          <Field label="Country *" error={err('address_country')}><OptionSelect value={f.address_country} onChange={(v) => set('address_country', v)} options={COUNTRIES} placeholder="Select country" /></Field>
          <Field label="Business phone *" error={err('phone')} hint="+234 format, e.g. +234 801 234 5678">
            <Input type="tel" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+234" maxLength={20} />
          </Field>
          <Field label="Business email" error={err('email')}><Input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} maxLength={255} /></Field>
          <Field label="Website (optional)" error={err('website')}><Input value={f.website ?? ''} onChange={(e) => set('website', e.target.value)} maxLength={200} /></Field>
        </div>
      </Section>

      <Section title="Banking">
        <Field label="Do you bank with Access Bank? *" error={err('banks_with_access')}>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <Button key={String(v)} type="button" variant={f.banks_with_access === v ? 'default' : 'outline'} className="flex-1 sm:flex-none sm:w-28"
                onClick={() => set('banks_with_access', v)}>{v ? 'Yes' : 'No'}</Button>
            ))}
          </div>
        </Field>
        {f.banks_with_access === true && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Account name *" error={err('account_name')}><Input value={b.account_name ?? ''} onChange={(e) => setBank('account_name', e.target.value)} maxLength={120} /></Field>
            <Field label="Account number (NUBAN) *" error={err('account_number')}><SensitiveInput value={b.account_number ?? ''} onChange={(v) => setBank('account_number', v)} maxLength={10} /></Field>
            <Field label="Account type *" error={err('account_type')}><OptionSelect value={b.account_type} onChange={(v) => setBank('account_type', v)} options={['Current', 'Domiciliary']} placeholder="Select type" /></Field>
            <Field label="Branch *" error={err('branch')}><Input value={b.branch ?? ''} onChange={(e) => setBank('branch', e.target.value)} maxLength={120} /></Field>
          </div>
        )}
        {f.banks_with_access === false && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Which bank(s) do you use? *" error={err('other_banks')} className="sm:col-span-2">
              <MultiSelect value={f.other_banks ?? []} onChange={(v) => { set('other_banks', v); if (!v.includes(b.bank_name)) setBank('bank_name', v[0] ?? ''); }}
                options={NIGERIAN_BANKS.filter((x) => !/^Access Bank/i.test(x))} placeholder="Select banks" />
            </Field>
            {(f.other_banks ?? []).length > 1 && (
              <Field label="Main account bank *" error={err('bank_name')} className="sm:col-span-2">
                <OptionSelect value={b.bank_name} onChange={(v) => setBank('bank_name', v)} options={f.other_banks} />
              </Field>
            )}
            <Field label="Main account name *" error={err('account_name')}><Input value={b.account_name ?? ''} onChange={(e) => setBank('account_name', e.target.value)} maxLength={120} /></Field>
            <Field label="Main account number (NUBAN) *" error={err('account_number')}><SensitiveInput value={b.account_number ?? ''} onChange={(v) => setBank('account_number', v)} maxLength={10} /></Field>
          </div>
        )}
      </Section>

      <Section title="Company documents" description="PDF, JPG or PNG, up to 10MB each.">
        <div className="space-y-3">
          <DocUpload label="CAC certificate of incorporation" required {...docProps('cac_certificate')} />
          <DocUpload label="CAC status report" required {...docProps('cac_status_report')} />
          <DocUpload label="MEMART" hint="Memorandum and Articles of Association." required {...docProps('memart')} />
          <DocUpload label="NEPC registration certificate" required {...docProps('nepc_certificate')} />
          <DocUpload label="TIN certificate" hint="A clear screenshot of your record on the FIRS site is acceptable." required {...docProps('tin_certificate')} />
          <DocUpload label="Proof of business address" hint="e.g. a utility bill. Must be issued within the last 3 months — enter the issue date before uploading." required needsIssueDate {...docProps('business_address_proof')} />
          <DocUpload label="Business bank statements" hint="Last 6 to 12 months. You can upload several files." required multiple {...docProps('bank_statement')} />
          <DocUpload label="Letter of introduction / bank reference letter" optional multiple {...docProps('bank_reference_letter')} />
        </div>
      </Section>
    </div>
  );
}
