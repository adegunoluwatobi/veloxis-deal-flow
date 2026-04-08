import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { CURRENCY_SYMBOLS, type InvoiceCurrency } from '@/types';
import { CheckCircle2, Banknote, Download, Loader2, Send, Upload } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

interface Props {
  dealId: string;
  dealReference: string | null;
  invoiceCurrency: InvoiceCurrency | null;
  invoiceValue?: number | null;
  paymentDate: string | null;
  paymentAmountReceived: number | null;
  paymentReference?: string | null;
  advanceAmount: number | null;
  platformFeeAmount: number | null;
  platformFeePct?: number | null;
  discountFeeAmount: number | null;
  discountFeePct?: number | null;
  paymentTermsDays?: number | null;
  latePenaltyAmount: number | null;
  overdueDaysAtPayment: number | null;
  residualBalance: number | null;
  paymentAdviceDocId: string | null;
  exporterReceiptConfirmedAt: string | null;
  residualSentAt?: string | null;
  residualTransferReference?: string | null;
  residualRemittanceDocId?: string | null;
  dealStatus: string;
  canConfirmReceipt?: boolean;
  onReload: () => void;
}

export default function SettlementSummaryBanner({
  dealId,
  dealReference,
  invoiceCurrency,
  invoiceValue,
  paymentDate,
  paymentAmountReceived,
  paymentReference,
  advanceAmount,
  platformFeeAmount,
  platformFeePct,
  discountFeeAmount,
  discountFeePct,
  paymentTermsDays,
  latePenaltyAmount,
  overdueDaysAtPayment,
  residualBalance,
  paymentAdviceDocId,
  exporterReceiptConfirmedAt,
  residualSentAt,
  residualTransferReference,
  residualRemittanceDocId,
  dealStatus,
  canConfirmReceipt = false,
  onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState('');

  // Send Residual state (Veloxis only)
  const [residualDialogOpen, setResidualDialogOpen] = useState(false);
  const [transferRef, setTransferRef] = useState('');
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);
  const [sendingResidual, setSendingResidual] = useState(false);

  const isPaymentReceived = ['payment_received', 'closed_repaid', 'closed_partial'].includes(dealStatus);
  if (!isPaymentReceived || !paymentDate) return null;

  const sym = CURRENCY_SYMBOLS[(invoiceCurrency ?? 'GBP') as InvoiceCurrency] ?? '£';
  const fmt = (v: number | null) => v != null ? `${sym}${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—';

  const isVeloxis = role === 'super_admin' || role === 'deal_manager';
  const totalDeductions = (advanceAmount ?? 0) + (platformFeeAmount ?? 0) + (discountFeeAmount ?? 0) + (latePenaltyAmount ?? 0);

  // Settlement status badge
  const getSettlementStatus = () => {
    if (exporterReceiptConfirmedAt) return { label: 'Confirmed by Exporter', color: 'bg-success/10 text-success' };
    if (residualSentAt) return { label: 'Residual Sent', color: 'bg-primary/10 text-primary' };
    return { label: 'Pending', color: 'bg-warning/10 text-warning' };
  };
  const settlementStatus = getSettlementStatus();

  const handleDownloadDoc = async (docId: string) => {
    setDownloading(true);
    try {
      const { data: doc } = await supabase.from('deal_documents').select('file_path, file_name').eq('id', docId).single();
      if (!doc) throw new Error('Document not found');
      const { data: urlData } = await supabase.storage.from('veloxis-documents').createSignedUrl(doc.file_path, 60);
      if (urlData?.signedUrl) window.open(urlData.signedUrl, '_blank');
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Download failed', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const handleSendResidual = async () => {
    if (!user || !transferRef.trim() || !remittanceFile) return;
    setSendingResidual(true);
    try {
      const filePath = `deals/${dealId}/residual_remittance_${Date.now()}_${sanitiseFilename(remittanceFile.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, remittanceFile);
      if (storageErr) throw storageErr;

      const { data: docData, error: docErr } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        document_type: 'other' as any,
        file_name: remittanceFile.name,
        file_path: filePath,
        file_size_bytes: remittanceFile.size,
        mime_type: remittanceFile.type,
        uploaded_by: user.id,
      }).select('id').single();
      if (docErr) throw docErr;

      const { error: updateErr } = await supabase.from('deals').update({
        residual_transfer_reference: transferRef.trim(),
        residual_remittance_doc_id: docData.id,
        residual_sent_at: new Date().toISOString(),
        residual_sent_by: user.id,
      } as any).eq('id', dealId);
      if (updateErr) throw updateErr;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'deal_status_changed' as any,
        p_metadata: {
          actor_name: user.email,
          action: 'residual_sent',
          transfer_reference: transferRef.trim(),
          residual_amount: residualBalance,
        },
      });

      toast({ title: 'Residual marked as sent', description: 'Exporter will be able to confirm receipt.' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSendingResidual(false);
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
        p_metadata: { actor_name: user.email, notes: confirmNotes.trim() || undefined },
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
    <div className="space-y-4">
      {/* Settlement & Reconciliation Panel */}
      <Card className="border-success/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <CardTitle className="text-base text-foreground">Settlement & Reconciliation</CardTitle>
            <Badge variant="secondary" className={`text-xs ml-auto ${settlementStatus.color}`}>{settlementStatus.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Payment info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Payment Date</span>
              <p className="font-medium text-foreground">{new Date(paymentDate).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Amount Received</span>
              <p className="font-medium text-foreground">{fmt(paymentAmountReceived)}</p>
            </div>
            {paymentReference && (
              <div>
                <span className="text-muted-foreground text-xs">Payment Reference</span>
                <p className="font-medium text-foreground text-xs">{paymentReference}</p>
              </div>
            )}
          </div>

          {/* Full Settlement Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line Item</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceValue != null && (
                <TableRow>
                  <TableCell className="text-muted-foreground">Invoice Amount</TableCell>
                  <TableCell className="text-right font-medium">{fmt(invoiceValue)}</TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell className="text-muted-foreground">Amount Received from Buyer</TableCell>
                <TableCell className="text-right font-medium">{fmt(paymentAmountReceived)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Advance Already Paid to Exporter</TableCell>
                <TableCell className="text-right font-medium">− {fmt(advanceAmount)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">
                  Platform Fee (one-off{platformFeePct ? `, ${(platformFeePct * 100).toFixed(1)}%` : ''})
                </TableCell>
                <TableCell className="text-right font-medium">− {fmt(platformFeeAmount)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">
                  Discount Fee{discountFeePct ? ` (${(discountFeePct * 100).toFixed(1)}%/month × ${paymentTermsDays ?? 0} days)` : ''}
                </TableCell>
                <TableCell className="text-right font-medium">− {fmt(discountFeeAmount)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">
                  Late Penalty{overdueDaysAtPayment && overdueDaysAtPayment > 0 ? ` (${overdueDaysAtPayment} days × daily rate)` : ''}
                </TableCell>
                <TableCell className="text-right font-medium">
                  − {fmt(latePenaltyAmount ?? 0)}
                  {(latePenaltyAmount ?? 0) > 0 && <span className="text-destructive ml-1">(overdue)</span>}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-medium text-muted-foreground">Total Deductions</TableCell>
                <TableCell className="text-right font-medium">− {fmt(totalDeductions)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2 bg-muted/30">
                <TableCell className="font-semibold text-foreground">Residual Balance Due to Exporter</TableCell>
                <TableCell className={`text-right font-bold ${(residualBalance ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {fmt(residualBalance)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* Payment Advice Document */}
          {paymentAdviceDocId && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Payment Advice:</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => handleDownloadDoc(paymentAdviceDocId)} disabled={downloading}>
                <Download className="mr-1 h-3 w-3" /> {downloading ? 'Loading…' : 'View / Download'}
              </Button>
            </div>
          )}

          {/* Remittance Advice Document (if residual sent) */}
          {residualRemittanceDocId && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Remittance Advice:</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => handleDownloadDoc(residualRemittanceDocId)} disabled={downloading}>
                <Download className="mr-1 h-3 w-3" /> View / Download
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STEP 3 — Send Residual Payment (Veloxis only) */}
      {isVeloxis && dealStatus === 'payment_received' && !residualSentAt && !exporterReceiptConfirmedAt && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Send Residual Payment</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Residual Amount</span>
                <p className="font-medium text-foreground">{fmt(residualBalance)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Exporter Account</span>
                <p className="text-xs text-muted-foreground">Pre-filled from exporter profile</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Transfer Reference *</Label>
              <Input
                value={transferRef}
                onChange={e => setTransferRef(e.target.value)}
                placeholder="Bank transfer reference"
                className="h-8"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Transfer Confirmation / Remittance Advice (upload) *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setRemittanceFile(e.target.files?.[0] ?? null)}
                className="h-8"
              />
            </div>

            <Button
              size="sm"
              onClick={handleSendResidual}
              disabled={sendingResidual || !transferRef.trim() || !remittanceFile}
            >
              {sendingResidual ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending…</> : 'Mark Residual as Sent'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 4 — Confirm Receipt (Exporter only) */}
      {canConfirmReceipt && residualSentAt && !exporterReceiptConfirmedAt && dealStatus === 'payment_received' && (
        <Card className="border-success">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-success" />
              <CardTitle className="text-base text-success">Confirm Receipt of Residual</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              Veloxis has sent {fmt(residualBalance)} to your account.
              {residualTransferReference && <> Reference: <strong>{residualTransferReference}</strong>.</>}
            </p>

            {residualRemittanceDocId && (
              <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => handleDownloadDoc(residualRemittanceDocId)} disabled={downloading}>
                <Download className="mr-1 h-3 w-3" /> View Remittance Advice
              </Button>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Any issues? Describe here (optional)</Label>
              <Textarea
                value={confirmNotes}
                onChange={e => setConfirmNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>

            <Button onClick={handleConfirmReceipt} disabled={confirming} className="gap-1 bg-success hover:bg-success/90">
              {confirming ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {confirming ? 'Confirming…' : 'Confirm I Have Received the Funds'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Exporter: show pending message if residual not yet sent */}
      {canConfirmReceipt && !residualSentAt && !exporterReceiptConfirmedAt && dealStatus === 'payment_received' && (
        <Card className="border-primary/30">
          <CardContent className="py-4 flex items-start gap-3">
            <Banknote className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Payment Received — Settlement in Progress</p>
              <p className="text-sm text-muted-foreground">
                Buyer payment has been received. Veloxis is processing your residual balance of {fmt(residualBalance)}. You will be notified once the transfer is complete.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
