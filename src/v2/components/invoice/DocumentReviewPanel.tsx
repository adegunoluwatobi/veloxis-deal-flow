import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getDocumentUrl } from '@/v2/lib/documents';
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, FilePlus2, History, ShieldAlert } from 'lucide-react';

export type DocType = {
  id: string; code: string; label: string; stage: number | null;
  requirement: string; level: string; sort_order: number | null; generated?: boolean | null;
};
export type InvoiceDoc = {
  id: string; invoice_id: string; document_type_id: string; storage_path: string;
  original_filename: string | null; version: number | null; superseded_by: string | null;
  uploaded_by: string | null; uploaded_at: string; status: string;
  rejection_reason: string | null; reviewed_by: string | null; reviewed_at: string | null;
};
export type DocRequest = {
  id: string; invoice_id: string; document_type_id: string; requested_by: string | null;
  requested_at: string; reason: string; due_date: string | null; status: string;
  fulfilled_by_document_id: string | null; withdrawn_at: string | null;
};

const COMPLIANCE_OPTIONAL = new Set([
  'phytosanitary', 'fumigation', 'health_certificate', 'catch_certificate',
  'assay_certificate', 'mineral_permit', 'eudr_statement', 'textile_report',
]);

export const REJECT_PRESETS = [
  'Illegible or poor quality',
  'Wrong document type',
  'Details do not match the invoice',
  'Expired or out of date',
  'Incomplete or missing pages',
  'Not signed or stamped',
  'Other',
];

export type DocumentsState = {
  loading: boolean;
  types: DocType[];
  docs: InvoiceDoc[];
  requests: DocRequest[];
  people: Record<string, string>;
  reload: () => Promise<void>;
  stage1Required: DocType[];
  stage2Required: DocType[];
  currentFor: (typeId: string) => InvoiceDoc | null;
  stage1Verified: number;
  stage2Verified: number;
  outstandingRequests: DocRequest[];
  hasRejected: boolean;
  stage1Complete: boolean;
  stage2Complete: boolean;
};

export function useInvoiceDocuments(invoiceId: string | undefined, inspectionRequired: boolean): DocumentsState {
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<DocType[]>([]);
  const [docs, setDocs] = useState<InvoiceDoc[]>([]);
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [people, setPeople] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    if (!invoiceId) return;
    const [{ data: t }, { data: d }, { data: r }] = await Promise.all([
      supabase.from('document_types').select('id, code, label, stage, requirement, level, sort_order, generated').eq('active', true).order('sort_order'),
      supabase.from('invoice_documents').select('*').eq('invoice_id', invoiceId).order('version', { ascending: false }),
      supabase.from('invoice_document_requests').select('*').eq('invoice_id', invoiceId).order('requested_at', { ascending: false }),
    ]);
    setTypes((t ?? []) as DocType[]);
    setDocs((d ?? []) as InvoiceDoc[]);
    setRequests((r ?? []) as DocRequest[]);

    const ids = Array.from(new Set([
      ...(d ?? []).map((x: any) => x.uploaded_by),
      ...(d ?? []).map((x: any) => x.reviewed_by),
      ...(r ?? []).map((x: any) => x.requested_by),
    ].filter(Boolean))) as string[];
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('user_id, name, email').in('user_id', ids);
      const map: Record<string, string> = {};
      (p ?? []).forEach((x: any) => { map[x.user_id] = x.name || x.email || 'Unknown'; });
      setPeople(map);
    }
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { reload(); }, [reload]);

  return useMemo(() => {
    const invoiceTypes = types.filter((t) => t.level === 'invoice');
    const stage1Required = invoiceTypes.filter((t) =>
      t.stage === 1 && (t.requirement === 'mandatory' || (t.code === 'inspection_certificate' && inspectionRequired)));
    const stage2Required = invoiceTypes.filter((t) => t.stage === 2 && t.requirement === 'mandatory' && !t.generated);

    const currentFor = (typeId: string) => {
      const rows = docs.filter((d) => d.document_type_id === typeId && !d.superseded_by);
      if (rows.length) return rows.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
      const all = docs.filter((d) => d.document_type_id === typeId);
      return all.length ? all.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] : null;
    };

    const verifiedCount = (list: DocType[]) =>
      list.filter((t) => currentFor(t.id)?.status === 'verified').length;

    const outstandingRequests = requests.filter((r) => r.status === 'outstanding');

    return {
      loading, types, docs, requests, people, reload,
      stage1Required, stage2Required, currentFor,
      stage1Verified: verifiedCount(stage1Required),
      stage2Verified: verifiedCount(stage2Required),
      outstandingRequests,
      hasRejected: docs.some((d) => !d.superseded_by && d.status === 'rejected'),
      stage1Complete: stage1Required.length > 0 && verifiedCount(stage1Required) === stage1Required.length,
      stage2Complete: stage2Required.length > 0 && verifiedCount(stage2Required) === stage2Required.length,
    };
  }, [loading, types, docs, requests, people, reload, inspectionRequired]);
}

