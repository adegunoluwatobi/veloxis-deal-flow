import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { INVOICE_STATUS_LABEL, has } from '@/v2/roles';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { logAudit } from '@/v2/audit';
import { openDocument } from '@/v2/lib/documents';
import { CheckCircle2, XCircle, FileText, Clock } from 'lucide-react';
import AuditLogTable from '@/v2/components/AuditLogTable';
import ReviewChain, { SingleReviewerBanner } from '@/v2/components/ReviewChain';
import BoardResolutionReviewStep from '@/v2/components/BoardResolutionReviewStep';


const DOC_LABEL: Record<string, string> = {
  cac_certificate: 'Company registration (CAC / RC)',
  director_id: 'Director government ID',
  proof_of_address: 'Director proof of address',
  bank_proof: 'Bank details / statement',
  other: 'Other',
};

export default function StaffExporterDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, roles } = useAuth();
  const [exp, setExp] = useState<any>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [directors, setDirectors] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: e }, { data: iv }, { data: d }, { data: dir }] = await Promise.all([
      supabase.from('v2_exporters').select('*').eq('id', id!).maybeSingle(),
      supabase.from('v2_invoices').select('id, invoice_number, invoice_amount, invoice_currency, status, maturity_date').eq('exporter_id', id!).order('created_at', { ascending: false }),
      supabase.from('company_documents').select('id, original_filename, status, uploaded_at, document_types(code, name)').eq('exporter_id', id!).order('uploaded_at', { ascending: false }),
      supabase.from('v2_exporter_directors').select('*').eq('exporter_id', id!).order('created_at', { ascending: true }),
    ]);
    setExp(e); setInvoices(iv ?? []); setDocs(d ?? []); setDirectors(dir ?? []);
  }, [id]);


  useEffect(() => { load(); }, [load]);
  if (!exp) return <div className="text-muted-foreground">Loading…</div>;

  const isSuperAdmin = has(roles, 'super_admin');
  const canBdReview = has(roles, 'originator') || isSuperAdmin;
  const canFinalApprove = has(roles, 'credit_officer') || isSuperAdmin;
  // Business Developers may approve individual documents; final onboarding
  // approval stays with Credit & Compliance.
  const canVerifyDoc = has(roles, 'credit_officer') || has(roles, 'originator') || isSuperAdmin;

  const submitted = !!exp.onboarding_submitted_at;
  const bdApproved = !!exp.bd_approved_at;
  const bdRejected = !!exp.bd_rejected_at;
  const isActive = exp.onboarding_status === 'active';

  const verifyDoc = async (docId: string, verified: boolean) => {
    await supabase.from('company_documents').update({
      status: verified ? 'verified' : 'pending_review',
      reviewed_by: verified ? user?.id : null,
      reviewed_at: verified ? new Date().toISOString() : null,
    }).eq('id', docId);
    load();
  };

  const review = async (stage: 'bd' | 'compliance', decision: 'approved' | 'returned', note?: string, overrideReason?: string) => {
    setBusy(true);
    const { error } = await supabase.rpc('record_onboarding_review', {
      p_exporter_id: exp.id,
      p_stage: stage,
      p_decision: decision,
      p_note: note ?? null,
      p_override_reason: overrideReason ?? null,
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Not recorded', description: error.message, variant: 'destructive' });
      return false;
    }
    setReason('');
    toast({ title: decision === 'approved' ? 'Review recorded' : 'Returned to exporter' });
    load();
    return true;
  };

  const bdApprove = () => review('bd', 'approved');
  const bdReject = () => {
    if (!reason.trim()) return toast({ title: 'Reason required', variant: 'destructive' });
    return review('bd', 'returned', reason);
  };
  const complianceReturn = () => {
    if (!reason.trim()) return toast({ title: 'Reason required', variant: 'destructive' });
    return review('compliance', 'returned', reason);
  };
  const finalApprove = async () => {
    const ok = await review('compliance', 'approved');
    if (ok) return;
    if (!isSuperAdmin) return;
    const overrideReason = window.prompt(
      'Four eyes rule blocked this approval. As Super Admin you may override where no second reviewer is available. Enter a written reason:'
    );
    if (!overrideReason || !overrideReason.trim()) return;
    await review('compliance', 'approved', undefined, overrideReason.trim());
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">{exp.company_name}</h1>
        <p className="text-sm text-muted-foreground">
          RC {exp.rc_number ?? '—'} · {exp.commodity ?? '—'} · Onboarding: <span className="text-accent">{exp.onboarding_status}</span>
        </p>
      </div>

      {exp.single_reviewer_approved && (
        <SingleReviewerBanner reason={exp.single_reviewer_reason} at={exp.single_reviewer_at} />
      )}



      <section className="card-elevated p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Onboarding review</h3>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stage ok={submitted} label="Submitted by exporter" />
          <Stage ok={bdApproved} warn={bdRejected} label={bdRejected ? 'Returned by BD' : 'Business Developer'} />
          <Stage ok={isActive} label="Credit & Compliance" />
        </div>

        {submitted && !bdApproved && !isActive && canBdReview && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="text-sm font-medium">Business Developer review</div>
            <BoardResolutionReviewStep exporterId={id!} canReview onChanged={load} />
            <div className="flex gap-2">
              <Button size="sm" onClick={bdApprove} disabled={busy}>Approve & pass to Credit</Button>
            </div>
            <Textarea placeholder="Reason to return to exporter" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button size="sm" variant="outline" onClick={bdReject} disabled={busy}>Return to exporter</Button>
          </div>
        )}

        {submitted && !isActive && (bdApproved || canFinalApprove) && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="text-sm font-medium">Credit &amp; Compliance final approval</div>
            {!bdApproved && canFinalApprove && (
              <p className="text-xs text-amber-400">
                The Business Developer has not signed off yet. Credit &amp; Compliance holds the final decision and may
                approve or return this application directly, superseding the Business Developer stage.
              </p>
            )}
            <BoardResolutionReviewStep exporterId={id!} canReview={canBdReview || canFinalApprove} onChanged={load} />
            {canFinalApprove && (
              <>
                <p className="text-xs text-muted-foreground">
                  Four eyes rule: this approval must be given by someone other than the Business Developer who approved the earlier stage.
                  The board resolution must be recorded before the exporter can be activated.
                </p>
                <Button size="sm" onClick={finalApprove} disabled={busy}>Approve &amp; activate exporter</Button>
                <Textarea placeholder="Reason to return to exporter" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button size="sm" variant="outline" onClick={complianceReturn} disabled={busy}>Return to exporter</Button>
              </>
            )}
          </div>
        )}


        {!submitted && (
          <p className="text-xs text-muted-foreground mt-3">Exporter has not submitted their onboarding pack yet.</p>
        )}
      </section>

      <ReviewChain key={`${exp.bd_approved_at ?? ''}-${exp.bd_rejected_at ?? ''}-${exp.onboarding_status}`} exporterId={id!} />



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card-elevated p-5 space-y-2 text-sm">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Company</h3>
          <Row label="Registration">{exp.company_registration_number ?? exp.rc_number ?? '—'}</Row>
          <Row label="Country">{exp.country_of_incorporation ?? '—'}</Row>
          <Row label="Incorporated">{exp.incorporation_date ?? '—'}</Row>
          <Row label="Tax ID">{exp.tax_id ?? '—'}</Row>
          <Row label="Email">{exp.email ?? '—'}</Row>
          <Row label="Phone">{exp.phone ?? '—'}</Row>
          <Row label="Address">{exp.address ?? '—'}</Row>
          <div className="border-t border-border my-2" />
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mt-3 mb-2">Director 1</h3>
          <Row label="Name">{exp.director_name ?? '—'}</Row>
          <Row label="ID">{[exp.director_id_type, exp.director_id_number].filter(Boolean).join(' · ') || '—'}</Row>
          <Row label="DOB">{exp.director_dob ?? '—'}</Row>
          <Row label="Nationality">{exp.director_nationality ?? '—'}</Row>
          <Row label="Address">{exp.director_address ?? '—'}</Row>
          {directors.map((d, i) => (
            <div key={d.id}>
              <div className="border-t border-border my-2" />
              <h3 className="text-sm uppercase tracking-wider text-muted-foreground mt-3 mb-2">
                Director {i + 2}{d.position ? ` · ${d.position}` : ''}
              </h3>
              <Row label="Name">{d.full_name}</Row>
              <Row label="ID">{[d.id_type, d.id_number].filter(Boolean).join(' · ') || '—'}</Row>
              <Row label="DOB">{d.dob ?? '—'}</Row>
              <Row label="Nationality">{d.nationality ?? '—'}</Row>
              <Row label="Email">{d.email ?? '—'}</Row>
              <Row label="Phone">{d.phone ?? '—'}</Row>
              <Row label="Address">{d.address ?? '—'}</Row>
            </div>
          ))}
        </section>


        <section className="card-elevated p-5">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Onboarding documents</h3>
          {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-t border-border pt-2">
                <div>
                  <button onClick={() => openDocument(d.id, 'company')} className="text-sm text-accent hover:underline inline-flex items-center gap-2">
                    <FileText className="h-4 w-4" /> {d.original_filename || d.document_types?.name}
                  </button>
                  <div className="text-xs text-muted-foreground">{d.document_types?.name ?? DOC_LABEL[d.document_types?.code] ?? '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${d.status === 'verified' ? 'bg-primary/20 text-accent' : 'bg-muted text-muted-foreground'}`}>
                    {d.status === 'verified' ? 'Verified' : 'Unverified'}
                  </span>
                  {canVerifyDoc && (d.status === 'verified'
                    ? <Button size="sm" variant="ghost" onClick={() => verifyDoc(d.id, false)}>Unverify</Button>
                    : <Button size="sm" onClick={() => verifyDoc(d.id, true)}>Verify</Button>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card-elevated p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Invoices ({invoices.length})</h3>
        <div className="space-y-2 text-sm">
          {invoices.map((i) => (
            <Link key={i.id} to={`/app/invoices/${i.id}`} className="flex justify-between border-t border-border pt-2 hover:text-accent">
              <span>{i.invoice_number}</span>
              <span>{i.invoice_currency} {Number(i.invoice_amount).toLocaleString()}</span>
              <span className="text-muted-foreground">{INVOICE_STATUS_LABEL[i.status]}</span>
            </Link>
          ))}
          {invoices.length === 0 && <p className="text-muted-foreground">No invoices</p>}
        </div>
      </section>

      <div>
        <Button variant="outline" size="sm" onClick={() => setShowAudit((s) => !s)}>
          {showAudit ? 'Hide company audit trail' : 'Show company audit trail'}
        </Button>
        {showAudit && (
          <div className="mt-4">
            <AuditLogTable
              exporterId={id}
              entityTypes={['company_document', 'board_resolution', 'exporter']}
              title="Company audit trail"
              csvName="company-audit"
            />
          </div>
        )}
      </div>

    </div>

  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
}
function Stage({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : warn ? XCircle : Clock;
  const tone = ok ? 'text-accent' : warn ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className={`flex items-center gap-2 rounded border border-border p-3 ${tone}`}>
      <Icon className="h-4 w-4" /><span className="text-sm">{label}</span>
    </div>
  );
}
