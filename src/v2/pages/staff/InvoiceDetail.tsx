import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuditLogTable from '@/v2/components/AuditLogTable';
import { SingleReviewerBanner } from '@/v2/components/ReviewChain';

import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';
import { INVOICE_STATUS_LABEL, canApprove, canVerify, has } from '@/v2/roles';
import { logAudit } from '@/v2/audit';
import { openDocument, invoiceDocPath } from '@/v2/lib/documents';
import DocumentReviewPanel, { InspectionOverrideCard, useInvoiceDocuments } from '@/v2/components/invoice/DocumentReviewPanel';
import CompanyAuthorityPanel, { AuthorityFlags } from '@/v2/components/invoice/CompanyAuthorityPanel';
import MaturityDateCard from '@/v2/components/invoice/MaturityDateCard';
import GeneratedInstrumentsPanel from '@/v2/components/invoice/GeneratedInstrumentsPanel';
import { useInstruments } from '@/v2/lib/instruments';
import { CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

type Doc = { id: string; doc_type: string; file_url: string; file_name: string | null; verified: boolean; uploaded_by: string | null; uploaded_at: string };

const DOC_TYPES = [
  'pro_forma', 'commercial_invoice', 'bill_of_lading', 'quality_cert',
  'deed_of_assignment', 'notice_of_assignment', 'tripartite', 'kyc', 'other',
];

const DOC_LABEL: Record<string, string> = {
  pro_forma: 'Pro forma invoice', commercial_invoice: 'Commercial invoice',
  bill_of_lading: 'Bill of lading', quality_cert: 'Quality certificate',
  deed_of_assignment: 'Deed of Assignment', notice_of_assignment: 'Notice of Assignment',
  tripartite: 'Tripartite Domiciliation Agreement', kyc: 'KYC', other: 'Other',
};

const fmt = (n: number, cur = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur }).format(n);

