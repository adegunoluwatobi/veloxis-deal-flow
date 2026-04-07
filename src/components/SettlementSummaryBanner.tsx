import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CURRENCY_SYMBOLS, type InvoiceCurrency, type AuditAction } from '@/types';
import { CheckCircle2, Banknote, Download, Loader2 } from 'lucide-react';

interface Props {
  dealId: string;
  dealReference: string | null;
  invoiceCurrency: InvoiceCurrency | null;
  paymentDate: string | null;
  paymentAmountReceived: number | null;
  advanceAmount: number | null;
  platformFeeAmount: number | null;
  discountFeeAmount: number | null;
  latePenaltyAmount: number | null;
  overdueDaysAtPayment: number | null;
  residualBalance: number | null;
  paymentAdviceDocId: string | null;
  exporterReceiptConfirmedAt: string | null;
  dealStatus: string;
  /** Can this viewer confirm receipt? (exporter only) */
  canConfirmReceipt?: boolean;
  onReload: () => void;
}

export default function SettlementSummaryBanner({
  dealId,
  dealReference,
  invoiceCurrency,
  paymentDate,
  paymentAmountReceived,
  advanceAmount,
  platformFeeAmount,
  discountFeeAmount,
  latePenaltyAmount,
  overdueDaysAtPayment,
  residualBalance,
  paymentAdviceDocId,
  exporterReceiptConfirmedAt,
  dealStatus,
  canConfirmReceipt = false,
  onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isPaymentReceived = dealStatus === 'payment_received' || dealStatus === 'closed_repaid' || dealStatus === 'closed_partial';
  if (!isPaymentReceived || !paymentDate) return null;

  const sym = CURRENCY_SYMBOLS[(invoiceCurrency ?? 'GBP') as InvoiceCurrency] ?? '£';

  const handleDownloadAdvice = async () => {
    if (!paymentAdviceDocId) return;
    setDownloading(true);
    try {
      const { data: doc } = await supabase.from('deal_documents').select('file_path, file_name').eq('id', paymentAdviceDocId).single();
      if (!doc) throw new Error('Document not found');
      const { data: urlData } = await supabase.storage.from('veloxis-documents').createSignedUrl(doc.file_path, 60);
      if (urlData?.signedUrl) {
        window.open(urlData.signedUrl, '_blank');
      }
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Download failed', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!user) return;
    setConfirming(true);
    try {
      const { error } = await supabase.from('deals').update({
        exporter_receipt_confirmed_at: new Date().toISOString(),
        status: 'closed_repaid' as any,
      } as any).eq('id', dealId);
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'exporter_receipt_confirmed' as any,
        p_metadata: { actor_name: user.email },
      });

      toast({ title: 'Receipt confirmed', description: 'Application has been closed as Repaid.' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Confirmation failed', variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card className="border-success/30 bg-success/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <CardTitle className="text-base text-foreground">Payment Received</CardTitle>
          {exporterReceiptConfirmedAt && (
            <Badge variant="secondary" className="bg-success/10 text-success text-xs ml-auto">Exporter Confirmed ✓</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment info */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Payment Date</span>
            <p className="font-medium text-foreground">{new Date(paymentDate).toLocaleDateString('en-GB')}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Amount Received</span>
            <p className="font-medium text-foreground">{sym}{(paymentAmountReceived ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Payment Advice</span>
            {paymentAdviceDocId ? (
              <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={handleDownloadAdvice} disabled={downloading}>
                <Download className="mr-1 h-3 w-3" /> {downloading ? 'Loading…' : 'View Document'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* Settlement Summary Table */}
        <div className="rounded-lg border border-border bg-background p-3 space-y-1 text-sm">
          <p className="text-xs font-medium text-foreground mb-2">Settlement Summary</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount Received from Buyer</span>
            <span className="font-medium text-foreground">{sym}{(paymentAmountReceived ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
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
          {(latePenaltyAmount ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Less: Late Penalty ({overdueDaysAtPayment ?? 0} days)</span>
              <span className="font-medium text-destructive">− {sym}{(latePenaltyAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="font-medium text-foreground">Residual Balance Due to Exporter</span>
            <span className={`font-semibold ${(residualBalance ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {sym}{(residualBalance ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            This residual is paid <strong>directly from Veloxis to the Exporter's domiciliary account</strong>. Greystar does not handle or route this payment.
          </p>
        </div>

        {/* Exporter Confirm Receipt */}
        {canConfirmReceipt && !exporterReceiptConfirmedAt && dealStatus === 'payment_received' && (
          <Button onClick={handleConfirmReceipt} disabled={confirming} className="gap-1">
            {confirming ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {confirming ? 'Confirming…' : 'Confirm Receipt of Residual'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
