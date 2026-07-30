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
  const [invoices, setInvoices] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [directors, setDirectors] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: e }, { data: iv }, { data: d }, { data: dir }] = await Promise.all([
      supabase.from('v2_exporters').select('*').eq('id', id!).maybeSingle(),
      supabase.from('v2_invoices').select('id, invoice_number, invoice_amount, invoice_currency, status, maturity_date').eq('exporter_id', id!).order('created_at', { ascending: false }),
      supabase.from('v2_exporter_documents').select('*').eq('exporter_id', id!).order('uploaded_at', { ascending: false }),
      supabase.from('v2_exporter_directors').select('*').eq('exporter_id', id!).order('created_at', { ascending: true }),
    ]);
    setExp(e); setInvoices(iv ?? []); setDocs(d ?? []); setDirectors(dir ?? []);
  }, [id]);


  useEffect(() => { load(); }, [load]);
  if (!exp) return <div className="text-muted-foreground">Loading…</div>;

  const canBdReview = has(roles, 'originator') || has(roles, 'super_admin');
  const canFinalApprove = has(roles, 'credit_officer') || has(roles, 'super_admin');
  const canVerifyDoc = has(roles, 'credit_officer') || has(roles, 'super_admin');

  const submitted = !!exp.onboarding_submitted_at;
  const bdApproved = !!exp.bd_approved_at;
  const bdRejected = !!exp.bd_rejected_at;
  const isActive = exp.onboarding_status === 'active';

  const verifyDoc = async (docId: string, verified: boolean) => {
    await supabase.from('v2_exporter_documents').update({
      verified, verified_by: verified ? user?.id : null, verified_at: verified ? new Date().toISOString() : null,
    }).eq('id', docId);
    load();
  };

  const bdApprove = async () => {
    setBusy(true);
    const { error } = await supabase.from('v2_exporters').update({
      bd_approved_at: new Date().toISOString(), bd_approved_by: user?.id,
      bd_rejected_at: null, bd_rejection_reason: null,
    }).eq('id', exp.id);
    setBusy(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    await logAudit({ action: 'exporter_bd_approved', metadata: { exporter_id: exp.id } });
    toast({ title: 'Approved — awaiting Credit & Compliance' });
    load();
  };
  const bdReject = async () => {
    if (!reason.trim()) return toast({ title: 'Reason required', variant: 'destructive' });
    setBusy(true);
    const { error } = await supabase.from('v2_exporters').update({
      bd_rejected_at: new Date().toISOString(), bd_rejection_reason: reason,
      bd_approved_at: null, bd_approved_by: null,
    }).eq('id', exp.id);
    setBusy(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    await logAudit({ action: 'exporter_bd_rejected', metadata: { exporter_id: exp.id, reason } });
    setReason(''); toast({ title: 'Returned to exporter' }); load();
  };
  const finalApprove = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('v2_exporters').update({
      onboarding_status: 'active',
      kyb_status: 'verified', kyb_verified_at: now, kyb_verified_by: user?.id,
      kyc_status: 'verified', kyc_verified_at: now, kyc_verified_by: user?.id,
    }).eq('id', exp.id);
    setBusy(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    await logAudit({ action: 'exporter_final_approved', metadata: { exporter_id: exp.id } });
    toast({ title: 'Exporter activated' }); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">{exp.company_name}</h1>
        <p className="text-sm text-muted-foreground">
          RC {exp.rc_number ?? '—'} · {exp.commodity ?? '—'} · Onboarding: <span className="text-accent">{exp.onboarding_status}</span>
        </p>
      </div>

      <section className="card-elevated p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Onboarding review</h3>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stage ok={submitted} label="Submitted by exporter" />
          <Stage ok={bdApproved} warn={bdRejected} label={bdRejected ? 'Returned by BD' : 'Business Developer'} />
          <Stage ok={isActive} label="Credit & Compliance" />
        </div>

        {submitted && !bdApproved && !isActive && canBdReview && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <div className="text-sm font-medium">Business Developer review</div>
            <div className="flex gap-2">
              <Button size="sm" onClick={bdApprove} disabled={busy}>Approve & pass to Credit</Button>
            </div>
            <Textarea placeholder="Reason to return to exporter" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button size="sm" variant="outline" onClick={bdReject} disabled={busy}>Return to exporter</Button>
          </div>
        )}

        {bdApproved && !isActive && canFinalApprove && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <div className="text-sm font-medium">Credit &amp; Compliance final approval</div>
            <Button size="sm" onClick={finalApprove} disabled={busy}>Approve & activate exporter</Button>
          </div>
        )}

        {!submitted && (
          <p className="text-xs text-muted-foreground mt-3">Exporter has not submitted their onboarding pack yet.</p>
        )}
      </section>

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
                    <FileText className="h-4 w-4" /> {d.file_name || d.doc_type}
                  </button>
                  <div className="text-xs text-muted-foreground">{DOC_LABEL[d.doc_type] ?? d.doc_type}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${d.verified ? 'bg-primary/20 text-accent' : 'bg-muted text-muted-foreground'}`}>
                    {d.verified ? 'Verified' : 'Unverified'}
                  </span>
                  {canVerifyDoc && (d.verified
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

      <AuditLogTable
        exporterId={id}
        entityTypes={['company_document', 'board_resolution', 'exporter']}
        title="Company audit trail"
        csvName="company-audit"
      />
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
