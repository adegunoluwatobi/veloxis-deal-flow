import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SETTLEMENT_METHOD_LABELS, CURRENCY_SYMBOLS, type SettlementMethod, type InvoiceCurrency } from '@/types';
import { Globe, AlertTriangle, Calendar } from 'lucide-react';
import { format, addDays, parseISO, isAfter } from 'date-fns';

interface Props {
  dealId: string;
  invoiceCurrency: InvoiceCurrency | null;
  settlementCurrency: string | null;
  settlementMethod: SettlementMethod | null;
  fxRateAtFunding: number | null;
  ngnEquivalent: number | null;
  advanceAmount: number | null;
  fxRiskAcknowledged: boolean;
  cbnRepatriationDeadline: string | null;
  dealStatus: string;
  isVeloxis: boolean;
  isExporter: boolean;
  /** Bill of Lading upload date (used to compute CBN deadline) */
  bolDate?: string | null;
  onReload: () => void;
}

const FX_CURRENCIES = ['GBP', 'USD', 'EUR'] as const;

export default function SettlementFxSection({
  dealId,
  invoiceCurrency,
  settlementCurrency: initSettleCurrency,
  settlementMethod: initMethod,
  fxRateAtFunding: initFxRate,
  ngnEquivalent,
  advanceAmount,
  fxRiskAcknowledged,
  cbnRepatriationDeadline,
  dealStatus,
  isVeloxis,
  isExporter,
  bolDate,
  onReload,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [settleCurrency, setSettleCurrency] = useState(initSettleCurrency ?? invoiceCurrency ?? 'GBP');
  const [method, setMethod] = useState<SettlementMethod>(initMethod ?? 'dom_account');
  const [fxRate, setFxRate] = useState(initFxRate ? String(initFxRate) : '');

  const computedNgn = advanceAmount && fxRate ? advanceAmount * parseFloat(fxRate) : null;
  const isFunded = ['funded_active', 'repayment_due', 'overdue', 'closed_repaid', 'closed_partial'].includes(dealStatus);
  const sym = CURRENCY_SYMBOLS[(settleCurrency as InvoiceCurrency) ?? 'GBP'] ?? '£';

  // CBN deadline
  const cbnDeadline = cbnRepatriationDeadline
    ? parseISO(cbnRepatriationDeadline)
    : bolDate ? addDays(parseISO(bolDate), 180) : null;
  const cbnOverdue = cbnDeadline ? isAfter(new Date(), cbnDeadline) : false;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        settlement_currency: settleCurrency,
        settlement_method: method,
      };
      if (isVeloxis && fxRate) {
        updates.fx_rate_at_funding = parseFloat(fxRate);
        if (advanceAmount) {
          updates.ngn_equivalent_at_disbursement = advanceAmount * parseFloat(fxRate);
        }
      }
      // Auto-compute CBN deadline if we have a BoL date
      if (bolDate && !cbnRepatriationDeadline) {
        updates.cbn_repatriation_deadline = format(addDays(parseISO(bolDate), 180), 'yyyy-MM-dd');
      }

      const { error } = await supabase.from('deals').update(updates as any).eq('id', dealId);
      if (error) throw error;
      toast({ title: 'Settlement & FX updated' });
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
          <Globe className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Settlement & FX</CardTitle>
        </div>
        <CardDescription>Currency settlement and foreign exchange details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Invoice Currency</Label>
            <p className="text-sm font-medium text-foreground">{invoiceCurrency ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Settlement Currency</Label>
            {isVeloxis && !isFunded ? (
              <Select value={settleCurrency} onValueChange={setSettleCurrency}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FX_CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium text-foreground">{settleCurrency}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Settlement Method</Label>
          {isVeloxis && !isFunded ? (
            <Select value={method} onValueChange={v => setMethod(v as SettlementMethod)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SETTLEMENT_METHOD_LABELS) as [SettlementMethod, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium text-foreground">{SETTLEMENT_METHOD_LABELS[method]}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">FX Rate at Disbursement</Label>
            {isVeloxis ? (
              <Input
                type="number"
                step="0.01"
                value={fxRate}
                onChange={e => setFxRate(e.target.value)}
                placeholder="e.g. 1950"
                className="h-8"
              />
            ) : (
              <p className="text-sm font-medium text-foreground">{fxRate || '—'}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">NGN Equivalent at Disbursement</Label>
            <p className="text-sm font-medium text-foreground">
              {computedNgn ? `₦${computedNgn.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : ngnEquivalent ? `₦${ngnEquivalent.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}
            </p>
          </div>
        </div>

        {/* FX Risk Acknowledgement */}
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
          {fxRiskAcknowledged ? (
            <Badge variant="secondary" className="bg-success/10 text-success text-xs">FX Risk Acknowledged ✓</Badge>
          ) : (
            <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">FX Risk Not Acknowledged</Badge>
          )}
          <p className="text-xs text-muted-foreground flex-1">
            Exporter acknowledges that the advance will be paid in {settleCurrency} to their domiciliary account. Veloxis bears no responsibility for NGN exchange rate fluctuations.
          </p>
        </div>

        {/* CBN Repatriation Deadline */}
        {isFunded && (
          <div className={cn(
            "flex items-center gap-2 rounded-lg border p-3",
            cbnOverdue ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/30'
          )}>
            <Calendar className={cn("h-4 w-4", cbnOverdue ? 'text-destructive' : 'text-muted-foreground')} />
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground">CBN Repatriation Deadline</p>
              <p className={cn("text-xs", cbnOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                {cbnDeadline ? format(cbnDeadline, 'dd MMM yyyy') : 'Not set (no BoL date)'}
                {cbnOverdue && ' — OVERDUE'}
              </p>
            </div>
            {cbnOverdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
          </div>
        )}

        {isVeloxis && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settlement & FX'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
