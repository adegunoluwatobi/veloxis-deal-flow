import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { CurrencyInput, stripCommas } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Banknote, TrendingUp, LayoutDashboard, Plus, Edit, History, RefreshCw,
} from 'lucide-react';

interface SystemConfig { key: string; value: string; }
interface Tranche {
  id: string;
  reference: string;
  source_name: string;
  amount: number;
  date_received: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}
interface PoolHistoryRow {
  id: string;
  action_type: string;
  amount_change: number;
  new_total: number;
  actor_id: string;
  note: string | null;
  created_at: string;
}
interface FxRates {
  GBP: number;
  USD: number;
  EUR: number;
}
interface DealCurrency {
  gbp_equivalent: number | null;
  invoice_currency_v2: string | null;
  invoice_value: number | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };

export default function CapitalPool() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = role === 'super_admin';

  const [poolGbp, setPoolGbp] = useState(0);
  const [deployed, setDeployed] = useState(0);
  const [dealsByCurrency, setDealsByCurrency] = useState<Record<string, number>>({});
  const [tranches, setTranches] = useState<Tranche[]>([]);
  const [history, setHistory] = useState<PoolHistoryRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // FX state
  const [baseCurrency, setBaseCurrency] = useState<'GBP' | 'USD' | 'EUR'>('GBP');
  const [fxRates, setFxRates] = useState<FxRates | null>(null);
  const [fxUpdatedAt, setFxUpdatedAt] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

  // Modal states
  const [showUpdatePool, setShowUpdatePool] = useState(false);
  const [showAddTranche, setShowAddTranche] = useState(false);
  const [saving, setSaving] = useState(false);

  // Update pool form
  const [newPoolSize, setNewPoolSize] = useState('');
  const [updateNote, setUpdateNote] = useState('');

  // Add tranche form
  const [trancheSource, setTrancheSource] = useState('');
  const [trancheAmount, setTrancheAmount] = useState('');
  const [trancheDate, setTrancheDate] = useState('');
  const [trancheNotes, setTrancheNotes] = useState('');

  const fetchRates = useCallback(async () => {
    setFxLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('exchange-rates', {
        body: null,
        method: 'GET',
      });
      if (error) throw error;
      if (data?.rates) {
        setFxRates(data.rates);
        setFxUpdatedAt(data.updated_at);
      }
    } catch (err) {
      console.error('Failed to fetch FX rates:', err);
      toast({ title: 'Could not fetch live exchange rates', variant: 'destructive' });
    } finally {
      setFxLoading(false);
    }
  }, [toast]);

  const load = useCallback(async () => {
    const [configRes, deployedRes, tranchesRes, historyRes] = await Promise.all([
      supabase.from('system_config').select('key, value'),
      supabase.from('deals')
        .select('gbp_equivalent, invoice_currency_v2, invoice_value')
        .in('status', ['funded_active', 'repayment_due', 'overdue']),
      supabase.from('capital_tranches').select('*').order('created_at', { ascending: false }),
      supabase.from('capital_pool_history').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    const config = (configRes.data as SystemConfig[]) ?? [];
    const pool = Number(config.find(c => c.key === 'pilot_pool_gbp')?.value ?? 150000);
    setPoolGbp(pool);

    const deals = (deployedRes.data ?? []) as DealCurrency[];
    const dep = deals.reduce((s, d) => s + (Number(d.gbp_equivalent) || 0), 0);
    setDeployed(dep);

    // Group deployed by currency
    const byCurrency: Record<string, number> = {};
    deals.forEach(d => {
      const cur = d.invoice_currency_v2 || 'GBP';
      byCurrency[cur] = (byCurrency[cur] || 0) + (Number(d.invoice_value) || Number(d.gbp_equivalent) || 0);
    });
    setDealsByCurrency(byCurrency);

    setTranches((tranchesRes.data ?? []) as Tranche[]);
    setHistory((historyRes.data ?? []) as PoolHistoryRow[]);

    // Fetch user names for display
    const actorIds = new Set<string>();
    (tranchesRes.data ?? []).forEach((t: any) => actorIds.add(t.created_by));
    (historyRes.data ?? []).forEach((h: any) => actorIds.add(h.actor_id));
    if (actorIds.size > 0) {
      const { data: usersData } = await supabase.from('users').select('id, full_name, email').in('id', Array.from(actorIds));
      const map: Record<string, string> = {};
      (usersData ?? []).forEach((u: any) => { map[u.id] = u.full_name || u.email; });
      setUsers(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); fetchRates(); }, [load, fetchRates]);

  // Convert GBP amount to selected base currency
  const convert = (gbpAmount: number): number => {
    if (!fxRates || baseCurrency === 'GBP') return gbpAmount;
    return gbpAmount * (fxRates[baseCurrency] || 1);
  };

  const sym = CURRENCY_SYMBOLS[baseCurrency] || '£';
  const fmtAmount = (gbpVal: number) => `${sym}${convert(gbpVal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const available = poolGbp - deployed;
  const utilization = poolGbp > 0 ? (deployed / poolGbp) * 100 : 0;

  const handleUpdatePool = async () => {
    const val = Number(stripCommas(newPoolSize));
    if (!val || val <= 0) { toast({ title: 'Invalid amount', variant: 'destructive' }); return; }
    if (!updateNote.trim()) { toast({ title: 'Please provide a reason', variant: 'destructive' }); return; }
    setSaving(true);

    const change = val - poolGbp;
    await supabase.from('system_config').update({ value: String(val), updated_by: user!.id }).eq('key', 'pilot_pool_gbp');
    await supabase.from('capital_pool_history').insert({
      action_type: 'manual_update',
      amount_change: change,
      new_total: val,
      actor_id: user!.id,
      note: updateNote.trim(),
    });

    toast({ title: 'Pool size updated' });
    setShowUpdatePool(false);
    setNewPoolSize('');
    setUpdateNote('');
    setSaving(false);
    load();
  };

  const handleAddTranche = async () => {
    const amt = Number(stripCommas(trancheAmount));
    if (!trancheSource.trim()) { toast({ title: 'Source name is required', variant: 'destructive' }); return; }
    if (!amt || amt <= 0) { toast({ title: 'Invalid amount', variant: 'destructive' }); return; }
    if (!trancheDate) { toast({ title: 'Date is required', variant: 'destructive' }); return; }
    setSaving(true);

    const newTotal = poolGbp + amt;

    await supabase.from('capital_tranches').insert({
      reference: '',
      source_name: trancheSource.trim(),
      amount: amt,
      date_received: trancheDate,
      notes: trancheNotes.trim() || null,
      created_by: user!.id,
    });

    await supabase.from('system_config').update({ value: String(newTotal), updated_by: user!.id }).eq('key', 'pilot_pool_gbp');

    await supabase.from('capital_pool_history').insert({
      action_type: 'tranche_added',
      amount_change: amt,
      new_total: newTotal,
      actor_id: user!.id,
      note: `Tranche from ${trancheSource.trim()}`,
    });

    toast({ title: 'Tranche added and pool size updated' });
    setShowAddTranche(false);
    setTrancheSource('');
    setTrancheAmount('');
    setTrancheDate('');
    setTrancheNotes('');
    setSaving(false);
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Capital Pool</h1>
          <p className="text-sm text-muted-foreground">Manage pool size, tranches, and deployment</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Base currency selector */}
          <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as 'GBP' | 'USD' | 'EUR')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GBP">🇬🇧 GBP</SelectItem>
              <SelectItem value="USD">🇺🇸 USD</SelectItem>
              <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={fetchRates} disabled={fxLoading} title="Refresh rates">
            <RefreshCw className={cn('h-4 w-4', fxLoading && 'animate-spin')} />
          </Button>
          {isSuperAdmin && (
            <>
              <Button variant="outline" onClick={() => { setNewPoolSize(String(poolGbp)); setShowUpdatePool(true); }}>
                <Edit className="mr-2 h-4 w-4" /> Update Pool Size
              </Button>
              <Button onClick={() => setShowAddTranche(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Tranche
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Live FX rate line */}
      {fxRates && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span>1 GBP = {fxRates.USD.toFixed(4)} USD | 1 GBP = {fxRates.EUR.toFixed(4)} EUR</span>
          <span>—</span>
          <span>Live rate via ExchangeRate-API{fxUpdatedAt ? `, updated ${format(new Date(fxUpdatedAt), 'dd MMM yyyy HH:mm')}` : ''}</span>
        </div>
      )}

      {/* Pool Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pool Size</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{fmtAmount(poolGbp)}</div>
            {baseCurrency !== 'GBP' && <p className="text-xs text-muted-foreground">£{poolGbp.toLocaleString()} GBP</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deployed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{fmtAmount(deployed)}</div>
            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', utilization > 90 ? 'bg-destructive' : utilization > 75 ? 'bg-warning' : 'bg-success')}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{utilization.toFixed(1)}% utilization</p>
            {baseCurrency !== 'GBP' && <p className="text-xs text-muted-foreground">£{deployed.toLocaleString()} GBP</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available</CardTitle>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', available > 0 ? 'text-success' : 'text-destructive')}>
              {fmtAmount(available)}
            </div>
            {baseCurrency !== 'GBP' && <p className="text-xs text-muted-foreground">£{available.toLocaleString()} GBP</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tranches</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{tranches.length}</div>
            <p className="text-xs text-muted-foreground">capital inputs recorded</p>
          </CardContent>
        </Card>
      </div>

      {/* Deployed by Currency breakdown */}
      {Object.keys(dealsByurrency).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deployed by Invoice Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(dealsByurrency).map(([cur, amt]) => (
                <div key={cur} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">{cur}</span>
                  <span className="text-sm font-bold">{CURRENCY_SYMBOLS[cur] || ''}{Number(amt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capital Tranches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capital Tranches</CardTitle>
        </CardHeader>
        <CardContent>
          {tranches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tranches recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Source / Investor</TableHead>
                  <TableHead className="text-right">Amount (GBP)</TableHead>
                  {baseCurrency !== 'GBP' && <TableHead className="text-right">Amount ({baseCurrency})</TableHead>}
                  <TableHead>Date Received</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Added By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tranches.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                    <TableCell className="font-medium">{t.source_name}</TableCell>
                    <TableCell className="text-right">£{Number(t.amount).toLocaleString()}</TableCell>
                    {baseCurrency !== 'GBP' && (
                      <TableCell className="text-right">{sym}{convert(Number(t.amount)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    )}
                    <TableCell>{format(new Date(t.date_received), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{t.notes || '—'}</TableCell>
                    <TableCell className="text-sm">{users[t.created_by] || t.created_by.slice(0, 8)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pool History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pool History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">New Total</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">{format(new Date(h.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        h.action_type === 'tranche_added' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                      )}>
                        {h.action_type === 'tranche_added' ? 'Tranche Added' : 'Manual Update'}
                      </span>
                    </TableCell>
                    <TableCell className={cn('text-right font-medium', Number(h.amount_change) >= 0 ? 'text-success' : 'text-destructive')}>
                      {Number(h.amount_change) >= 0 ? '+' : ''}£{Number(h.amount_change).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">£{Number(h.new_total).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{users[h.actor_id] || h.actor_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{h.note || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Update Pool Size Modal */}
      <Dialog open={showUpdatePool} onOpenChange={setShowUpdatePool}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Pool Size</DialogTitle>
            <DialogDescription>Set the total capital pool size. Current: £{poolGbp.toLocaleString()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Pool Size (GBP)</Label>
              <CurrencyInput value={newPoolSize} onChange={setNewPoolSize} currencyLabel="£" />
            </div>
            <div>
              <Label>Reason for change <span className="text-destructive">*</span></Label>
              <Textarea value={updateNote} onChange={e => setUpdateNote(e.target.value)} placeholder="e.g. New investor tranche added" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdatePool(false)}>Cancel</Button>
            <Button onClick={handleUpdatePool} disabled={saving}>{saving ? 'Saving…' : 'Update'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tranche Modal */}
      <Dialog open={showAddTranche} onOpenChange={setShowAddTranche}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Capital Tranche</DialogTitle>
            <DialogDescription>Record a new capital input. Pool size will increase by this amount.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Investor / Source Name <span className="text-destructive">*</span></Label>
              <Input value={trancheSource} onChange={e => setTrancheSource(e.target.value)} placeholder="e.g. Investor A" />
            </div>
            <div>
              <Label>Amount (GBP) <span className="text-destructive">*</span></Label>
              <CurrencyInput value={trancheAmount} onChange={setTrancheAmount} currencyLabel="£" />
            </div>
            <div>
              <Label>Date Received <span className="text-destructive">*</span></Label>
              <Input type="date" value={trancheDate} onChange={e => setTrancheDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={trancheNotes} onChange={e => setTrancheNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTranche(false)}>Cancel</Button>
            <Button onClick={handleAddTranche} disabled={saving}>{saving ? 'Saving…' : 'Add Tranche'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
