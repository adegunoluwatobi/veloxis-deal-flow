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
import { Settings, History, AlertTriangle, Loader2 } from 'lucide-react';

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

  // Initialize form when config loads
  const initForm = () => {
    if (!config) return;
    setForm({
      advance_rate_pct: String(config.advance_rate_pct),
      platform_fee_pct: String(config.platform_fee_pct),
      discount_fee_pct_monthly: String(config.discount_fee_pct_monthly),
      late_penalty_rate_pct_daily: String(config.late_penalty_rate_pct_daily),
      min_payment_terms_days: String(config.min_payment_terms_days),
      max_payment_terms_days: String(config.max_payment_terms_days),
    });
  };

  // Lazy init
  if (config && Object.keys(form).length === 0) initForm();

  const FIELD_LABELS: Record<string, string> = {
    advance_rate_pct: 'Advance Rate %',
    platform_fee_pct: 'Platform Fee % (one-off)',
    discount_fee_pct_monthly: 'Discount Fee % (per month)',
    late_penalty_rate_pct_daily: 'Late Penalty Rate % (per day)',
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
        platform_fee_pct: parseFloat(form.platform_fee_pct),
        discount_fee_pct_monthly: parseFloat(form.discount_fee_pct_monthly),
        late_penalty_rate_pct_daily: parseFloat(form.late_penalty_rate_pct_daily),
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
