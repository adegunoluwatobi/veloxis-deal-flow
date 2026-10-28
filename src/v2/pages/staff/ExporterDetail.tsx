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
import { KybReviewSections, KybPackButtons, AssignBd } from '@/v2/components/KybReview';
import { ApplicationActivity, SendPack } from '@/v2/components/ApplicationActivity';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


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
  const [activityRefresh, setActivityRefresh] = useState(0);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [requiredTypes, setRequiredTypes] = useState<any[]>([]);
  const [directors, setDirectors] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastReturnStage, setLastReturnStage] = useState<string | null>(null);
  const [lastReturn, setLastReturn] = useState<{ stage: string; decision: string; note: string | null; created_at: string } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: e }, { data: iv }, { data: d }, { data: dir }, { data: rev }, { data: rt }] = await Promise.all([
      supabase.from('v2_exporters').select('*').eq('id', id).maybeSingle(),
      supabase.from('v2_invoices').select('id, invoice_number, invoice_amount, invoice_currency, status, maturity_date').eq('exporter_id', id).order('created_at', { ascending: false }),
      supabase.from('company_documents').select('id, original_filename, status, uploaded_at, reviewed_at, rejection_reason, document_type_id, person_id, issue_date, document_types(code, label, sort_order)').eq('exporter_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('v2_exporter_directors').select('*').eq('exporter_id', id).order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
      supabase.from('onboarding_reviews').select('stage, decision, note, created_at').eq('exporter_id', id).order('created_at', { ascending: false }).limit(1),
      supabase.from('document_types').select('id, label, sort_order').eq('active', true).eq('level', 'company').eq('requirement', 'mandatory').order('sort_order'),
    ]);
    setExp(e); setInvoices(iv ?? []); setDocs(d ?? []); setDirectors(dir ?? []); setRequiredTypes(rt ?? []);
    const latest = rev?.[0] as any;
    setLastReturnStage(latest && latest.decision !== 'approved' ? latest.stage : null);
    setLastReturn(latest && latest.decision !== 'approved' ? latest : null);
  }, [id]);



  useEffect(() => { load(); }, [load]);
  if (!exp || !id) return <div className="text-muted-foreground">Loading…</div>;

  const isSuperAdmin = has(roles, 'super_admin');
  const canBdReview = has(roles, 'originator') || isSuperAdmin;
  const canFinalApprove = has(roles, 'credit_officer') || isSuperAdmin;
  // Document approval / rejection sits with Credit & Compliance (and Super Admin).
  const canVerifyDoc = has(roles, 'credit_officer') || isSuperAdmin;

  const submitted = !!exp.onboarding_submitted_at;
  const bdApproved = !!exp.bd_approved_at;
  const bdRejected = !!exp.bd_rejected_at;
  const isActive = exp.onboarding_status === 'active';

  // Credit & Compliance may not activate an exporter until every mandatory
  // company document has been approved.
  const verifiedTypeIds = new Set(docs.filter((d) => d.status === 'verified').map((d) => d.document_type_id));
  const outstandingDocs = requiredTypes.filter((t) => !verifiedTypeIds.has(t.id));
  const docsComplete = outstandingDocs.length === 0;


  const setDocStatus = async (docId: string, status: 'verified' | 'rejected' | 'pending', reason?: string) => {
    setBusy(true);
    const { error } = await supabase.from('company_documents').update({
      status,
      rejection_reason: status === 'rejected' ? (reason ?? null) : null,
      reviewed_by: status === 'pending' ? null : user?.id,
      reviewed_at: status === 'pending' ? null : new Date().toISOString(),
    }).eq('id', docId);
    setBusy(false);
    if (error) return toast({ title: 'Could not update document', description: error.message, variant: 'destructive' });
    toast({
      title: status === 'verified' ? 'Document approved' : status === 'rejected' ? 'Document rejected' : 'Review reset',
      description: status === 'rejected' ? 'The exporter can see your reason and re-upload.' : undefined,
    });
    load();
  };

  const reopenApplication = async () => {
    const why = window.prompt('Reopen this approved application for correction. Enter the reason the exporter will see:');
    if (!why || !why.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc('record_onboarding_review', {
      p_exporter_id: exp.id, p_stage: 'compliance', p_decision: 'returned', p_note: why.trim(), p_override_reason: null,
    });
    setBusy(false);
    if (error) return toast({ title: 'Could not reopen', description: error.message, variant: 'destructive' });
    toast({ title: 'Application reopened', description: 'The exporter can edit and re-submit.' });
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
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl">{exp.company_name}</h1>
          <p className="text-sm text-muted-foreground">
            RC {exp.company_registration_number ?? exp.rc_number ?? '—'} · {exp.commodity ?? '—'} · Onboarding: <span className="text-accent">{exp.onboarding_status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2"><KybPackButtons exporterId={id} />{isActive && <SendPack exporterId={id} companyName={exp.company_name} onSent={() => setActivityRefresh(v => v + 1)} />}</div>
      </div>
      {isSuperAdmin && <AssignBd exporterId={id} current={exp.created_by} onSaved={load} />}

      <Tabs defaultValue="application" onValueChange={value => { if (value === 'activity') setActivityRefresh(v => v + 1); }}>
      <TabsList><TabsTrigger value="application">Application</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
      <TabsContent value="application" className="space-y-6 mt-6">

      {exp.single_reviewer_approved && (
        <SingleReviewerBanner reason={exp.single_reviewer_reason} at={exp.single_reviewer_at} />
      )}



      <section className="card-elevated p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Onboarding review</h3>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stage ok={submitted} label="Submitted by exporter" />
          <Stage
            ok={bdApproved || isActive}
            warn={bdRejected && lastReturnStage === 'bd'}
            label={
              bdRejected && lastReturnStage === 'bd'
                ? 'Returned by BD'
                : !bdApproved && isActive
                  ? 'Business Developer (superseded)'
                  : 'Business Developer'
            }
          />

          <Stage
            ok={isActive}
            warn={bdRejected && lastReturnStage === 'compliance'}
            label={bdRejected && lastReturnStage === 'compliance' ? 'Returned by Credit & Compliance' : 'Credit & Compliance'}
          />

        </div>

        {lastReturn && !isActive && (
          <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="font-medium text-destructive">
              Returned to exporter by {lastReturn.stage === 'bd' ? 'Business Developer' : 'Credit & Compliance'}
              {' · '}{new Date(lastReturn.created_at).toLocaleString('en-GB')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lastReturn.note?.trim() || 'No reason recorded.'}
            </p>
            {docs.some((d) => d.status === 'rejected') && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
                {docs.filter((d) => d.status === 'rejected').map((d) => (
                  <li key={d.id}>
                    <span className="text-foreground">{d.document_types?.label ?? d.original_filename}:</span>{' '}
                    {d.rejection_reason || 'No reason given'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}


        {submitted && !bdApproved && !isActive && canBdReview && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="text-sm font-medium">Business Developer review</div>
            <BoardResolutionReviewStep exporterId={id} canReview onChanged={load} />
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
                The Business Developer has not signed off yet. Credit &amp; Compliance holds the final decision: approving
                here will mark the Business Developer stage as superseded and the audit trail will record that no
                separate Business Developer sign-off took place.
              </p>
            )}

            <BoardResolutionReviewStep exporterId={id} canReview={canBdReview || canFinalApprove} onChanged={load} />
            {canFinalApprove && (
              <>
                <p className="text-xs text-muted-foreground">
                  Four eyes rule: this approval must be given by someone other than the Business Developer who approved the earlier stage.
                  The board resolution must be recorded before the exporter can be activated.
                </p>
                {!docsComplete && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                    <div className="font-medium text-amber-400">
                      All onboarding documents must be approved before you can activate this exporter
                    </div>
                    <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                      {outstandingDocs.map((t) => (<li key={t.id}>{t.label}</li>))}
                    </ul>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={finalApprove}
                  disabled={busy || !docsComplete}
                  title={!docsComplete ? 'Approve every required onboarding document first' : undefined}
                >
                  Approve &amp; activate exporter
                </Button>
                <Textarea placeholder="Reason to return to exporter" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button size="sm" variant="outline" onClick={complianceReturn} disabled={busy}>Return to exporter</Button>
              </>
            )}
          </div>
        )}


        {isActive && (
          <div className="mt-4 border-t border-border pt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              This exporter is approved and their company details are locked. Credit &amp; Compliance or a Super Admin can
              reopen the application if something needs correcting.
            </p>
            {(canFinalApprove || isSuperAdmin) && (
              <Button size="sm" variant="outline" onClick={reopenApplication} disabled={busy}>
                Reopen application for correction
              </Button>
            )}
          </div>
        )}

        {!submitted && (
          <p className="text-xs text-muted-foreground mt-3">Exporter has not submitted their onboarding pack yet.</p>
        )}
      </section>

      <ReviewChain key={`${exp.bd_approved_at ?? ''}-${exp.bd_rejected_at ?? ''}-${exp.onboarding_status}`} exporterId={id} />



      <KybReviewSections
        exp={exp}
        people={directors}
        docs={docs}
        canVerifyDoc={canVerifyDoc}
        busy={busy}
        onSetStatus={setDocStatus}
      />


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

      </TabsContent>
      <TabsContent value="activity" className="mt-6"><ApplicationActivity exporterId={id} inviteId={exp.invite_id} refresh={activityRefresh} /></TabsContent>
      </Tabs>

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