export default function StaffInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, roles } = useAuth();
  const nav = useNavigate();
  const [inv, setInv] = useState<any>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [buyer, setBuyer] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [authority, setAuthority] = useState<AuthorityFlags | null>(null);

  const load = useCallback(async () => {
    const { data: i } = await supabase.from('v2_invoices').select('*, v2_exporters(id, company_name), v2_buyers(*)').eq('id', id!).maybeSingle();
    setInv(i); setBuyer((i as any)?.v2_buyers ?? null);
    const [{ data: d }, { data: m }, { data: dc }, { data: al }] = await Promise.all([
      supabase.from('v2_invoice_documents').select('*').eq('invoice_id', id!).order('uploaded_at', { ascending: false }),
      supabase.from('v2_money_movements').select('*').eq('invoice_id', id!).order('recorded_at', { ascending: false }),
      supabase.from('v2_decisions').select('*').eq('invoice_id', id!).order('created_at', { ascending: false }),
      supabase.from('v2_audit_log').select('*').eq('invoice_id', id!).order('created_at', { ascending: false }),
    ]);
    setDocs((d ?? []) as any); setMovements(m ?? []); setDecisions(dc ?? []); setAudit(al ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const docState = useInvoiceDocuments(id, !!inv?.inspection_required);
  const instruments = useInstruments(id);

  if (!inv) return <div className="text-muted-foreground">Loading…</div>;

  const advance = Number(inv.invoice_amount) * Number(inv.advance_rate) / 100;
  const fee = Number(inv.invoice_amount) * Number(inv.fee_percent) / 100;
  const residual = Number(inv.invoice_amount) - advance - fee;

  const hasVerifiedDoc = (t: string) => docs.some((d) => d.doc_type === t && d.verified);
  const instrumentSigned = (code: string) => instruments.rows.find((r) => r.code === code)?.state === 'signed';
  const gate = {
    deed: instrumentSigned('deed_of_assignment'),
    tripartite: instrumentSigned('domiciliation_instruction'),
    noa: instrumentSigned('notice_of_assignment'),
    buyerClear: buyer?.credit_status === 'clear' && buyer?.sanctions_status === 'clear',
    bol: hasVerifiedDoc('bill_of_lading') || docState.stage1Complete,
  };
  const allGatesPass = Object.values(gate).every(Boolean);

  const originType = docState.types.find((t) => t.code === 'certificate_of_origin');
  const originVerified = !!originType && docState.currentFor(originType.id)?.status === 'verified';

  const noOutstandingRequests = docState.outstandingRequests.length === 0;
  const authorityOk = !!authority && authority.resolutionVerified && authority.inDate && authority.withinHeadroom;
  const reviewGatePass = docState.stage1Complete && authorityOk && noOutstandingRequests;
  const disbursementGatePass = originVerified && instruments.allSigned && allGatesPass;
  const disbursementBlockers = [
    !originVerified && 'Certificate of origin must be verified',
    !instruments.allSigned && 'All three instruments must be signed with certificates of completion stored',
    !allGatesPass && 'The five point funding control gate is not satisfied',
  ].filter(Boolean) as string[];

  const reviewBlockers = [
    !docState.stage1Complete && `Stage 1 documents ${docState.stage1Verified} of ${docState.stage1Required.length} verified`,
    !noOutstandingRequests && `${docState.outstandingRequests.length} document request outstanding`,
    !authorityOk && 'Board resolution must be verified, in date and within headroom',
  ].filter(Boolean) as string[];

  
  const status = inv.status as string;
  const canReview = canVerify(roles);
  const isSuperAdmin = has(roles, 'super_admin');

  const approveForFunding = async (overrideReason?: string) => {
    if (!allGatesPass) {
      toast({ title: 'Gate not met', description: 'The five point funding control gate is not satisfied.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('approve_invoice_for_funding', {
      p_invoice_id: id!,
      p_override_reason: overrideReason ?? null,
    });
    setBusy(false);
    if (error) {
      if (!overrideReason && isSuperAdmin && /different reviewer/i.test(error.message)) {
        const r = window.prompt(
          'Segregation of duties blocked this approval — you verified documents on this application. As Super Admin you may override where no second reviewer is available. Enter a written reason:'
        );
        if (r && r.trim()) return approveForFunding(r.trim());
        return;
      }
      toast({ title: 'Not approved', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Approved for funding' });
    load();
  };

  const transition = async (to: string, action: string, decisionType?: string) => {
    if (['returned_for_revision', 'rejected'].includes(to) && !reason.trim()) {
      toast({ title: 'Reason required', variant: 'destructive' }); return;
    }
    if (to === 'verified' && !reviewGatePass) {
      toast({ title: 'Cannot advance yet', description: reviewBlockers.join('. '), variant: 'destructive' }); return;
    }
    if (to === 'funded' && !disbursementGatePass) {
      toast({ title: 'Cannot disburse yet', description: disbursementBlockers.join('. '), variant: 'destructive' }); return;
    }
    setBusy(true);
    const patch: any = { status: to };
    if (to === 'verified') patch.verified_by = user?.id;
    if (to === 'funded') { patch.funded_date = new Date().toISOString().slice(0, 10); }
    if (to === 'settled') { patch.settled_date = new Date().toISOString().slice(0, 10); }
    const { error } = await supabase.from('v2_invoices').update(patch).eq('id', id!);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setBusy(false); return; }
    if (decisionType) {
      await supabase.from('v2_decisions').insert({ invoice_id: id!, decision_type: decisionType as any, reason: reason || null, actor_user_id: user?.id });
    }
    await logAudit({ invoice_id: id!, action, from_status: status as any, to_status: to as any, note: reason || null });
    setReason(''); setBusy(false); load();
    toast({ title: 'Updated' });
  };


  const upload = async (e: React.ChangeEvent<HTMLInputElement>, doc_type: string) => {
    const file = e.target.files?.[0]; if (!file) return;
    const path = invoiceDocPath(inv.exporter_id, id!, file.name);
    const { error: upErr } = await supabase.storage.from('veloxis-documents').upload(path, file);
    if (upErr) { toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' }); return; }
    await supabase.from('v2_invoice_documents').insert({ invoice_id: id!, doc_type: doc_type as any, file_url: path, file_name: file.name, uploaded_by: user?.id });
    await logAudit({ invoice_id: id!, action: 'document_uploaded', metadata: { doc_type } });
    load();
  };

  const verifyDoc = async (docId: string, verified: boolean) => {
    await supabase.from('v2_invoice_documents').update({ verified, verified_by: verified ? user?.id : null, verified_at: verified ? new Date().toISOString() : null }).eq('id', docId);
    await logAudit({ invoice_id: id!, action: verified ? 'document_verified' : 'document_unverified' });
    load();
  };

  const recordMovement = async (type: string, amount: number, note?: string) => {
    if (!amount) return;
    await supabase.from('v2_money_movements').insert({ invoice_id: id!, type: type as any, amount, currency: inv.invoice_currency, recorded_by: user?.id, note: note ?? null });
    await logAudit({ invoice_id: id!, action: `movement_${type}`, metadata: { amount } });
    load();
  };

  return (
    <div className="space-y-6">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Invoice {inv.invoice_number}</h1>
          <p className="text-sm text-muted-foreground">
            {inv.v2_exporters?.company_name} → {buyer?.company_name ?? '—'} · Status: <span className="text-accent">{INVOICE_STATUS_LABEL[status] ?? status}</span>
          </p>
        </div>
      </div>

      {status === 'information_requested' && (
        <div className="card-elevated p-4 border-amber-500/50 bg-amber-500/10 text-sm">
          The decision clock is paused while we wait for {docState.outstandingRequests.length} requested document{docState.outstandingRequests.length === 1 ? '' : 's'}.
          It resumes automatically when the last one arrives.
        </div>
      )}

      {['returned_for_revision', 'rejected'].includes(status) && decisions[0] && (
        <div className="card-elevated p-4 border-destructive/60 bg-destructive/10">
          <div className="text-sm font-medium text-destructive">{status === 'rejected' ? 'Rejected' : 'Returned for revision'}</div>
          <div className="text-sm mt-1">{decisions[0].reason}</div>
        </div>
      )}

      {inv.single_reviewer_approved && (
        <SingleReviewerBanner reason={inv.single_reviewer_reason} at={inv.single_reviewer_at} />
      )}

      <section className="card-elevated p-5">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Review chain</h3>
        <div className="space-y-2 text-sm">
          <Row label="Documents verified by">{docState.people[inv.verified_by ?? ''] ?? (inv.verified_by ? inv.verified_by.slice(0, 8) : '—')}</Row>
          <Row label="Approved for funding by">{docState.people[inv.approved_by ?? ''] ?? (inv.approved_by ? inv.approved_by.slice(0, 8) : '—')}</Row>
          <div className="border-t border-border my-2" />
          {decisions.length === 0 && <p className="text-muted-foreground text-xs">No decisions recorded yet.</p>}
          {[...decisions].reverse().map((d) => (
            <div key={d.id} className="border-t border-border pt-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{d.decision_type}</span>
                <span className="text-muted-foreground">
                  {docState.people[d.actor_user_id ?? ''] ?? 'Unknown'} · {new Date(d.created_at).toLocaleString('en-GB')}
                </span>
              </div>
              {d.reason && <p className="text-muted-foreground mt-1">{d.reason}</p>}
            </div>
          ))}
        </div>
      </section>





      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="audit" className="space-y-6 mt-4">
              <AuditLogTable invoiceId={id} title="Full audit trail" csvName="application-audit" />
            </TabsContent>


            <TabsContent value="overview" className="space-y-6 mt-4">
              <section className="card-elevated p-5">
                <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Five point funding gate</h3>
                <ul className="space-y-2 text-sm">
                  {[
                    ['Deed of assignment signed by both parties', gate.deed],
                    ['Domiciliation instruction signed', gate.tripartite],
                    ['Notice of assignment signed', gate.noa],
                    ['Buyer credit clear and sanctions clear', gate.buyerClear],
                    ['Stage 1 shipping documents verified', gate.bol],
                    ['Certificate of origin verified', originVerified],
                  ].map(([label, ok]) => (
                    <li key={label as string} className="flex items-center gap-2">
                      {ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      <span className={ok ? '' : 'text-muted-foreground'}>{label as string}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <CompanyAuthorityPanel
                exporterId={inv.exporter_id}
                signatoryId={inv.signatory_id ?? null}
                invoiceExposure={Number(inv.gross_invoice_value ?? inv.invoice_amount ?? 0)}
                onFlags={setAuthority}
              />

              <section className="card-elevated p-5 space-y-3">
                <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Legacy documents</h3>
                {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between border-t border-border pt-3">
                    <div>
                      <button onClick={() => openDocument(d.id, 'invoice')} className="text-sm text-accent hover:underline">{d.file_name || d.doc_type}</button>
                      <div className="text-xs text-muted-foreground">{DOC_LABEL[d.doc_type] ?? d.doc_type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${d.verified ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>{d.verified ? 'Verified' : 'Unverified'}</span>
                      {canReview && (
                        d.verified
                          ? <Button size="sm" variant="ghost" onClick={() => verifyDoc(d.id, false)}>Unverify</Button>
                          : <Button size="sm" onClick={() => verifyDoc(d.id, true)}>Verify</Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-border">
                  <Label>Upload document</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DOC_TYPES.map((t) => (
                      <label key={t} className="text-xs px-3 py-2 border border-border rounded cursor-pointer hover:bg-muted/20">
                        {DOC_LABEL[t]}
                        <input type="file" className="hidden" onChange={(e) => upload(e, t)} />
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card-elevated p-5 space-y-3">
                <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Money movements</h3>
                {movements.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
                {movements.map((m) => (
                  <div key={m.id} className="flex justify-between text-sm border-t border-border pt-2">
                    <span>{m.type.replace('_', ' ')}</span>
                    <span className="tabular-nums">{m.currency} {Number(m.amount).toLocaleString()}</span>
                    <span className="text-muted-foreground">{new Date(m.recorded_at).toLocaleDateString()}</span>
                  </div>
                ))}
                {canApprove(roles) && (status === 'approved' || status === 'funded' || status === 'monitoring') && (
                  <MovementForm onSubmit={recordMovement} advance={advance} residual={residual} amount={Number(inv.invoice_amount)} />
                )}
              </section>

              <section className="card-elevated p-5">
                <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Audit log</h3>
                <div className="space-y-2 text-xs">
                  {audit.map((a) => (
                    <div key={a.id} className="flex justify-between border-t border-border pt-2">
                      <span>{a.action} {a.from_status && `· ${a.from_status} → ${a.to_status}`} {a.metadata?.override && <span className="text-warning">[override]</span>}</span>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {audit.length === 0 && <p className="text-muted-foreground">No entries.</p>}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6 mt-4">
              <InspectionOverrideCard
                invoiceId={id!}
                required={!!inv.inspection_required}
                reason={inv.inspection_override_reason ?? null}
                canOverride={canReview}
                onChanged={load}
              />
              <GeneratedInstrumentsPanel
                invoiceId={id!}
                invoice={inv}
                canGenerate={canReview}
                canSend={canApprove(roles) || isSuperAdmin}
                onChanged={load}
              />
              <DocumentReviewPanel
                invoiceId={id!}
                exporterId={inv.exporter_id}
                state={docState}
                canReview={canReview}
                isSuperAdmin={isSuperAdmin}
                currentUserId={user?.id}
                onChanged={load}
              />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6">
          <section className="card-elevated p-5 space-y-2 text-sm">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Economics</h3>
            <Row label="Amount">{fmt(Number(inv.invoice_amount), inv.invoice_currency)}</Row>
            <Row label="Advance rate">{inv.advance_rate}%</Row>
            <Row label="Fee">{inv.fee_percent}%</Row>
            <Row label="Terms">{inv.terms_days} days</Row>
            <div className="border-t border-border my-2" />
            <Row label="Advance">{fmt(advance, inv.invoice_currency)}</Row>
            <Row label="Fee">{fmt(fee, inv.invoice_currency)}</Row>
            <Row label="Residual">{fmt(residual, inv.invoice_currency)}</Row>
            <div className="border-t border-border my-2" />
            <Row label="Shipment">{inv.shipment_date ?? '—'}</Row>
            <Row label="Decision due">{inv.decision_due_at ? new Date(inv.decision_due_at).toLocaleString('en-GB') : '—'}</Row>
          </section>

          <MaturityDateCard
            invoiceId={id!}
            maturityDate={inv.maturity_date}
            overrideBy={inv.maturity_date_overridden_by}
            overrideAt={inv.maturity_date_overridden_at}
            overrideReason={inv.maturity_date_override_reason}
            canAdjust={canReview}
            people={docState.people}
            onChanged={load}
          />

          <section className="card-elevated p-5 space-y-3">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Actions</h3>
            {(status === 'submitted' || status === 'information_requested') && canReview && (
              <>
                {reviewBlockers.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {reviewBlockers.map((b) => <li key={b}>· {b}</li>)}
                  </ul>
                )}
                <Button className="w-full" disabled={busy || !reviewGatePass} onClick={() => transition('verified', 'verified', 'verified')}>
                  {reviewGatePass ? 'Mark verified' : 'Review checks not met'}
                </Button>
                <Textarea placeholder="Reason to return" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => transition('returned_for_revision', 'returned_for_revision', 'returned')}>Return for revision</Button>
              </>
            )}
            {status === 'verified' && canApprove(roles) && (
              <>
                <p className="text-xs text-muted-foreground">
                  Segregation of duties: the approver cannot be a person who verified this application's documents.
                </p>
                <Button className="w-full" disabled={busy || !allGatesPass} onClick={() => approveForFunding()}>
                  {allGatesPass ? 'Approve for funding' : 'Gate not met'}
                </Button>
                <Textarea placeholder="Reason to reject" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => transition('rejected', 'rejected', 'rejected')}>Reject</Button>
              </>
            )}

            {status === 'approved' && canApprove(roles) && (
              <>
                {!disbursementGatePass && (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {disbursementBlockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
                <Button className="w-full" disabled={busy || !disbursementGatePass} onClick={() => transition('funded', 'funded', 'funded')}>
                  {disbursementGatePass ? 'Mark funded' : 'Disbursement gate not satisfied'}
                </Button>

              </>
            )}
            {status === 'funded' && canApprove(roles) && (
              <Button className="w-full" disabled={busy} onClick={() => transition('monitoring', 'monitoring')}>Move to monitoring</Button>
            )}
            {(status === 'monitoring' || status === 'funded') && canApprove(roles) && (
              <Button className="w-full" disabled={busy} onClick={() => transition('settled', 'settled', 'settled')}>Mark settled</Button>
            )}
            {status === 'draft' && (
              <Button className="w-full" disabled={busy} onClick={() => transition('submitted', 'submitted')}>Submit for review</Button>
            )}
          </section>

          {buyer && (
            <section className="card-elevated p-5 space-y-2 text-sm">
              <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Buyer</h3>
              <Row label="Name"><Link to={`/app/buyers/${buyer.id}`} className="text-accent hover:underline">{buyer.company_name}</Link></Row>
              <Row label="Country">{buyer.country ?? '—'}</Row>
              <Row label="Credit"><StatusPill s={buyer.credit_status} /></Row>
              <Row label="Sanctions"><StatusPill s={buyer.sanctions_status} /></Row>
              <Row label="Limit">{buyer.credit_limit ? fmt(Number(buyer.credit_limit)) : '—'}</Row>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span>{children}</span></div>;
}
function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = { clear: 'bg-success/20 text-success', flagged: 'bg-destructive/20 text-destructive', pending: 'bg-muted text-muted-foreground' };
  return <span className={`text-xs px-2 py-0.5 rounded ${map[s] ?? ''}`}>{s}</span>;
}

function MovementForm({ onSubmit, advance, residual, amount }: { onSubmit: (t: string, a: number, n?: string) => void; advance: number; residual: number; amount: number }) {
  const [type, setType] = useState('advance_out');
  const [amt, setAmt] = useState('');
  return (
    <div className="pt-3 border-t border-border space-y-2">
      <Label className="text-xs">Record movement</Label>
      <div className="flex gap-2">
        <Select value={type} onValueChange={(v) => { setType(v); setAmt(String(v === 'advance_out' ? advance : v === 'settlement_in' ? amount : residual)); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="advance_out">Advance out</SelectItem>
            <SelectItem value="settlement_in">Settlement in</SelectItem>
            <SelectItem value="residual_out">Residual out</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" step="0.01" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <Button onClick={() => { onSubmit(type, Number(amt)); setAmt(''); }}>Record</Button>
      </div>
    </div>
  );
}
