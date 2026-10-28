import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { getDocumentUrl } from '@/v2/lib/documents';
import { Download, Eye, EyeOff, FileText, Loader2, X } from 'lucide-react';

const PERSON_CODES = ['director_id', 'proof_of_address', 'passport_photo'];
const mask = (v?: string | null) => (v ? `•••• ${String(v).slice(-4)}` : '—');
const d8 = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function callPack(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/exporter-pack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error ?? msg; } catch { /* binary */ }
    throw new Error(msg);
  }
  return res;
}

export function KybPackButtons({ exporterId }: { exporterId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (mode: 'full' | 'summary' | 'zip') => {
    setBusy(mode);
    try {
      const res = await callPack({ exporter_id: exporterId, mode });
      const cd = res.headers.get('Content-Disposition') ?? '';
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? `KYB_Pack.${mode === 'zip' ? 'zip' : 'pdf'}`;
      downloadBlob(await res.blob(), name);
    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };
  const B = ({ mode, label }: { mode: 'full' | 'summary' | 'zip'; label: string }) => (
    <Button size="sm" variant={mode === 'full' ? 'default' : 'outline'} disabled={!!busy} onClick={() => run(mode)} className="w-full sm:w-auto">
      {busy === mode ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}{label}
    </Button>
  );
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <B mode="full" label="Download full pack (PDF)" />
      <B mode="summary" label="Download summary only (PDF)" />
      <B mode="zip" label="Download all files (ZIP)" />
    </div>
  );
}

export function AssignBd({ exporterId, current, onSaved }: { exporterId: string; current: string | null; onSaved: () => void }) {
  const [bds, setBds] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from('app_user_roles').select('user_id').eq('role', 'originator');
      const ids = (r ?? []).map((x: any) => x.user_id);
      if (!ids.length) return;
      const { data: p } = await supabase.from('profiles').select('user_id, name, email').in('user_id', ids);
      setBds((p ?? []).map((x: any) => ({ id: x.user_id, name: x.name || x.email })));
    })();
  }, []);
  const save = async (v: string) => {
    const { error } = await supabase.from('v2_exporters').update({ created_by: v || null }).eq('id', exporterId);
    if (error) toast({ title: 'Could not assign', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Business Developer assigned' }); onSaved(); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Owning Business Developer:</span>
      <select aria-label="Owning Business Developer" className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={bds.some((b) => b.id === current) ? current! : ''} onChange={(e) => save(e.target.value)}>
        <option value="">Unassigned</option>
        {bds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </div>
  );
}

function Reveal({ exporterId, masked, field, personId }: { exporterId: string; masked?: string | null; field: string; personId?: string }) {
  const [val, setVal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!masked) return <>—</>;
  const show = async () => {
    setBusy(true);
    try {
      const res = await callPack({ exporter_id: exporterId, mode: 'reveal', field, person_id: personId });
      setVal((await res.json()).value ?? '—');
    } catch (e: any) { toast({ title: 'Could not reveal', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{val ?? mask(masked)}</span>
      <button type="button" onClick={val ? () => setVal(null) : show} disabled={busy}
        className="text-xs text-accent hover:underline inline-flex items-center gap-1" aria-label={val ? 'Hide' : 'Reveal'}>
        {val ? <><EyeOff className="h-3 w-3" />Hide</> : <><Eye className="h-3 w-3" />Reveal</>}
      </button>
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4 py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground text-xs sm:text-sm">{label}</span>
      <span className="sm:text-right break-words">{children || '—'}</span>
    </div>
  );
}

function DocItem({ d, canVerifyDoc, busy, onSetStatus }: { d: any; canVerifyDoc: boolean; busy: boolean; onSetStatus: (id: string, s: 'verified' | 'rejected' | 'pending', r?: string) => unknown }) {
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [loading, setLoading] = useState<'p' | 'd' | null>(null);
  const fetchBlob = async (purpose: 'view' | 'download') => {
    const { data, error } = await supabase.functions.invoke('get-document-url', { body: { document_id: d.id, document_kind: 'company', purpose } });
    if (error || !data?.url) { toast({ title: 'Unable to open document', variant: 'destructive' }); return null; }
    return (await fetch(data.url)).blob();
  };
  const togglePreview = async () => {
    if (preview) { URL.revokeObjectURL(preview.url); setPreview(null); return; }
    setLoading('p');
    const b = await fetchBlob('view'); setLoading(null);
    if (b) setPreview({ url: URL.createObjectURL(b), type: b.type });
  };
  const download = async () => {
    setLoading('d');
    const b = await fetchBlob('download'); setLoading(null);
    if (b) downloadBlob(b, d.original_filename || 'document');
  };
  const isImg = preview?.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(d.original_filename ?? '');
  return (
    <div className="border-t border-border pt-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm inline-flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-accent" /><span className="break-all">{d.original_filename || d.document_types?.label}</span></div>
          <div className="text-xs text-muted-foreground">
            {d.document_types?.label ?? '—'} · uploaded {d8(d.uploaded_at)}{d.issue_date ? ` · issued ${d8(d.issue_date)}` : ''}
          </div>
        </div>
        <span className={`self-start text-xs px-2 py-0.5 rounded shrink-0 ${d.status === 'verified' ? 'bg-primary/20 text-accent' : d.status === 'rejected' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>
          {d.status === 'verified' ? 'Approved' : d.status === 'rejected' ? 'Rejected' : 'Awaiting review'}
        </span>
      </div>
      {d.status === 'rejected' && d.rejection_reason && (
        <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
          <span className="text-destructive font-medium">Reason shown to exporter: </span>{d.rejection_reason}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={togglePreview} disabled={loading !== null}>
          {loading === 'p' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : preview ? <X className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}{preview ? 'Close preview' : 'Preview'}
        </Button>
        <Button size="sm" variant="outline" onClick={download} disabled={loading !== null}>
          {loading === 'd' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}Download
        </Button>
        {canVerifyDoc && d.status !== 'verified' && <Button size="sm" disabled={busy} onClick={() => onSetStatus(d.id, 'verified')}>Approve</Button>}
        {canVerifyDoc && d.status !== 'rejected' && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => {
            const why = window.prompt('Why is this document being rejected? The exporter will see this reason:');
            if (!why || !why.trim()) return;
            onSetStatus(d.id, 'rejected', why.trim());
          }}>Reject</Button>
        )}
        {canVerifyDoc && d.status !== 'pending' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onSetStatus(d.id, 'pending')}>Reset to pending</Button>}
      </div>
      {preview && (
        <div className="mt-3 rounded border border-border bg-muted/20 overflow-hidden">
          {isImg
            ? <img src={preview.url} alt={d.original_filename ?? 'Document'} className="max-h-[70vh] w-full object-contain" />
            : <iframe src={preview.url} title={d.original_filename ?? 'Document'} className="w-full h-[70vh]" />}
        </div>
      )}
    </div>
  );
}

export function KybReviewSections({ exp, people, docs, canVerifyDoc, busy, onSetStatus }: {
  exp: any; people: any[]; docs: any[]; canVerifyDoc: boolean; busy: boolean;
  onSetStatus: (id: string, s: 'verified' | 'rejected' | 'pending', r?: string) => unknown;
}) {
  const b = exp.bank_details ?? {};
  const primary = people.find((p) => p.is_primary);
  const personOf = (d: any) => d.person_id ?? (PERSON_CODES.includes(d.document_types?.code) ? primary?.id ?? '__primary' : null);
  const businessDocs = docs.filter((d) => !personOf(d))
    .sort((a, c) => (a.document_types?.sort_order ?? 0) - (c.document_types?.sort_order ?? 0));
  const letters = docs.filter((d) => d.document_types?.code === 'bank_reference_letter');
  const orphan = docs.filter((d) => personOf(d) === '__primary');
  const docProps = { canVerifyDoc, busy, onSetStatus };
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">{children}</h3>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card-elevated p-4 sm:p-5 text-sm">
          <H>Business details</H>
          <Row label="Company name">{exp.company_name}</Row>
          <Row label="CAC RC number">{exp.company_registration_number ?? exp.rc_number}</Row>
          <Row label="Date of incorporation">{exp.incorporation_date && d8(exp.incorporation_date)}</Row>
          <Row label="Country">{exp.country_of_incorporation}</Row>
          <Row label="Industry">{exp.industry}</Row>
          <Row label="TIN">{exp.tax_id}</Row>
          <Row label="NEPC registration">{[exp.nepc_number, exp.nepc_status].filter(Boolean).join(' · ')}</Row>
          <Row label="Registered address">{[exp.address_street, exp.address_city, exp.address_state, exp.address_country].filter(Boolean).join(', ') || exp.address}</Row>
          <Row label="Phone">{exp.phone}</Row>
          <Row label="Email">{exp.email}</Row>
          <Row label="Website">{exp.website}</Row>
        </section>

        <section className="card-elevated p-4 sm:p-5 text-sm">
          <H>Banking</H>
          <Row label="Access Bank customer">{exp.banks_with_access == null ? '' : exp.banks_with_access ? 'Yes' : 'No'}</Row>
          {exp.banks_with_access === false && <Row label="Banks used">{(exp.other_banks ?? []).join(', ')}</Row>}
          <Row label="Main account bank">{exp.banks_with_access ? 'Access Bank' : b.bank_name}</Row>
          <Row label="Account name">{b.account_name}</Row>
          <Row label="Account number"><Reveal exporterId={exp.id} masked={b.account_number} field="account_number" /></Row>
          <Row label="Account type">{b.account_type}</Row>
          <Row label="Branch">{b.branch}</Row>
          <Row label="SWIFT / BIC">{b.swift}</Row>
          <Row label="Letters of introduction">
            {letters.length ? letters.map((l) => <div key={l.id}>{l.original_filename}</div>) : 'None uploaded'}
          </Row>
        </section>
      </div>

      <section className="card-elevated p-4 sm:p-5 text-sm">
        <H>Directors &amp; shareholders</H>
        {people.length === 0 && <p className="text-muted-foreground">No directors added.</p>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {people.map((p, i) => (
            <div key={p.id} className="rounded-md border border-border p-3">
              <div className="font-medium mb-1">{i + 1}. {p.full_name}{p.is_primary ? ' · Primary' : ''}</div>
              <Row label="Role">{p.person_role === 'both' ? 'Director & Shareholder' : p.person_role === 'shareholder' ? 'Shareholder' : 'Director'}{p.position ? ` · ${p.position}` : ''}</Row>
              {p.shareholding_pct != null && <Row label="Shareholding">{`${p.shareholding_pct}%`}</Row>}
              <Row label="Date of birth">{p.dob && d8(p.dob)}</Row>
              <Row label="Nationality">{p.nationality}</Row>
              <Row label="Email / phone">{[p.email, p.phone].filter(Boolean).join(' · ')}</Row>
              <Row label="Address">{[p.address_street, p.address_city, p.address_state, p.address_country].filter(Boolean).join(', ') || p.address}</Row>
              <Row label="ID type">{[p.id_type, p.id_expiry && `expires ${d8(p.id_expiry)}`].filter(Boolean).join(' · ')}</Row>
              <Row label="ID number"><Reveal exporterId={exp.id} masked={p.id_number} field="id_number" personId={p.id} /></Row>
              <Row label="BVN"><Reveal exporterId={exp.id} masked={p.bvn} field="bvn" personId={p.id} /></Row>
            </div>
          ))}
        </div>
      </section>

      <section className="card-elevated p-4 sm:p-5">
        <H>Documents</H>
        {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
        {docs.length > 0 && !canVerifyDoc && <p className="text-xs text-muted-foreground mb-3">Only Credit &amp; Compliance can approve or reject documents.</p>}
        {businessDocs.length > 0 && (
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1">Business documents</div>
            {businessDocs.map((d) => <DocItem key={d.id} d={d} {...docProps} />)}
          </div>
        )}
        {people.map((p) => {
          const list = docs.filter((d) => personOf(d) === p.id);
          if (!list.length) return null;
          return (
            <div key={p.id} className="mb-5">
              <div className="text-xs font-semibold uppercase tracking-wider mb-1">{p.full_name}</div>
              {list.map((d) => <DocItem key={d.id} d={d} {...docProps} />)}
            </div>
          );
        })}
        {orphan.length > 0 && (
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1">Director documents</div>
            {orphan.map((d) => <DocItem key={d.id} d={d} {...docProps} />)}
          </div>
        )}
      </section>
    </div>
  );
}
