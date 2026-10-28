import { Button } from '@/components/ui/button';
import { FileText, Pencil } from 'lucide-react';
import { openDocument } from '@/v2/lib/documents';
import { maskTail, holdsShares } from '@/v2/lib/onboardingRules';
import type { Doc, OnboardingCtx } from './useOnboarding';

const Row = ({ k, v }: { k: string; v?: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-0.5 py-1.5 sm:grid-cols-3 sm:gap-4">
    <dt className="text-xs text-muted-foreground">{k}</dt>
    <dd className="text-sm sm:col-span-2 break-words">{v || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

function Files({ list }: { list: Doc[] }) {
  if (!list.length) return <span className="text-muted-foreground">Not uploaded</span>;
  return (
    <div className="space-y-1">
      {list.map((d) => (
        <button key={d.id} type="button" onClick={() => openDocument(d.id, 'company')} className="flex items-center gap-1.5 text-left text-primary underline-offset-2 hover:underline">
          <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{d.label}: {d.original_filename}</span>
          {d.issue_date && <span className="text-xs text-muted-foreground">(issued {new Date(d.issue_date).toLocaleDateString('en-GB')})</span>}
        </button>
      ))}
    </div>
  );
}

export default function ReviewSummary({ ctx, onEdit }: { ctx: OnboardingCtx; onEdit?: (step: number) => void }) {
  const { f, people, docs } = ctx;
  const b = f.bank_details ?? {};
  const company = docs.filter((d) => !d.person_id && !['director_id', 'proof_of_address', 'passport_photo'].includes(d.code));
  const Head = ({ title, step }: { title: string; step: number }) => (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {onEdit && <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(step)} className="print:hidden"><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="card-elevated p-4 sm:p-6">
        <Head title="Business details" step={1} />
        <dl className="mt-2 divide-y divide-border">
          <Row k="Company name" v={f.company_name} />
          <Row k="CAC RC number" v={f.company_registration_number} />
          <Row k="Date of incorporation" v={f.incorporation_date && new Date(f.incorporation_date).toLocaleDateString('en-GB')} />
          <Row k="TIN" v={f.tax_id} />
          <Row k="NEPC registration" v={f.nepc_number} />
          <Row k="Registered address" v={[f.address_street, f.address_city, f.address_state, f.address_country].filter(Boolean).join(', ')} />
          <Row k="Phone" v={f.phone} />
          <Row k="Email" v={f.email} />
          <Row k="Website" v={f.website} />
          <Row k="Banks with Access Bank" v={f.banks_with_access === null || f.banks_with_access === undefined ? '' : f.banks_with_access ? 'Yes' : 'No'} />
          {f.banks_with_access === false && <Row k="Banks used" v={(f.other_banks ?? []).join(', ')} />}
          <Row k="Main account bank" v={f.banks_with_access ? 'Access Bank' : b.bank_name} />
          <Row k="Account name" v={b.account_name} />
          <Row k="Account number" v={maskTail(b.account_number)} />
          {f.banks_with_access && <><Row k="Account type" v={b.account_type} /><Row k="Branch" v={b.branch} /></>}
          <Row k="Documents" v={<Files list={company} />} />
        </dl>
      </section>

      <section className="card-elevated p-4 sm:p-6">
        <Head title="Directors & shareholders" step={2} />
        <div className="mt-2 space-y-4">
          {people.map((p, i) => (
            <dl key={p.id} className="divide-y divide-border rounded-md border border-border p-3">
              <Row k={`Person ${i + 1}`} v={<span className="font-medium">{p.full_name}</span>} />
              <Row k="Role" v={p.person_role === 'both' ? 'Director & Shareholder' : p.person_role === 'shareholder' ? 'Shareholder' : 'Director'} />
              {holdsShares(p.person_role) && <Row k="Shareholding" v={p.shareholding_pct !== null ? `${p.shareholding_pct}%` : ''} />}
              <Row k="Date of birth" v={p.dob && new Date(p.dob).toLocaleDateString('en-GB')} />
              <Row k="Nationality" v={p.nationality} />
              <Row k="Email / phone" v={[p.email, p.phone].filter(Boolean).join(' · ')} />
              <Row k="Address" v={[p.address_street, p.address_city, p.address_state, p.address_country].filter(Boolean).join(', ')} />
              <Row k="ID" v={[p.id_type, maskTail(p.id_number), p.id_expiry && `expires ${new Date(p.id_expiry).toLocaleDateString('en-GB')}`].filter(Boolean).join(' · ')} />
              <Row k="BVN" v={maskTail(p.bvn)} />
              <Row k="Documents" v={<Files list={docs.filter((d) => d.person_id === p.id || (p.is_primary && !d.person_id && ['director_id', 'proof_of_address', 'passport_photo'].includes(d.code)))} />} />
            </dl>
          ))}
        </div>
      </section>

      <section className="card-elevated p-4 sm:p-6">
        <Head title="Company authority" step={2} />
        <dl className="mt-2 divide-y divide-border">
          <Row k="Board resolution" v={<Files list={docs.filter((d) => d.code === 'board_resolution')} />} />
          <Row k="Authorised signatories" v={(f.proposed_signatories ?? []).length
            ? (f.proposed_signatories as any[]).map((s, i) => <div key={i}>{s.name}{s.designation ? ` — ${s.designation}` : ''}{s.email ? ` · ${s.email}` : ''}</div>)
            : ''} />
        </dl>
      </section>
    </div>
  );
}