const fmtDateTime = (s: string | null) => (s ? new Date(s).toLocaleString('en-GB') : '—');

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    rejected: 'bg-destructive/15 text-destructive border-destructive/30',
    uploaded: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    pending: 'bg-muted text-muted-foreground border-border',
  };
  const label: Record<string, string> = {
    verified: 'Verified', rejected: 'Rejected', uploaded: 'Awaiting review', pending: 'Not uploaded',
  };
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded border whitespace-nowrap', map[status] ?? map.pending)}>
      {label[status] ?? status}
    </span>
  );
}

export default function DocumentReviewPanel({
  invoiceId, exporterId, state, canReview, isSuperAdmin, currentUserId, onChanged,
}: {
  invoiceId: string;
  exporterId: string;
  state: DocumentsState;
  canReview: boolean;
  isSuperAdmin: boolean;
  currentUserId: string | undefined;
  onChanged: () => void;
}) {
  const { types, docs, requests, people, currentFor, stage1Required, stage2Required, outstandingRequests } = state;
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [rejectFor, setRejectFor] = useState<InvoiceDoc | null>(null);
  const [rejectPreset, setRejectPreset] = useState(REJECT_PRESETS[0]);
  const [rejectNote, setRejectNote] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => { await state.reload(); onChanged(); };

  const openPreview = async (doc: InvoiceDoc) => {
    const url = await getDocumentUrl(doc.id, 'invoice');
    if (url) setPreview({ url, name: doc.original_filename ?? 'Document' });
  };

  const verify = async (doc: InvoiceDoc) => {
    setBusy(true);
    const { error } = await supabase.from('invoice_documents')
      .update({ status: 'verified', reviewed_by: currentUserId, reviewed_at: new Date().toISOString(), rejection_reason: null })
      .eq('id', doc.id);
    setBusy(false);
    if (error) { toast({ title: 'Could not verify', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Document verified' });
    refresh();
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    if (rejectNote.trim().length < 5) {
      toast({ title: 'Add a note', description: 'Explain what the exporter needs to change.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const reason = `${rejectPreset}. ${rejectNote.trim()}`;
    const { error } = await supabase.from('invoice_documents')
      .update({ status: 'rejected', reviewed_by: currentUserId, reviewed_at: new Date().toISOString(), rejection_reason: reason })
      .eq('id', rejectFor.id);
    if (!error) {
      const typeLabel = types.find((t) => t.id === rejectFor.document_type_id)?.label ?? 'A document';
      await supabase.rpc('v2_notify_exporter', {
        p_invoice_id: invoiceId,
        p_title: `${typeLabel} needs to be replaced`,
        p_message: reason,
        p_type: 'action_required',
      });
    }
    setBusy(false);
    if (error) { toast({ title: 'Could not reject', description: error.message, variant: 'destructive' }); return; }
    setRejectFor(null); setRejectNote(''); setRejectPreset(REJECT_PRESETS[0]);
    toast({ title: 'Document rejected', description: 'The exporter has been notified and can upload a replacement.' });
    refresh();
  };

  const withdraw = async (req: DocRequest) => {
    const reason = window.prompt('Why are you withdrawing this request?')?.trim();
    if (!reason) return;
    const { error } = await supabase.rpc('v2_withdraw_document_request', { p_request_id: req.id, p_reason: reason });
    if (error) { toast({ title: 'Could not withdraw', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Request withdrawn' });
    refresh();
  };

  const optionalAndRequested = useMemo(() => {
    const requestedIds = new Set(requests.filter((r) => r.status !== 'withdrawn').map((r) => r.document_type_id));
    const uploadedIds = new Set(docs.map((d) => d.document_type_id));
    const stageIds = new Set([...stage1Required, ...stage2Required].map((t) => t.id));
    return types.filter((t) => !stageIds.has(t.id) && (requestedIds.has(t.id) || uploadedIds.has(t.id)));
  }, [types, requests, docs, stage1Required, stage2Required]);

  const AccessHistory = ({ documentId }: { documentId: string }) => {
    const [views, setViews] = useState<any[] | null>(null);
    const [show, setShow] = useState(false);

    const toggle = async () => {
      setShow((s) => !s);
      if (views === null) {
        const { data } = await supabase
          .from('document_audit_log')
          .select('id, actor_id, actor_role, created_at, metadata')
          .eq('entity_id', documentId)
          .eq('action', 'viewed')
          .order('created_at', { ascending: false })
          .limit(50);
        setViews(data ?? []);
      }
    };

    return (
      <div className="mt-2">
        <button type="button" onClick={toggle} className="text-xs text-muted-foreground hover:text-foreground underline">
          Access history
        </button>
        {show && (
          <div className="mt-1 rounded border border-border bg-muted/10 p-2 space-y-1">
            {views === null && <div className="text-xs text-muted-foreground">Loading…</div>}
            {views?.length === 0 && <div className="text-xs text-muted-foreground">Never opened.</div>}
            {views?.map((v) => (
              <div key={v.id} className="text-xs text-muted-foreground">
                {people[v.actor_id ?? ''] ?? v.actor_id?.slice(0, 8) ?? 'Unknown'} ({v.actor_role ?? 'unknown'}) opened this on {fmtDateTime(v.created_at)}
                {v.metadata?.ip ? ` · ${v.metadata.ip}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Row = ({ type }: { type: DocType }) => {
    const doc = currentFor(type.id);
    const versions = docs.filter((d) => d.document_type_id === type.id).sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    const request = requests.find((r) => r.document_type_id === type.id && r.status === 'outstanding');
    const [open, setOpen] = useState(false);


    return (
      <div className="border-t border-border py-3 first:border-t-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{type.label}</div>
            <div className="text-xs text-muted-foreground truncate">
              {doc
                ? <>{doc.original_filename ?? 'Document'} · v{doc.version ?? 1} · {people[doc.uploaded_by ?? ''] ?? 'Exporter'} · {fmtDateTime(doc.uploaded_at)}</>
                : 'Not uploaded yet'}
            </div>
            {doc?.status === 'rejected' && doc.rejection_reason && (
              <div className="text-xs text-destructive mt-1">{doc.rejection_reason}</div>
            )}
            {request && (
              <div className="text-xs text-amber-400 mt-1">
                Requested {fmtDateTime(request.requested_at)}{request.due_date ? ` · due ${request.due_date}` : ''} · {request.reason}
              </div>
            )}
            {doc && <AccessHistory documentId={doc.id} />}
          </div>



          <div className="flex items-center gap-2">
            <StatusPill status={doc ? doc.status : 'pending'} />
            {doc && (
              <Button size="sm" variant="ghost" onClick={() => openPreview(doc)}>
                <Eye className="h-4 w-4 mr-1" /> Preview
              </Button>
            )}
            {versions.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
                <History className="h-4 w-4 mr-1" /> Versions
                <ChevronDown className={cn('h-3 w-3 ml-1 transition', open && 'rotate-180')} />
              </Button>
            )}
            {canReview && doc && doc.status !== 'verified' && (
              <Button size="sm" disabled={busy} onClick={() => verify(doc)}>Verify</Button>
            )}
            {canReview && doc && doc.status !== 'rejected' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectFor(doc)}>Reject</Button>
            )}
            {canReview && request && (
              <Button size="sm" variant="ghost" onClick={() => withdraw(request)}>Withdraw request</Button>
            )}
          </div>
        </div>

        {open && versions.length > 1 && (
          <div className="mt-2 rounded border border-border bg-muted/10 p-3 space-y-1">
            {versions.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>
                  v{v.version ?? 1} · {v.original_filename ?? 'Document'} · {people[v.uploaded_by ?? ''] ?? 'Exporter'} · {fmtDateTime(v.uploaded_at)}
                  {v.superseded_by ? ' · replaced' : ' · current'}
                </span>
                <button className="text-accent hover:underline" onClick={() => openPreview(v)}>Preview</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Group = ({ title, list, empty }: { title: string; list: DocType[]; empty: string }) => (
    <section className="card-elevated p-5">
      <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      {list.length === 0
        ? <p className="text-sm text-muted-foreground">{empty}</p>
        : list.map((t) => <Row key={t.id} type={t} />)}
    </section>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Stage 1 {state.stage1Verified} of {stage1Required.length} verified · Stage 2 {state.stage2Verified} of {stage2Required.length} verified
          {outstandingRequests.length > 0 && <span className="text-amber-400"> · {outstandingRequests.length} outstanding request{outstandingRequests.length > 1 ? 's' : ''}</span>}
        </p>
        {canReview && (
          <Button onClick={() => setRequestOpen(true)}><FilePlus2 className="h-4 w-4 mr-2" /> Request document</Button>
        )}
      </div>

      <Group title="Stage 1" list={stage1Required} empty="No Stage 1 documents configured." />
      <Group title="Stage 2 exporter uploads" list={stage2Required} empty="No Stage 2 documents configured." />
      <Group title="Optional and requested" list={optionalAndRequested} empty="Nothing optional uploaded or requested." />

      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
          <SheetHeader>
            <SheetTitle className="truncate">{preview?.name}</SheetTitle>
            <SheetDescription>Link expires after fifteen minutes.</SheetDescription>
          </SheetHeader>
          {preview && (
            <div className="flex-1 mt-4 overflow-hidden rounded border border-border">
              {/\.(png|jpe?g|webp|gif)(\?|$)/i.test(preview.name)
                ? <img src={preview.url} alt={preview.name} className="w-full h-full object-contain bg-black/40" />
                : <iframe src={preview.url} title={preview.name} className="w-full h-full bg-black/40" />}
            </div>
          )}
          {preview && (
            <a href={preview.url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline mt-2">
              Open in a new tab
            </a>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject document</DialogTitle>
            <DialogDescription>The exporter sees this wording and can upload a replacement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Reason</Label>
              <Select value={rejectPreset} onValueChange={setRejectPreset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REJECT_PRESETS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">What needs to change</Label>
              <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Explain plainly what to correct" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={submitReject}>Reject and notify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RequestDocumentDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        invoiceId={invoiceId}
        types={types}
        excludeIds={new Set([...stage1Required].map((t) => t.id))}
        onDone={refresh}
      />
    </div>
  );
}

function RequestDocumentDialog({
  open, onOpenChange, invoiceId, types, excludeIds, onDone,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; invoiceId: string;
  types: DocType[]; excludeIds: Set<string>; onDone: () => void;
}) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const pool = types.filter((t) => !excludeIds.has(t.id) && t.label.toLowerCase().includes(q.toLowerCase()));
    return [
      { title: 'Optional commercial', items: pool.filter((t) => t.stage === null && !COMPLIANCE_OPTIONAL.has(t.code)) },
      { title: 'Optional compliance', items: pool.filter((t) => t.stage === null && COMPLIANCE_OPTIONAL.has(t.code)) },
      { title: 'Stage 2', items: pool.filter((t) => t.stage === 2) },
    ].filter((g) => g.items.length > 0);
  }, [types, excludeIds, q]);

  const submit = async () => {
    if (selected.length === 0) { toast({ title: 'Select at least one document', variant: 'destructive' }); return; }
    if (reason.trim().length < 5) { toast({ title: 'A reason is required', description: 'The exporter sees this wording.', variant: 'destructive' }); return; }
    setBusy(true);
    const { error } = await supabase.rpc('v2_request_documents', {
      p_invoice_id: invoiceId,
      p_document_type_ids: selected,
      p_reason: reason.trim(),
      p_due_date: due || null,
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not send request', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Documents requested', description: 'The decision clock is paused until they arrive.' });
    setSelected([]); setReason(''); setDue(''); onOpenChange(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Request documents</DialogTitle>
          <DialogDescription>
            The application moves to information requested and the decision clock pauses until every request is answered.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Search documents" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-64 overflow-y-auto rounded border border-border p-3 space-y-3">
            {groups.map((g) => (
              <div key={g.title}>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{g.title}</div>
                {g.items.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                    <Checkbox
                      checked={selected.includes(t.id)}
                      onCheckedChange={(c) => setSelected((s) => (c ? [...s, t.id] : s.filter((x) => x !== t.id)))}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            ))}
            {groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches that search.</p>}
          </div>
          <div>
            <Label className="text-xs">Reason shown to the exporter</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell the exporter exactly what you need and why" />
          </div>
          <div>
            <Label className="text-xs">Due date (optional)</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InspectionOverrideCard({
  invoiceId, required, reason, canOverride, onChanged, satisfied = false,
}: {
  invoiceId: string; required: boolean; reason: string | null; canOverride: boolean; onChanged: () => void;
  /** true once a clean certificate of inspection has been uploaded and verified */
  satisfied?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('v2_set_inspection_required', {
      p_invoice_id: invoiceId, p_required: !required, p_reason: note.trim(),
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not change', description: error.message, variant: 'destructive' }); return; }
    setOpen(false); setNote('');
    toast({ title: required ? 'Inspection no longer required' : 'Inspection now required' });
    onChanged();
  };

  return (
    <section className="card-elevated p-5 space-y-2">
      <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Inspection</h3>
      <div className="flex items-center gap-2 text-sm">
        {required && !satisfied ? <ShieldAlert className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        {required
          ? (satisfied
            ? 'The clean certificate of inspection has been uploaded and verified.'
            : 'A clean certificate of inspection is required and must be verified before this application advances.')
          : 'No inspection certificate is required on this application.'}
      </div>
      {reason && <p className="text-xs text-muted-foreground">Last override: {reason}</p>}
      {canOverride && !(required && satisfied) && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          {required ? 'Remove inspection requirement' : 'Require inspection'}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{required ? 'Remove inspection requirement' : 'Require inspection'}</DialogTitle>
            <DialogDescription>This override is written to the audit log.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || note.trim().length < 5} onClick={apply}>Apply override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
