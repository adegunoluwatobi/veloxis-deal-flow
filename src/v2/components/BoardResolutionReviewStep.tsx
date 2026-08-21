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
type Sig = { full_name: string; position: string; email: string };

const money = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

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

  const [form, setForm] = useState({
    authorised_limit: '', limit_basis: 'gross_face_value', valid_from: '', valid_until: '',
  });
  const [sigs, setSigs] = useState<Sig[]>([{ full_name: '', position: '', email: '' }]);

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
      .select('id, authorised_limit, limit_currency, limit_basis, valid_from, valid_until, verification_status')
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

  const transcribe = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('v2_transcribe_board_resolution', {
      p_exporter_id: exporterId,
      p_company_document_id: doc!.id,
      p_authorised_limit: Number(form.authorised_limit),
      p_limit_basis: form.limit_basis,
      p_valid_from: form.valid_from,
      p_valid_until: form.valid_until,
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
    if (!form.authorised_limit || Number(form.authorised_limit) <= 0) return toast({ title: 'Enter the authorised limit', variant: 'destructive' });
    if (!form.valid_from || !form.valid_until) return toast({ title: 'Enter the validity dates', variant: 'destructive' });
    if (form.valid_until <= form.valid_from) return toast({ title: 'Valid until must be after valid from', variant: 'destructive' });
    if (!sigs.some((s) => s.full_name.trim())) return toast({ title: 'Add at least one authorised signatory', variant: 'destructive' });
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
            Required. Check the document, then record the authorised limit and signatories.
          </p>
        </div>
        {doc && (
          <button onClick={() => openDocument(doc.id, 'company')} className="text-sm text-accent hover:underline inline-flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> {doc.original_filename ?? 'View document'}
          </button>
        )}
      </div>

      {!doc && <p className="text-sm text-destructive">The exporter has not uploaded a board resolution.</p>}

      {done && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Authorised limit: </span>{money(Number(resolution.authorised_limit))} GBP</div>
          <div><span className="text-muted-foreground">Basis: </span>{resolution.limit_basis === 'advance_outstanding' ? 'Funds advanced' : 'Invoice face value'}</div>
          <div><span className="text-muted-foreground">Valid from: </span>{resolution.valid_from}</div>
          <div><span className="text-muted-foreground">Valid until: </span>{resolution.valid_until}</div>
        </div>
      )}

      {!done && canReview && doc && (
        <div className="space-y-4 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Authorised limit (GBP)</Label>
              <Input type="number" step="0.01" value={form.authorised_limit}
                onChange={(e) => setForm({ ...form, authorised_limit: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Limit basis</Label>
              <Select value={form.limit_basis} onValueChange={(v) => setForm({ ...form, limit_basis: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross_face_value">Invoice face value</SelectItem>
                  <SelectItem value="advance_outstanding">Funds advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valid from</Label>
              <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valid until</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Authorised signatories</div>
            {sigs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input placeholder="Full name" value={s.full_name}
                  onChange={(e) => setSigs(sigs.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))} />
                <Input placeholder="Position" value={s.position}
                  onChange={(e) => setSigs(sigs.map((x, j) => j === i ? { ...x, position: e.target.value } : x))} />
                <Input placeholder="Email" value={s.email}
                  onChange={(e) => setSigs(sigs.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                <Button type="button" size="icon" variant="ghost" onClick={() => setSigs(sigs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setSigs([...sigs, { full_name: '', position: '', email: '' }])}>
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
            <DialogTitle>Confirm the transcribed figures</DialogTitle>
            <DialogDescription>
              These figures become a hard limit on everything this exporter can draw.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Authorised limit: </span>{money(Number(form.authorised_limit || 0))} GBP</div>
            <div><span className="text-muted-foreground">Basis: </span>{form.limit_basis === 'advance_outstanding' ? 'Funds advanced' : 'Invoice face value'}</div>
            <div><span className="text-muted-foreground">Valid: </span>{form.valid_from} to {form.valid_until}</div>
            <div className="pt-2 text-muted-foreground">Signatories</div>
            <ul className="list-disc pl-5">
              {sigs.filter((s) => s.full_name.trim()).map((s, i) => (
                <li key={i}>{s.full_name}{s.position ? ` · ${s.position}` : ''}{s.email ? ` · ${s.email}` : ''}</li>
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
