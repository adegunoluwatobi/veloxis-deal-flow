import { useState } from 'react';
import { validateAndScroll } from '@/lib/validation';
import ValidationSummaryBanner from '@/components/ValidationSummaryBanner';
import type { ValidationFailure } from '@/lib/validation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { CURRENCY_SYMBOLS, type InvoiceCurrency, type AuditAction } from '@/types';
import { Banknote, Upload, Loader2 } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

interface Props {
  dealId: string;
  invoiceCurrency: InvoiceCurrency | null;
  advanceAmount: number | null;
  invoiceValue: number | null;
  platformFeeAmount: number | null;
  discountFeeAmount: number | null;
  repaymentDueDate: string | null;
  dealStatus: string;
  discountFeePct: number | null;
  onReload: () => void;
}

export default function PaymentAdvicePanel({
  dealId,
  invoiceCurrency,
  advanceAmount,
  invoiceValue,
  platformFeeAmount,
  discountFeeAmount,
  repaymentDueDate,
  dealStatus,
  discountFeePct,
  onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [paymentDate, setPaymentDate] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentValidationFailures, setPaymentValidationFailures] = useState<ValidationFailure[]>([]);

  const isSuperAdminOrDM = role === 'super_admin' || role === 'deal_manager';
  const isFunded = ['funded_active', 'repayment_due', 'overdue'].includes(dealStatus);

  if (!isFunded || !isSuperAdminOrDM) return null;

  const sym = CURRENCY_SYMBOLS[(invoiceCurrency ?? 'GBP') as InvoiceCurrency] ?? '£';

  // Late penalty calculation
  const computePenalty = () => {
    if (!paymentDate || !repaymentDueDate || !advanceAmount || !discountFeePct) {
      return { overdueDays: 0, dailyRate: 0, latePenalty: 0 };
    }
    const payment = parseISO(paymentDate);
    const maturity = parseISO(repaymentDueDate);
    const overdueDays = Math.max(0, differenceInDays(payment, maturity));
    const dailyRate = (discountFeePct * 100) / 30; // discountFeePct is stored as decimal e.g. 0.02
    const latePenalty = advanceAmount * (dailyRate / 100) * overdueDays;
    return { overdueDays, dailyRate, latePenalty };
  };

  const { overdueDays, dailyRate, latePenalty } = computePenalty();

  // Settlement summary
  const received = parseFloat(amountReceived) || 0;
  const residual = received - (advanceAmount ?? 0) - (platformFeeAmount ?? 0) - (discountFeeAmount ?? 0) - latePenalty;

  const handleSubmit = async () => {
    const failures = validateAndScroll([
      { fieldId: 'field-payment-date', label: 'Payment Date', condition: !!paymentDate },
      { fieldId: 'field-amount-received', label: 'Amount Received', condition: !!amountReceived && parseFloat(amountReceived) > 0 },
      { fieldId: 'field-payment-file', label: 'Payment Advice Document', condition: !!paymentFile },
    ]);
    if (failures.length > 0) {
      setPaymentValidationFailures(failures);
      return;
    }
    if (!user) return;
    setPaymentValidationFailures([]);
    setSubmitting(true);
    try {
      // Upload payment advice document
      const filePath = `deals/${dealId}/payment_advice_${Date.now()}_${sanitiseFilename(paymentFile.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, paymentFile);
      if (storageErr) throw storageErr;

      // Create deal document record
      const { data: docData, error: docErr } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        document_type: 'payment_advice' as any,
        file_name: paymentFile.name,
        file_path: filePath,
        file_size_bytes: paymentFile.size,
        mime_type: paymentFile.type,
        uploaded_by: user.id,
      }).select('id').single();
      if (docErr) throw docErr;

      // Update deal with payment info
      const { error: updateErr } = await supabase.from('deals').update({
        status: 'payment_received' as any,
        payment_date: paymentDate,
        payment_amount_received: parseFloat(amountReceived),
        actual_repayment_amount: parseFloat(amountReceived),
        actual_repayment_date: paymentDate,
        payment_advice_doc_id: docData.id,
        late_penalty_amount: latePenalty,
        overdue_days_at_payment: overdueDays,
        residual_balance: residual,
      } as any).eq('id', dealId);
      if (updateErr) throw updateErr;

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'payment_advice_submitted' as any,
        p_metadata: {
          payment_date: paymentDate,
          amount_received: parseFloat(amountReceived),
          late_penalty: latePenalty,
          overdue_days: overdueDays,
          residual_balance: residual,
        },
      });

      toast({ title: 'Payment advice recorded', description: 'Deal status updated to Payment Received — Pending Closure.' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Submission failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Record Buyer Payment</CardTitle>
        </div>
        <CardDescription>Record payment received from the buyer to initiate deal closure.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentValidationFailures.length > 0 && (
          <ValidationSummaryBanner failures={paymentValidationFailures} onDismiss={() => setPaymentValidationFailures([])} />
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Payment Date</Label>
            <Input id="field-payment-date" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Amount Received ({invoiceCurrency ?? 'GBP'})</Label>
            <Input
              id="field-amount-received"
              type="number"
              step="0.01"
              value={amountReceived}
              onChange={e => setAmountReceived(e.target.value)}
              placeholder={`e.g. ${(invoiceValue ?? 0).toLocaleString('en-GB')}`}
              className="h-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Payment Advice Document (SWIFT advice / bank confirmation)</Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setPaymentFile(e.target.files?.[0] ?? null)}
            className="h-8"
          />
        </div>

        {/* Late Penalty Calculation */}
        {overdueDays > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <p className="text-xs font-medium text-destructive">Late Penalty Applies</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Overdue Days</span>
                <p className="font-medium text-foreground">{overdueDays} days</p>
              </div>
              <div>
                <span className="text-muted-foreground">Daily Penalty Rate</span>
                <p className="font-medium text-foreground">{dailyRate.toFixed(4)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Late Penalty</span>
                <p className="font-medium text-destructive">{sym}{latePenalty.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        )}

        {/* Settlement Summary Preview */}
        {received > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Settlement Summary Preview</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Received from Buyer</span>
                <span className="font-medium text-foreground">{sym}{received.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Less: Advance Already Paid to Exporter</span>
                <span className="font-medium text-foreground">− {sym}{(advanceAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Less: Platform Fee</span>
                <span className="font-medium text-foreground">− {sym}{(platformFeeAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Less: Discount Fee</span>
                <span className="font-medium text-foreground">− {sym}{(discountFeeAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              {latePenalty > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Less: Late Penalty</span>
                  <span className="font-medium text-destructive">− {sym}{latePenalty.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="font-medium text-foreground">Residual Balance Due to Exporter</span>
                <span className={`font-semibold ${residual >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {sym}{residual.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              This residual is paid <strong>directly from Veloxis to the Exporter's domiciliary account</strong>. Greystar does not handle or route this payment.
            </p>
          </div>
        )}

        <Button size="sm" onClick={handleSubmit} disabled={submitting || !paymentDate || !amountReceived || !paymentFile}>
          {submitting ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Submitting…</> : 'Submit Payment Advice'}
        </Button>
      </CardContent>
    </Card>
  );
}
