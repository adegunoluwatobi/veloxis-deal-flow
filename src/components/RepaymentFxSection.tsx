import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  RECONCILIATION_STATUS_LABELS, RECONCILIATION_STATUS_COLORS,
  CURRENCY_SYMBOLS,
  type RepaymentReconciliationStatus, type InvoiceCurrency,
} from '@/types';
import { Banknote, AlertTriangle } from 'lucide-react';

const FX_CURRENCIES = ['GBP', 'USD', 'EUR', 'NGN'] as const;

interface Props {
  dealId: string;
  invoiceCurrency: InvoiceCurrency | null;
  repaymentAmount: number | null;
  actualRepaymentAmount: number | null;
  repaymentCurrencyReceived: string | null;
  repaymentFxRate: number | null;
  repaymentGbpEquivalent: number | null;
  reconciliationStatus: RepaymentReconciliationStatus | null;
  dealStatus: string;
  onReload: () => void;
}

export default function RepaymentFxSection({
  dealId,
  invoiceCurrency,
  repaymentAmount,
  actualRepaymentAmount,
  repaymentCurrencyReceived: initCurrency,
  repaymentFxRate: initFxRate,
  repaymentGbpEquivalent: initGbpEq,
  reconciliationStatus: initRecon,
  dealStatus,
  onReload,
}: Props) {
  const { role } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [currReceived, setCurrReceived] = useState(initCurrency ?? invoiceCurrency ?? 'GBP');
  const [fxRate, setFxRate] = useState(initFxRate ? String(initFxRate) : '');
  const [gbpEq, setGbpEq] = useState(initGbpEq ? String(initGbpEq) : '');
  const [recon, setRecon] = useState<RepaymentReconciliationStatus | ''>(initRecon ?? '');

  const isSuperAdminOrDM = role === 'super_admin' || role === 'deal_manager';
  const isRepaymentStage = ['funded_active', 'repayment_due', 'overdue', 'closed_repaid', 'closed_partial'].includes(dealStatus);

  if (!isRepaymentStage || !isSuperAdminOrDM) return null;

  const sym = CURRENCY_SYMBOLS[(invoiceCurrency ?? 'GBP') as InvoiceCurrency] ?? '£';
  const isDiffCurrency = currReceived !== invoiceCurrency;

  // Auto-determine reconciliation status
  const computeRecon = (): RepaymentReconciliationStatus | '' => {
    if (!repaymentAmount || !gbpEq) return '';
    const received = parseFloat(gbpEq);
    if (isNaN(received)) return '';
    const diff = received - repaymentAmount;
    if (Math.abs(diff) < 0.01) return 'exact';
    return diff < 0 ? 'short_payment' : 'overpayment';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const computedRecon = computeRecon();
      const { error } = await supabase.from('deals').update({
        repayment_currency_received: currReceived,
        repayment_fx_rate: fxRate ? parseFloat(fxRate) : null,
        repayment_gbp_equivalent: gbpEq ? parseFloat(gbpEq) : null,
        repayment_reconciliation_status: computedRecon || null,
      } as any).eq('id', dealId);
      if (error) throw error;
      if (computedRecon) setRecon(computedRecon);
      toast({ title: 'Repayment FX details saved' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Repayment FX Reconciliation</CardTitle>
        </div>
        <CardDescription>Record the currency and FX details of the buyer's payment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Expected Repayment</Label>
            <p className="text-sm font-medium text-foreground">
              {repaymentAmount ? `${sym}${repaymentAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'} ({invoiceCurrency})
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Amount Actually Received</Label>
            <p className="text-sm font-medium text-foreground">
              {actualRepaymentAmount ? `${sym}${actualRepaymentAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Currency Received</Label>
            <Select value={currReceived} onValueChange={setCurrReceived}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FX_CURRENCIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isDiffCurrency && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">FX Rate Applied</Label>
              <Input
                type="number"
                step="0.0001"
                value={fxRate}
                onChange={e => setFxRate(e.target.value)}
                placeholder="Spot rate"
                className="h-8"
              />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Amount Received (GBP Equivalent)</Label>
          <Input
            type="number"
            step="0.01"
            value={gbpEq}
            onChange={e => setGbpEq(e.target.value)}
            placeholder="For Veloxis books"
            className="h-8"
          />
        </div>

        {/* Reconciliation status */}
        {(recon || computeRecon()) && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Reconciliation:</span>
            <Badge
              variant="secondary"
              className={cn('text-xs', RECONCILIATION_STATUS_COLORS[(recon || computeRecon()) as RepaymentReconciliationStatus])}
            >
              {RECONCILIATION_STATUS_LABELS[(recon || computeRecon()) as RepaymentReconciliationStatus]}
            </Badge>
            {(recon || computeRecon()) !== 'exact' && (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" /> Reconciliation required before closing
              </div>
            )}
          </div>
        )}

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Repayment FX'}
        </Button>
      </CardContent>
    </Card>
  );
}
