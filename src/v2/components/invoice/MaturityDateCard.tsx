import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function MaturityDateCard({
  invoiceId, maturityDate, overrideBy, overrideAt, overrideReason, canAdjust, people, onChanged,
}: {
  invoiceId: string;
  maturityDate: string | null;
  overrideBy: string | null;
  overrideAt: string | null;
  overrideReason: string | null;
  canAdjust: boolean;
  people: Record<string, string>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(maturityDate ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('set_invoice_maturity_date', {
      p_invoice_id: invoiceId, p_new_maturity_date: date, p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not adjust', description: error.message, variant: 'destructive' }); return; }
    setOpen(false); setReason('');
    toast({ title: 'Expected payment date updated' });
    onChanged();
  };

  return (
    <section className="card-elevated p-5 space-y-2 text-sm">
      <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Expected payment date</h3>
      <div className="text-lg tabular-nums">{maturityDate ?? '—'}</div>
      {overrideAt && (
        <p className="text-xs text-muted-foreground">
          Adjusted by {people[overrideBy ?? ''] ?? 'a reviewer'} on {new Date(overrideAt).toLocaleString('en-GB')}
          {overrideReason ? ` · ${overrideReason}` : ''}
        </p>
      )}
      {canAdjust && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Adjust</Button>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust expected payment date</DialogTitle>
            <DialogDescription>The change and your reason are written to the audit log.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">New date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the date changing?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !date || reason.trim().length < 5} onClick={apply}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
