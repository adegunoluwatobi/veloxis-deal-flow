import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';
import { AlertTriangle, Plus } from 'lucide-react';

type FxRate = {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string | null;
  effective_from: string;
  captured_by: string | null;
};

const CURRENCIES = ['GBP', 'USD', 'EUR'];
const PLACEHOLDER = 'placeholder, replace before first live invoice';

export default function FxRatesTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FxRate[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    from_currency: 'USD',
    to_currency: 'GBP',
    rate: '',
    source: 'CBN official',
    effective_from: new Date().toISOString().slice(0, 16),
  });

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('fx_rates')
      .select('*')
      .order('from_currency')
      .order('effective_from', { ascending: false });
    if (error) return toast({ title: 'Could not load exchange rates', description: error.message, variant: 'destructive' });
    const list = (data ?? []) as FxRate[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.captured_by).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, name, email').in('user_id', ids);
      setNames(Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.name || p.email])));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const effectiveFor = (from: string, to: string) =>
    rows
      .filter((r) => r.from_currency === from && r.to_currency === to && new Date(r.effective_from).getTime() <= now)
      .sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())[0];

  const missing = CURRENCIES.filter((c) => c !== 'GBP' && !effectiveFor(c, 'GBP')).map((c) => `${c} → GBP`);
  const placeholders = CURRENCIES.filter((c) => c !== 'GBP')
    .map((c) => ({ c, r: effectiveFor(c, 'GBP') }))
    .filter((x) => x.r && (x.r.source ?? '').startsWith('placeholder'))
    .map((x) => `${x.c} → GBP`);

  const save = async () => {
    const rate = Number(form.rate);
    if (!form.rate || Number.isNaN(rate) || rate <= 0) {
      return toast({ title: 'Enter a valid rate', description: 'The rate must be a number greater than zero.', variant: 'destructive' });
    }
    if (form.from_currency === form.to_currency) {
      return toast({ title: 'Currencies must differ', description: 'Pick a different pair.', variant: 'destructive' });
    }
    setSaving(true);
    const { error } = await supabase.from('fx_rates').insert({
      from_currency: form.from_currency,
      to_currency: form.to_currency,
      rate,
      source: form.source || null,
      effective_from: new Date(form.effective_from).toISOString(),
      captured_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast({ title: 'Could not capture the rate', description: error.message, variant: 'destructive' });
    toast({ title: 'Rate captured' });
    setOpen(false);
    setForm({ ...form, rate: '', effective_from: new Date().toISOString().slice(0, 16) });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Rates are never edited or deleted. A correction is a new row with a later effective date.
        </p>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add rate</Button>
      </div>

      {(missing.length > 0 || placeholders.length > 0) && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="space-y-1">
              {missing.length > 0 && (
                <p>No effective rate to GBP for: <strong>{missing.join(', ')}</strong>. Invoices in these currencies cannot be submitted.</p>
              )}
              {placeholders.length > 0 && (
                <p>Placeholder rates still in force for: <strong>{placeholders.join(', ')}</strong>. Replace before the first live invoice.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead>Captured by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-muted-foreground">No rates captured yet.</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const current = effectiveFor(r.from_currency, r.to_currency)?.id === r.id;
              return (
                <TableRow key={r.id} className={current ? 'bg-primary/5' : undefined}>
                  <TableCell className="font-medium">{r.from_currency}</TableCell>
                  <TableCell>{r.to_currency}</TableCell>
                  <TableCell className="font-mono">{Number(r.rate).toFixed(6)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.source}
                    {(r.source ?? '').startsWith('placeholder') && (
                      <Badge variant="destructive" className="ml-2">Placeholder</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(r.effective_from).toLocaleString()}
                    {current && <Badge className="ml-2">In force</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.captured_by ? names[r.captured_by] ?? 'Staff user' : 'System'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Capture a rate</SheetTitle>
            <SheetDescription>New rows supersede earlier ones from their effective date. Nothing is overwritten.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From currency</Label>
                <Select value={form.from_currency} onValueChange={(v) => setForm({ ...form, from_currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To currency</Label>
                <Select value={form.to_currency} onValueChange={(v) => setForm({ ...form, to_currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rate</Label>
              <Input inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="0.790000" />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="CBN official" />
              <p className="text-xs text-muted-foreground">Free text. Default is CBN official. Replace placeholder rates ({PLACEHOLDER}) before going live.</p>
            </div>
            <div className="space-y-2">
              <Label>Effective from</Label>
              <Input type="datetime-local" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Capture rate'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
