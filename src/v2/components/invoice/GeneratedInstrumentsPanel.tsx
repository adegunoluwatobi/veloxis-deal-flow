import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { openDocument } from '@/v2/lib/documents';
import { InstrumentRow, SIGNER_ROLE_LABEL, TEST_MODE_LABEL, useInstruments, useEsignatureMode } from '@/v2/lib/instruments';
import { cn } from '@/lib/utils';
import { FileSignature, RefreshCw, Send, Stamp } from 'lucide-react';

const STATE_LABEL: Record<InstrumentRow['state'], string> = {
  preparing: 'Prepared, not yet sent',
  awaiting_signature: 'Out for signature',
  signed: 'Signed',
  declined: 'Declined',
};
const STATE_CLASS: Record<InstrumentRow['state'], string> = {
  preparing: 'bg-muted text-muted-foreground border-border',
  awaiting_signature: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  signed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  declined: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function GeneratedInstrumentsPanel({
  invoiceId, invoice, canGenerate, canSend, onChanged,
}: {
  invoiceId: string;
  invoice: any;
  canGenerate: boolean;
  canSend: boolean;
  onChanged: () => void;
}) {
  const { rows, reload, loading } = useInstruments(invoiceId);
  const { isTest } = useEsignatureMode();
  const [busy, setBusy] = useState(false);
  const [serveOpen, setServeOpen] = useState(false);
  const [method, setMethod] = useState('');

  // Non-2xx responses arrive as FunctionsHttpError with the body on error.context.
  const readError = async (data: any, error: any): Promise<string | null> => {
    if (data?.error) return data.error as string;
    if (!error) return null;
    try {
      const body = await (error as any)?.context?.json?.();
      if (body?.error) return body.error as string;
    } catch { /* body not JSON */ }
    return error.message ?? 'Something went wrong.';
  };

  const generate = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('generate-instruments', { body: { invoice_id: invoiceId } });
    setBusy(false);
    const message = await readError(data, error);
    if (message) {
      toast({ title: 'Could not generate', description: message, variant: 'destructive' });
      return;
    }
    const missing: string[] = data?.unresolved_tokens ?? [];
    toast({
      title: 'Documents generated',
      description: missing.length ? `Some details are not on file: ${missing.join(', ')}` : 'Three instruments created from the active templates.',
    });
    await reload(); onChanged();
  };

  const send = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('send-for-signature', { body: { invoice_id: invoiceId } });
    setBusy(false);
    const message = await readError(data, error);
    if (message) {
      toast({ title: 'Could not send', description: message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sent for signature', description: 'All three instruments are with the signing parties.' });
    await reload(); onChanged();
  };


  const markServed = async () => {
    if (method.trim().length < 3) { toast({ title: 'Record how it was served', variant: 'destructive' }); return; }
    setBusy(true);
    const { error } = await supabase.rpc('v2_mark_notice_served', { p_invoice_id: invoiceId, p_method: method.trim() });
    setBusy(false);
    if (error) { toast({ title: 'Could not record', description: error.message, variant: 'destructive' }); return; }
    setServeOpen(false); setMethod('');
    toast({ title: 'Notice recorded as served' });
    onChanged();
  };

  const anyGenerated = rows.some((r) => r.document);
  const noticeSigned = rows.find((r) => r.code === 'notice_of_assignment')?.state === 'signed';

  return (
    <section className="card-elevated p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Veloxis generated instruments</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Generated from the active template versions and routed for electronic signature. The exporter does not upload these.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <Button size="sm" variant="outline" disabled={busy} onClick={generate}>
              <RefreshCw className="h-4 w-4 mr-1" /> {anyGenerated ? 'Regenerate' : 'Generate'}
            </Button>
          )}
          {canSend && (
            <Button size="sm" disabled={busy || !anyGenerated} onClick={send}>
              <Send className="h-4 w-4 mr-1" /> Send for signature
            </Button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && !anyGenerated && (
        <p className="text-sm text-muted-foreground">Nothing generated yet. These are created automatically when the application is approved.</p>
      )}

      {rows.filter((r) => r.document).map((r) => (
        <div key={r.code} className="border-t border-border pt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-muted-foreground" /> {r.label}
              </div>
              {isTest && (
                <div className="mt-1 text-xs px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 inline-block">
                  {TEST_MODE_LABEL}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                v{r.document.version} · template version {r.document.template_version ?? '—'} ·{' '}
                {new Date(r.document.uploaded_at).toLocaleString('en-GB')}
              </div>
              <div className="mt-1 space-y-0.5">
                {r.requests.filter((q) => q.status !== 'expired').map((q) => (
                  <div key={q.id} className="text-xs text-muted-foreground">
                    {SIGNER_ROLE_LABEL[q.signer_role] ?? q.signer_role}: {q.signer_name ?? q.signer_email} · {q.status}
                    {q.completed_at ? ` · ${new Date(q.completed_at).toLocaleDateString('en-GB')}` : ''}
                    {q.certificate_path ? ' · certificate of completion stored' : ''}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs px-2 py-0.5 rounded border whitespace-nowrap', STATE_CLASS[r.state])}>
                {STATE_LABEL[r.state]}
              </span>
              <Button size="sm" variant="ghost" onClick={() => openDocument(r.document.id, 'invoice')}>Open</Button>
            </div>
          </div>
        </div>
      ))}

      <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {invoice?.notice_served_at
            ? `Notice served ${new Date(invoice.notice_served_at).toLocaleString('en-GB')} by ${invoice.notice_served_method}`
            : 'The notice of assignment is never sent to the buyer automatically. Serving it stays a manual decision.'}
        </div>
        {canSend && !invoice?.notice_served_at && (
          <Button size="sm" variant="outline" disabled={!noticeSigned} onClick={() => setServeOpen(true)}>
            <Stamp className="h-4 w-4 mr-1" /> Mark notice served
          </Button>
        )}
      </div>

      <Dialog open={serveOpen} onOpenChange={setServeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark the notice as served</DialogTitle>
            <DialogDescription>This records that the notice of assignment has been delivered to the buyer.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>How was it served</Label>
            <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Email to accounts payable, courier, hand delivered" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServeOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={markServed}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
