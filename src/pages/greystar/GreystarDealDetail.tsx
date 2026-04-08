import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { validateAndScroll, buildPrerequisiteTooltip } from '@/lib/validation';
import ValidationSummaryBanner from '@/components/ValidationSummaryBanner';
import type { ValidationFailure } from '@/lib/validation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import DealStatusBadge from '@/components/DealStatusBadge';
import DealAuditTrail from '@/components/DealAuditTrail';
import ChangeRequestModal, { type FlaggedField } from '@/components/ChangeRequestModal';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, FileText, Globe, CreditCard, AlertTriangle, CheckCircle2, Send, XCircle, Loader2, Clock } from 'lucide-react';
import DealLifecycleBanner from '@/components/DealLifecycleBanner';
import type { DealStatus } from '@/types';
import { CURRENCY_SYMBOLS, type InvoiceCurrency } from '@/types';
import SettlementSummaryBanner from '@/components/SettlementSummaryBanner';

export default function GreystarDealDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [deal, setDeal] = useState<any>(null);
  const [exporter, setExporter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingCR, setPendingCR] = useState<any>(null);
  const [validationFailures, setValidationFailures] = useState<ValidationFailure[]>([]);

  const loadDeal = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('deals')
      .select('*, exporters(company_name, contact_email)')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      setDeal(data);
      setExporter((data as any).exporters);
    }

    // Load pending change request
    const { data: crData } = await supabase
      .from('deal_change_requests')
      .select('*')
      .eq('deal_id', id)
      .eq('status', 'pending')
      .maybeSingle();
    setPendingCR(crData);

    setLoading(false);
  };

  useEffect(() => { loadDeal(); }, [id]);

  const handleChangeRequest = async (fields: FlaggedField[]) => {
    setSubmitting(true);
    try {
      // If there's already a pending CR, merge fields
      if (pendingCR) {
        const existing = (pendingCR.fields_flagged as FlaggedField[]) || [];
        const merged = [...existing];
        for (const f of fields) {
          const idx = merged.findIndex(m => m.field === f.field);
          if (idx >= 0) merged[idx] = f;
          else merged.push(f);
        }
        await supabase
          .from('deal_change_requests')
          .update({ fields_flagged: merged as any })
          .eq('id', pendingCR.id);
      } else {
        await supabase
          .from('deal_change_requests')
          .insert({
            deal_id: id!,
            requested_by: user!.id,
            fields_flagged: fields as any,
            status: 'pending' as any,
          });
      }

      // Update deal status
      await supabase.from('deals').update({ status: 'changes_requested' as any }).eq('id', id!);

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_deal_id: id!,
        p_user_id: user!.id,
        p_user_role: 'partner_admin' as any,
        p_action_type: 'deal_changes_requested' as any,
        p_metadata: {
          actor_name: user!.email,
          flagged_fields: fields.map(f => f.label),
          note: fields.map(f => `${f.label}: ${f.note || '(no note)'}`).join('; '),
        },
      });

      toast({ title: 'Change request sent' });
      setChangeRequestOpen(false);
      await loadDeal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelCR = async () => {
    if (!pendingCR) return;
    setSubmitting(true);
    try {
      await supabase
        .from('deal_change_requests')
        .update({ status: 'cancelled' as any })
        .eq('id', pendingCR.id);
      await supabase.from('deals').update({ status: 'submitted' as any }).eq('id', id!);
      toast({ title: 'Change request cancelled' });
      await loadDeal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    const failures = validateAndScroll([
      { fieldId: 'partner-reject-reason', label: 'Rejection reason', condition: !!rejectReason.trim() },
    ]);
    if (failures.length > 0) return;
    setSubmitting(true);
    try {
      await supabase.from('deals').update({
        status: 'rejected_by_partner' as any,
        rejection_reason: rejectReason,
        rejected_at: new Date().toISOString(),
      }).eq('id', id!);

      await supabase.rpc('insert_audit_log', {
        p_deal_id: id!,
        p_user_id: user!.id,
        p_user_role: 'partner_admin' as any,
        p_action_type: 'deal_rejected_by_partner' as any,
        p_metadata: { actor_name: user!.email, reason: rejectReason },
      });

      toast({ title: 'Application rejected' });
      setRejectOpen(false);
      setRejectReason('');
      await loadDeal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitToVeloxis = async () => {
    // Validate required fields before submission
    const rules = [
      { fieldId: 'field-buyer-company', label: 'Buyer Company Name', condition: !!deal?.buyer_company_name },
      { fieldId: 'field-buyer-country', label: 'Buyer Country', condition: !!deal?.buyer_country },
      { fieldId: 'field-invoice-number', label: 'Invoice Number', condition: !!deal?.invoice_number },
      { fieldId: 'field-invoice-value', label: 'Invoice Value', condition: !!(deal?.invoice_value && deal.invoice_value > 0) },
    ];
    const failures = validateAndScroll(rules);
    if (failures.length > 0) {
      setValidationFailures(failures);
      return;
    }
    setValidationFailures([]);
    setSubmitting(true);
    try {
      await supabase.from('deals').update({
        status: 'under_review' as any,
        sent_to_veloxis_at: new Date().toISOString(),
      }).eq('id', id!);

      await supabase.rpc('insert_audit_log', {
        p_deal_id: id!,
        p_user_id: user!.id,
        p_user_role: 'partner_admin' as any,
        p_action_type: 'deal_sent_to_veloxis' as any,
        p_metadata: { actor_name: user!.email },
      });

      toast({ title: 'Deal submitted to underwriter' });
      await loadDeal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!deal) return <div className="py-20 text-center text-muted-foreground">Application not found</div>;

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  );

  const MatchBadge = ({ match, label }: { match: boolean | null; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {match === true ? <CheckCircle2 className="h-4 w-4 text-success" /> : match === false ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <span className="text-muted-foreground">—</span>}
      <span>{label}</span>
    </div>
  );

  const canSubmitToVeloxis = deal.status === 'submitted' && deal.bank_name_match !== false;

  // Submit to Veloxis prerequisites tooltip
  const submitPrereqs = [
    { fieldId: 'field-buyer-company', label: 'Buyer company name required', condition: !!deal?.buyer_company_name },
    { fieldId: 'field-buyer-country', label: 'Buyer country required', condition: !!deal?.buyer_country },
    { fieldId: 'field-invoice-number', label: 'Invoice number required', condition: !!deal?.invoice_number },
    { fieldId: 'field-invoice-value', label: 'Invoice value required', condition: !!(deal?.invoice_value && deal.invoice_value > 0) },
    { fieldId: 'field-bank-match', label: 'Bank name must match company name', condition: deal?.bank_name_match !== false },
  ];
  const submitTooltip = canSubmitToVeloxis ? buildPrerequisiteTooltip(submitPrereqs) : 'Application must be in Submitted status';

  // Show pending CR info
  const crFields: FlaggedField[] = pendingCR?.fields_flagged ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/greystar/deals"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{deal.deal_reference || deal.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">{exporter?.company_name ?? 'Unknown Exporter'}</p>
        </div>
        <DealStatusBadge status={deal.status} portal="partner" />
      </div>
      {/* Validation Summary Banner */}
      {validationFailures.length > 0 && (
        <ValidationSummaryBanner failures={validationFailures} onDismiss={() => setValidationFailures([])} />
      )}

      {/* Facility Offer Panel — read-only for partner when pending exporter acceptance or declined */}
      {(deal.status === 'pending_exporter_acceptance' || deal.status === 'declined_by_exporter') && (() => {
        const psym = CURRENCY_SYMBOLS[(deal.invoice_currency_v2 as InvoiceCurrency) ?? 'GBP'] ?? '£';
        const pfmt = (v: number | null) => v != null ? `${psym}${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—';
        return (
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Facility Offer Sent to Exporter
                </CardTitle>
                <Badge variant="secondary" className={deal.status === 'pending_exporter_acceptance' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}>
                  {deal.status === 'pending_exporter_acceptance' ? 'Awaiting Exporter Response' : 'Declined by Exporter'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {deal.status === 'declined_by_exporter' && deal.offer_decline_reason && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Exporter declined</p>
                    <p className="text-sm text-muted-foreground">{deal.offer_decline_reason}</p>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60%]">Field</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>Invoice Amount</TableCell><TableCell className="font-medium">{pfmt(deal.invoice_value)}</TableCell></TableRow>
                  <TableRow><TableCell>Advance %</TableCell><TableCell className="font-medium">{deal.advance_percentage}%</TableCell></TableRow>
                  <TableRow><TableCell>Advance Amount</TableCell><TableCell className="font-medium">{pfmt(deal.advance_amount)}</TableCell></TableRow>
                  <TableRow><TableCell>Platform Fee (one-off)</TableCell><TableCell className="font-medium">{pfmt(deal.platform_fee_amount)}</TableCell></TableRow>
                  <TableRow><TableCell>Discount Fee</TableCell><TableCell className="font-medium">{pfmt(deal.discount_fee_amount)}</TableCell></TableRow>
                  <TableRow><TableCell>Total Fees</TableCell><TableCell className="font-medium">{pfmt(deal.gross_yield)}</TableCell></TableRow>
                  <TableRow className="border-t-2"><TableCell className="font-semibold">Net Advance to Exporter</TableCell><TableCell className="font-bold">{pfmt(deal.net_advance_amount)}</TableCell></TableRow>
                  <TableRow><TableCell>Payment Terms</TableCell><TableCell className="font-medium">{deal.payment_terms_days ?? '—'} days</TableCell></TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground italic">The partner cannot accept or decline on the exporter's behalf.</p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Actions */}
      {(deal.status === 'submitted' || deal.status === 'changes_requested') && (
        <Card>
          <CardContent className="py-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setChangeRequestOpen(true)}>
              Request Changes
            </Button>
            {pendingCR && deal.status === 'changes_requested' && (
              <Button variant="ghost" onClick={handleCancelCR} disabled={submitting}>
                Cancel Change Request
              </Button>
            )}
            <Button variant="destructive" onClick={() => setRejectOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" />Reject Application
            </Button>
            {canSubmitToVeloxis && (
              <Button onClick={handleSubmitToVeloxis} disabled={submitting || !canSubmitToVeloxis} title={submitTooltip ?? undefined}>
                <Send className="mr-2 h-4 w-4" />Submit to Underwriter
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Change Request Summary */}
      {pendingCR && crFields.length > 0 && (
        <Card className="border-warning">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Active Change Request — {crFields.length} field{crFields.length !== 1 ? 's' : ''} flagged</p>
                {crFields.map(f => (
                  <p key={f.field} className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{f.label}</span>
                    {f.note ? `: ${f.note}` : ''}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lifecycle Status Banners + Pricing */}
      <DealLifecycleBanner deal={deal} portal="partner" />

      {/* Payment Received Banner & Settlement Summary */}
      <SettlementSummaryBanner
        dealId={deal.id}
        dealReference={deal.deal_reference ?? null}
        invoiceCurrency={deal.invoice_currency_v2}
        invoiceValue={deal.invoice_value}
        paymentDate={deal.payment_date ?? null}
        paymentAmountReceived={deal.payment_amount_received ?? null}
        paymentReference={deal.payment_reference ?? null}
        advanceAmount={deal.advance_amount}
        platformFeeAmount={deal.platform_fee_amount}
        platformFeePct={deal.platform_fee_pct}
        discountFeeAmount={deal.discount_fee_amount}
        discountFeePct={deal.discount_fee_pct}
        paymentTermsDays={deal.payment_terms_days}
        latePenaltyAmount={deal.late_penalty_amount ?? null}
        overdueDaysAtPayment={deal.overdue_days_at_payment ?? null}
        residualBalance={deal.residual_balance ?? null}
        paymentAdviceDocId={deal.payment_advice_doc_id ?? null}
        exporterReceiptConfirmedAt={deal.exporter_receipt_confirmed_at ?? null}
        residualSentAt={deal.residual_sent_at ?? null}
        residualTransferReference={deal.residual_transfer_reference ?? null}
        residualRemittanceDocId={deal.residual_remittance_doc_id ?? null}
        dealStatus={deal.status}
        onReload={loadDeal}
      />

      {/* Fee & Pricing Summary — always visible to partner when pricing data exists */}
      {deal.invoice_value != null && deal.advance_amount != null && (
        <Card>
          <CardHeader><CardTitle className="text-base">Fee & Pricing Summary</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow><TableCell className="text-muted-foreground">Invoice Amount</TableCell><TableCell className="text-right font-medium">{pfmt(deal.invoice_value)}</TableCell></TableRow>
                <TableRow><TableCell className="text-muted-foreground">Advance Rate</TableCell><TableCell className="text-right font-medium">{deal.advance_percentage}%</TableCell></TableRow>
                <TableRow><TableCell className="text-muted-foreground">Advance Amount</TableCell><TableCell className="text-right font-medium">{pfmt(deal.advance_amount)}</TableCell></TableRow>
                <TableRow><TableCell className="text-muted-foreground">Platform Fee ({((deal.platform_fee_pct ?? 0) * 100).toFixed(1)}%)</TableCell><TableCell className="text-right font-medium">{pfmt(deal.platform_fee_amount)}</TableCell></TableRow>
                <TableRow><TableCell className="text-muted-foreground">Discount Fee ({((deal.discount_fee_pct ?? 0) * 100).toFixed(1)}%)</TableCell><TableCell className="text-right font-medium">{pfmt(deal.discount_fee_amount)}</TableCell></TableRow>
                <TableRow><TableCell className="text-muted-foreground">Total Fees</TableCell><TableCell className="text-right font-medium">{pfmt(deal.gross_yield)}</TableCell></TableRow>
                <TableRow className="border-t-2"><TableCell className="font-semibold">Net Advance to Exporter</TableCell><TableCell className="text-right font-bold">{pfmt(deal.net_advance_amount)}</TableCell></TableRow>
                <TableRow><TableCell className="text-muted-foreground">Payment Terms</TableCell><TableCell className="text-right font-medium">{deal.payment_terms_days ?? '—'} days</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Name Match Summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">Name Matching</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <MatchBadge match={deal.bank_name_match} label="Bank account name vs company name" />
          <MatchBadge match={deal.buyer_name_match} label="Buyer name vs invoice buyer" />
          <MatchBadge match={deal.licence_name_match} label="Export licence business name vs company name" />
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" />Bank Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Bank Name" value={deal.bank_name} />
          <Field label="Account Name" value={deal.bank_account_name} />
          <Field label="Account Number" value={deal.bank_account_number} />
          <Field label="Sort Code / IBAN" value={deal.bank_sort_code_iban} />
          <Field label="Bank Country" value={deal.bank_country} />
        </CardContent>
      </Card>

      {/* Invoice Details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Invoice Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Invoice Number" value={deal.invoice_number} />
          <Field label="Invoice Date" value={deal.invoice_date} />
          <Field label="Invoice Amount" value={deal.invoice_value ? `${deal.invoice_currency_v2 ?? ''} ${Number(deal.invoice_value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : null} />
          <Field label="Payment Due Date" value={deal.payment_due_date} />
        </CardContent>
      </Card>

      {/* Buyer Details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Buyer Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Company Name" value={deal.buyer_company_name} />
          <Field label="Country" value={deal.buyer_country} />
          <Field label="Contact Name" value={deal.buyer_contact_name} />
          <Field label="Contact Email" value={deal.buyer_contact_email} />
          <Field label="Contact Phone" value={deal.buyer_contact_phone} />
        </CardContent>
      </Card>

      {/* Export Details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Export Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Goods Description" value={deal.goods_description} />
          <Field label="Destination Country" value={deal.export_destination} />
          <Field label="Export Licence Number" value={deal.export_licence_number} />
          <Field label="HS Code" value={deal.hs_code} />
          <Field label="Incoterms" value={deal.incoterms} />
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <DealAuditTrail dealId={deal.id} viewerRole="partner" />

      {/* Change Request Modal */}
      <ChangeRequestModal
        open={changeRequestOpen}
        onClose={() => setChangeRequestOpen(false)}
        onSubmit={handleChangeRequest}
        submitting={submitting}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={() => setRejectOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this application.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection reason *</Label>
            <Textarea id="partner-reject-reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || submitting} onClick={handleReject}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
