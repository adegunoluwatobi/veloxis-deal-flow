import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { Settings, History, AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';

export default function PricingSettings() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['pricing_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['pricing_rate_history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_rate_history')
        .select('*, users:changed_by(email, full_name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});


  // Discount fee tiers (e.g. 30d/60d/90d)
  type TierRow = { id?: string; term_days: string; discount_fee_pct: string; platform_fee_pct: string; late_penalty_rate_pct_daily: string; label: string; sort_order: number; _dirty?: boolean; _new?: boolean };
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [tiersLoaded, setTiersLoaded] = useState(false);
  const [savingTiers, setSavingTiers] = useState(false);
  const [deletedTierIds, setDeletedTierIds] = useState<string[]>([]);

  const { data: tiersData } = useQuery({
    queryKey: ['pricing_discount_tiers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pricing_discount_tiers')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (tiersData && !tiersLoaded) {
    setTiers(tiersData.map((t: any) => ({
      id: t.id,
      term_days: String(t.term_days),
      discount_fee_pct: String(t.discount_fee_pct),
      platform_fee_pct: String(t.platform_fee_pct ?? 0),
      late_penalty_rate_pct_daily: String(t.late_penalty_rate_pct_daily ?? 0),
      label: t.label ?? '',
      sort_order: t.sort_order ?? 0,
    })));
    setTiersLoaded(true);
  }

  const addTier = () => setTiers([...tiers, { term_days: '', discount_fee_pct: '', platform_fee_pct: '', late_penalty_rate_pct_daily: '', label: '', sort_order: tiers.length + 1, _new: true, _dirty: true }]);
  const updateTier = (i: number, field: keyof TierRow, value: string) => {
    const next = [...tiers];
    (next[i] as any)[field] = value;
    next[i]._dirty = true;
    setTiers(next);
  };
  const removeTier = (i: number) => {
    const row = tiers[i];
    if (row.id) setDeletedTierIds(prev => [...prev, row.id!]);
    setTiers(tiers.filter((_, idx) => idx !== i));
  };

  const handleSaveTiers = async () => {
    if (!user) return;
    // Validate
    for (const t of tiers) {
      const td = parseInt(t.term_days);
      const pct = parseFloat(t.discount_fee_pct);
      if (!td || td <= 0 || isNaN(pct) || pct < 0) {
        toast({ title: 'Invalid tier', description: 'Term days must be > 0 and fee % must be valid.', variant: 'destructive' });
        return;
      }
    }
    setSavingTiers(true);
    try {
      for (const id of deletedTierIds) {
        await (supabase as any).from('pricing_discount_tiers').delete().eq('id', id);
      }
      for (const t of tiers) {
        if (!t._dirty && !t._new) continue;
        const payload = {
          term_days: parseInt(t.term_days),
          discount_fee_pct: parseFloat(t.discount_fee_pct),
          platform_fee_pct: parseFloat(t.platform_fee_pct || '0'),
          late_penalty_rate_pct_daily: parseFloat(t.late_penalty_rate_pct_daily || '0'),
          label: t.label || `${t.term_days} days`,
          sort_order: t.sort_order,
          updated_by: user.id,
        };
        if (t.id) {
          await (supabase as any).from('pricing_discount_tiers').update(payload).eq('id', t.id);
        } else {
          await (supabase as any).from('pricing_discount_tiers').insert(payload);
        }
      }
      setDeletedTierIds([]);
      toast({ title: 'Discount tiers saved' });
      queryClient.invalidateQueries({ queryKey: ['pricing_discount_tiers'] });
      setTiersLoaded(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingTiers(false);
    }
  };


  // Initialize form when config loads
  const initForm = () => {
    if (!config) return;
    setForm({
      advance_rate_pct: String(config.advance_rate_pct),
      min_payment_terms_days: String(config.min_payment_terms_days),
      max_payment_terms_days: String(config.max_payment_terms_days),
    });
  };

  // Lazy init
  if (config && Object.keys(form).length === 0) initForm();

  const FIELD_LABELS: Record<string, string> = {
    advance_rate_pct: 'Advance Rate %',
    min_payment_terms_days: 'Minimum Payment Terms (days)',
    max_payment_terms_days: 'Maximum Payment Terms (days)',
  };

  const handleSave = async () => {
    if (!config || !user) return;

    const ok = await confirm({
      title: 'Update Global Pricing',
      description: 'Changing these rates will apply to all new applications going forward. Existing approved deals will not be affected.',
      variant: 'warning',
      confirmLabel: 'Save Changes',
    });
    if (!ok) return;

    setSaving(true);
    try {
      // Record history for changed fields
      const changes: { field_name: string; old_value: string; new_value: string }[] = [];
      for (const key of Object.keys(FIELD_LABELS)) {
        const oldVal = String((config as any)[key]);
        const newVal = form[key] ?? oldVal;
        if (oldVal !== newVal) {
          changes.push({ field_name: FIELD_LABELS[key], old_value: oldVal, new_value: newVal });
        }
      }

      if (changes.length === 0) {
        toast({ title: 'No changes', description: 'No pricing rates were changed.' });
        setSaving(false);
        return;
      }

      // Insert history rows
      for (const change of changes) {
        await supabase.from('pricing_rate_history').insert({
          changed_by: user.id,
          field_name: change.field_name,
          old_value: change.old_value,
          new_value: change.new_value,
        } as any);
      }

      // Update config
      const { error } = await supabase.from('pricing_config').update({
        advance_rate_pct: parseFloat(form.advance_rate_pct),
        min_payment_terms_days: parseInt(form.min_payment_terms_days),
        max_payment_terms_days: parseInt(form.max_payment_terms_days),
        updated_by: user.id,
      } as any).eq('id', config.id);
      if (error) throw error;

      toast({ title: 'Pricing updated', description: `${changes.length} rate(s) updated successfully.` });
      queryClient.invalidateQueries({ queryKey: ['pricing_config'] });
      queryClient.invalidateQueries({ queryKey: ['pricing_rate_history'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (role !== 'super_admin') {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Access restricted to Super Admins only.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pricing Configuration</h1>
          <p className="text-sm text-muted-foreground">Set global pricing rates for all new applications</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Rates</CardTitle>
          <CardDescription>These rates apply to all new applications on the platform. Only Super Admins can edit them.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`pricing-${key}`} className="text-sm">{label}</Label>
                    <Input
                      id={`pricing-${key}`}
                      type="number"
                      step={key.includes('days') ? '1' : '0.001'}
                      min="0"
                      value={form[key] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              {parseInt(form.max_payment_terms_days) > 60 && (
                <div className="flex items-start gap-2 rounded-md border border-[hsl(30,90%,50%)]/40 bg-[hsl(30,90%,50%)]/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-[hsl(30,90%,50%)] shrink-0 mt-0.5" />
                  <p className="text-sm text-[hsl(30,90%,50%)]">Setting maximum terms above 60 days increases platform risk exposure.</p>
                </div>
              )}

              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Changing these rates will apply to all new applications going forward. Existing approved deals will not be affected.
                </p>
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save Pricing Configuration'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discount Fee Tiers */}
      <Card>
        <CardHeader>
          <CardTitle>Discount Fee Tiers</CardTitle>
          <CardDescription>
            Configure multiple discount fee rates based on payment term length (e.g. 3.5% for 30 days, 4.5% for 60 days, 5.5% for 90 days). These rates apply to new applications going forward.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tiers.length === 0 && (
            <p className="text-sm text-muted-foreground">No tiers configured. Add at least one tier below.</p>
          )}
          <div className="space-y-3">
            {tiers.map((t, i) => (
              <div key={t.id ?? `new-${i}`} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end rounded-md border border-border p-3">
                <div className="md:col-span-3 space-y-1">
                  <Label className="text-xs">Term (days)</Label>
                  <Input type="number" min="1" step="1" value={t.term_days} onChange={e => updateTier(i, 'term_days', e.target.value)} />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <Label className="text-xs">Discount Fee %</Label>
                  <Input type="number" min="0" step="0.001" value={t.discount_fee_pct} onChange={e => updateTier(i, 'discount_fee_pct', e.target.value)} />
                </div>
                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs">Label (optional)</Label>
                  <Input value={t.label} onChange={e => updateTier(i, 'label', e.target.value)} placeholder={`${t.term_days || '30'} days`} />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeTier(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addTier} className="gap-1">
              <Plus className="h-3 w-3" /> Add Tier
            </Button>
            <Button size="sm" onClick={handleSaveTiers} disabled={savingTiers}>
              {savingTiers ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {savingTiers ? 'Saving…' : 'Save Tiers'}
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Rate History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Rate Change History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-32" />
          ) : !history || history.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No rate changes recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                    <TableHead>Changed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{new Date(row.created_at).toLocaleDateString('en-GB')} {new Date(row.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell className="font-medium text-sm">{row.field_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.old_value}</TableCell>
                      <TableCell className="text-sm font-medium">{row.new_value}</TableCell>
                      <TableCell className="text-sm">{(row as any).users?.full_name || (row as any).users?.email || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
