import { useState } from 'react';
import { validateAndScroll } from '@/lib/validation';
import ValidationSummaryBanner from '@/components/ValidationSummaryBanner';
import type { ValidationFailure } from '@/lib/validation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { CURRENCY_SYMBOLS, type InvoiceCurrency } from '@/types';
import { Banknote, Loader2 } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

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
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentValidationFailures, setPaymentValidationFailures] = useState<ValidationFailure[]>([]);

  const isSuperAdminOrDM = role === 'super_admin' || role === 'deal_manager';
  const isFunded = ['funded_active', 'repayment_due', 'overdue'].includes(dealStatus);

  if (!isFunded || !isSuperAdminOrDM) return null;

  const sym = CURRENCY_SYMBOLS[(invoiceCurrency ?? 'GBP') as InvoiceCurrency] ?? '£';

  const computePenalty = () => {
    if (!paymentDate || !repaymentDueDate || !advanceAmount || !discountFeePct) {
      return { overdueDays: 0, dailyRate: 0, latePenalty: 0 };
    }
    const payment = parseISO(paymentDate);
    const maturity = parseISO(repaymentDueDate);
    const overdueDays = Math.max(0, differenceInDays(payment, maturity));
    const dailyRate = (discountFeePct * 100) / 30;
    const latePenalty = advanceAmount * (dailyRate / 100) * overdueDays;
    return { overdueDays, dailyRate, latePenalty };
  };

  const { overdueDays, dailyRate, latePenalty } = computePenalty();

  const received = parseFloat(amountReceived) || 0;
  const totalDeductions = (advanceAmount ?? 0) + (platformFeeAmount ?? 0) + (discountFeeAmount ?? 0) + latePenalty;
  const residual = received - totalDeductions;

  const handleSubmit = async () => {
    const failures = validateAndScroll([
      { fieldId: 'field-payment-date', label: 'Payment Date', condition: !!paymentDate },
      { fieldId: 'field-amount-received', label: 'Amount Received', condition: !!amountReceived && parseFloat(amountReceived) > 0 },
      { fieldId: 'field-payment-reference', label: 'Payment Reference / SWIFT Reference', condition: !!paymentReference.trim() },
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
      const filePath = `deals/${dealId}/payment_advice_${Date.now()}_${sanitiseFilename(paymentFile!.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, paymentFile!);
      if (storageErr) throw storageErr;

      const { data: docData, error: docErr } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        document_type: 'payment_advice' as any,
        file_name: paymentFile!.name,
        file_path: filePath,
        file_size_bytes: paymentFile!.size,
        mime_type: paymentFile!.type,
        uploaded_by: user.id,
      }).select('id').single();
      if (docErr) throw docErr;

      const { error: updateErr } = await supabase.from('deals').update({
        status: 'payment_received' as any,
        payment_date: paymentDate,
        payment_amount_received: parseFloat(amountReceived),
        actual_repayment_amount: parseFloat(amountReceived),
        actual_repayment_date: paymentDate,
        payment_advice_doc_id: docData.id,
        payment_reference: paymentReference.trim(),
        late_penalty_amount: latePenalty,
        overdue_days_at_payment: overdueDays,
        residual_balance: residual,
      } as any).eq('id', dealId);
      if (updateErr) throw updateErr;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'payment_advice_submitted' as any,
        p_metadata: {
          actor_name: user.email,
          payment_date: paymentDate,
          amount_received: parseFloat(amountReceived),
          payment_reference: paymentReference.trim(),
          late_penalty: latePenalty,
          overdue_days: overdueDays,
          residual_balance: residual,
        },
      });

      toast({ title: 'Payment advice recorded', description: 'Application status updated to Payment Received — Pending Settlement.' });
      setOpen(false);
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Submission failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Banknote className="h-4 w-4" /> Record Buyer Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4" /> Record Buyer Payment
          </DialogTitle>
          <DialogDescription>Record payment received from the buyer to initiate settlement.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {paymentValidationFailures.length > 0 && (
            <ValidationSummaryBanner failures={paymentValidationFailures} onDismiss={() => setPaymentValidationFailures([])} />
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Payment Date *</Label>
              <Input id="field-payment-date" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Amount Received ({invoiceCurrency ?? 'GBP'}) *</Label>
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
            <Label className="text-xs text-muted-foreground">Payment Reference / SWIFT Reference *</Label>
            <Input
              id="field-payment-reference"
              value={paymentReference}
              onChange={e => setPaymentReference(e.target.value)}
              placeholder="e.g. SWIFT ref or bank transfer reference"
              className="h-8"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Payment Advice Document (SWIFT advice / bank confirmation) *</Label>
            <Input
              id="field-payment-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setPaymentFile(e.target.files?.[0] ?? null)}
              className="h-8"
            />
          </div>

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

          {received > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Settlement Summary Preview</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Amount</span>
                  <span className="font-medium text-foreground">{sym}{(invoiceValue ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Received from Buyer</span>
                  <span className="font-medium text-foreground">{sym}{received.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Less: Advance Already Paid to Exporter</span>
                  <span className="font-medium text-foreground">− {sym}{(advanceAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Less: Platform Fee (one-off)</span>
                  <span className="font-medium text-foreground">− {sym}{(platformFeeAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Less: Discount Fee</span>
                  <span className="font-medium text-foreground">− {sym}{(discountFeeAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                {latePenalty > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Less: Late Penalty ({overdueDays} days × daily rate)</span>
                    <span className="font-medium text-destructive">− {sym}{latePenalty.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="font-medium text-muted-foreground">Total Deductions</span>
                  <span className="font-medium text-foreground">− {sym}{totalDeductions.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 mt-1">
                  <span className="font-semibold text-foreground">Residual Balance Due to Exporter</span>
                  <span className={`font-bold ${residual >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {sym}{residual.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Button size="sm" onClick={handleSubmit} disabled={submitting || !paymentDate || !amountReceived || !paymentReference.trim() || !paymentFile} className="w-full">
            {submitting ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Submitting…</> : 'Submit Payment Advice'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
