import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { openDocument } from '@/v2/lib/documents';
import { CheckCircle2, FileText, AlertTriangle, Plus, Trash2 } from 'lucide-react';

type Doc = { id: string; original_filename: string | null; status: string; uploaded_at: string; scan_status: string };
type Sig = { full_name: string; position: string; email: string; phone: string };

const emptySig = (): Sig => ({ full_name: '', position: '', email: '', phone: '' });

const oneYearOn = (from: string) => {
  if (!from) return '';
  const d = new Date(`${from}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default function BoardResolutionReviewStep({
  exporterId,
  canReview,
  onChanged,
}: {
  exporterId: string;
  canReview: boolean;
  onChanged?: () => void;
}) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [resolution, setResolution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [validFrom, setValidFrom] = useState('');
  const [sigs, setSigs] = useState<Sig[]>([emptySig()]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: dt } = await supabase.from('document_types').select('id').eq('code', 'board_resolution').maybeSingle();
    if (dt) {
      const { data: d } = await supabase.from('company_documents')
        .select('id, original_filename, status, uploaded_at, scan_status')
        .eq('exporter_id', exporterId).eq('document_type_id', dt.id)
        .order('uploaded_at', { ascending: false }).limit(1).maybeSingle();
      setDoc((d as Doc) ?? null);
    }
    const { data: r } = await supabase.from('board_resolutions')
      .select('id, limit_basis, valid_from, valid_until, verification_status, renewal_required, renewal_reason')
      .eq('exporter_id', exporterId).is('superseded_by', null).maybeSingle();
    setResolution(r ?? null);
    setLoading(false);
  }, [exporterId]);

  useEffect(() => { load(); }, [load]);

  const reject = async () => {
    if (!doc || !rejectReason.trim()) {
      return toast({ title: 'A reason is required', variant: 'destructive' });
    }
    setBusy(true);
    const { error } = await supabase.from('company_documents')
      .update({ status: 'rejected', rejection_reason: rejectReason.trim(), reviewed_at: new Date().toISOString() })
      .eq('id', doc.id);
    setBusy(false);
    if (error) return toast({ title: 'Could not reject', description: error.message, variant: 'destructive' });
    setRejecting(false); setRejectReason('');
    toast({ title: 'Board resolution rejected', description: 'The application has been returned for revision.' });
    load(); onChanged?.();
  };

  const requestResolution = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('v2_request_board_resolution', {
      p_exporter_id: exporterId,
      p_note: 'Please upload a board resolution naming the people authorised to sign on behalf of the company.',
    });
    setBusy(false);
    if (error) return toast({ title: 'Could not send the request', description: error.message, variant: 'destructive' });
    toast({ title: 'Board resolution requested', description: 'The exporter has been notified.' });
  };

  const transcribe = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('v2_transcribe_board_resolution', {
      p_exporter_id: exporterId,
      p_company_document_id: doc!.id,
      p_valid_from: validFrom,
      p_signatories: sigs.filter((s) => s.full_name.trim()) as any,
    });
    setBusy(false);
    setConfirmOpen(false);
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    toast({ title: 'Board resolution recorded' });
    load(); onChanged?.();
  };

  const openConfirm = () => {
    if (!doc) return toast({ title: 'No board resolution has been uploaded', variant: 'destructive' });
    if (!validFrom) return toast({ title: 'Enter the date the resolution was passed', variant: 'destructive' });
    const named = sigs.filter((s) => s.full_name.trim());
    if (named.length === 0) return toast({ title: 'Add at least one authorised signatory', variant: 'destructive' });
    if (named.some((s) => !s.phone.trim())) {
      return toast({ title: 'Each authorised signatory needs a phone number', variant: 'destructive' });
    }
    setConfirmOpen(true);
  };


  if (loading) return <p className="text-sm text-muted-foreground">Loading board resolution…</p>;

  const done = resolution?.verification_status === 'verified';

  return (
    <div className="rounded-md border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            {done ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
            Board resolution <span className="text-destructive">*</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Required. Check the document, then record the date it was passed and the authorised signatories.
            The resolution runs for one year from that date.
          </p>
        </div>
        {doc && (
          <button onClick={() => openDocument(doc.id, 'company')} className="text-sm text-accent hover:underline inline-flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> {doc.original_filename ?? 'View document'}
          </button>
        )}
      </div>

      {!doc && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">The exporter has not uploaded a board resolution.</p>
          {canReview && (
            <Button size="sm" variant="outline" onClick={requestResolution} disabled={busy}>
              Request board resolution
            </Button>
          )}
        </div>
      )}

      {resolution?.renewal_required && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-400">
          {resolution.renewal_reason ?? 'A replacement board resolution is required.'}
        </div>
      )}

      {done && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Passed on: </span>{resolution.valid_from}</div>
          <div><span className="text-muted-foreground">Expires: </span>{resolution.valid_until}</div>
        </div>
      )}

      {!done && canReview && doc && (
        <div className="space-y-4 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date the resolution was passed</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expires (one year, automatic)</Label>
              <Input value={oneYearOn(validFrom) || '—'} readOnly className="bg-muted/30" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Authorised signatories</div>
            {sigs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2">
                <Input placeholder="Full name" value={s.full_name}
                  onChange={(e) => setSigs(sigs.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))} />
                <Input placeholder="Position" value={s.position}
                  onChange={(e) => setSigs(sigs.map((x, j) => j === i ? { ...x, position: e.target.value } : x))} />
                <Input placeholder="Email" value={s.email}
                  onChange={(e) => setSigs(sigs.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                <Input placeholder="Phone" value={s.phone}
                  onChange={(e) => setSigs(sigs.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
                <Button type="button" size="icon" variant="ghost" onClick={() => setSigs(sigs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setSigs([...sigs, emptySig()])}>
              <Plus className="h-4 w-4 mr-1" /> Add signatory
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openConfirm} disabled={busy}>Accept and record</Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting((s) => !s)} disabled={busy}>
              Reject document
            </Button>
          </div>

          {rejecting && (
            <div className="space-y-2">
              <Textarea placeholder="Why is this board resolution being rejected?" value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)} />
              <Button size="sm" variant="destructive" onClick={reject} disabled={busy}>
                Reject and return for revision
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm the transcribed details</DialogTitle>
            <DialogDescription>
              These signatories become the only people who can commit this company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Valid: </span>{validFrom} to {oneYearOn(validFrom)}</div>
            <div className="pt-2 text-muted-foreground">Signatories</div>
            <ul className="list-disc pl-5">
              {sigs.filter((s) => s.full_name.trim()).map((s, i) => (
                <li key={i}>{s.full_name}{s.position ? ` · ${s.position}` : ''}{s.email ? ` · ${s.email}` : ''}{s.phone ? ` · ${s.phone}` : ''}</li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Back</Button>
            <Button onClick={transcribe} disabled={busy}>Confirm and record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
