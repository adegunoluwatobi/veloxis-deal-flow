import { useEffect, useState, useCallback, useMemo } from 'react';
import { validateAndScroll, buildPrerequisiteTooltip, type ValidationRule } from '@/lib/validation';
import ValidationSummaryBanner from '@/components/ValidationSummaryBanner';
import type { ValidationFailure } from '@/lib/validation';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import DealStatusBadge from '@/components/DealStatusBadge';
import DealAuditTrail from '@/components/DealAuditTrail';
import { cn } from '@/lib/utils';
import { computeKycStatus, type KycDocumentLike } from '@/lib/computeKycStatus';
import {
  DEAL_STATUS_LABELS, KYC_STATUS_LABELS, ENTITY_TYPE_LABELS,
  COMMODITY_TYPE_LABELS, CURRENCY_SYMBOLS,
  type DealStatus, type KycStatus, type EntityType, type CommodityType, type InvoiceCurrency,
  type AuditAction, type SanctionsScreeningStatus, type BuyerCreditCheckStatus,
} from '@/types';
import {
  ArrowLeft, Building2, ShieldCheck, FileText, Clock, User,
  CheckCircle2, XCircle, AlertTriangle, MessageSquare, Send,
  DollarSign, Globe, Package, Calendar, Percent,
} from 'lucide-react';
import BuyerComplianceSection from '@/components/BuyerComplianceSection';
import SettlementFxSection from '@/components/SettlementFxSection';
import RepaymentFxSection from '@/components/RepaymentFxSection';
import PaymentAdvicePanel from '@/components/PaymentAdvicePanel';
import SettlementSummaryBanner from '@/components/SettlementSummaryBanner';
import IpuUploadSection from '@/components/IpuUploadSection';
import TradePackChecklist from '@/components/TradePackChecklist';
import OverdueActionsPanel from '@/components/OverdueActionsPanel';
import RequestDocsModal from '@/components/RequestDocsModal';
import type { SettlementMethod, RepaymentReconciliationStatus } from '@/types';

interface DealRow {
  id: string;
  status: DealStatus;
  commodity_type: CommodityType | null;
  goods_description: string | null;
  invoice_number: string | null;
  invoice_currency_v2: InvoiceCurrency | null;
  invoice_value: number | null;
  invoice_date: string | null;
  payment_terms_days: number | null;
  advance_percentage: number;
  advance_amount: number | null;
  platform_fee_pct: number | null;
  platform_fee_amount: number | null;
  discount_fee_pct: number | null;
  discount_fee_amount: number | null;
  gross_yield: number | null;
  net_advance_amount: number | null;
  repayment_amount: number | null;
  buyer_company_name: string | null;
  buyer_country: string | null;
  buyer_contact_name: string | null;
  buyer_contact_email: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  exporter_id: string;
  originator_id: string;
}

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  entity_type: EntityType;
  director_name: string;
  country: string;
  kyc_status: KycStatus;
  subscription_tier: string;
}

interface DocRow {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  is_superseded: boolean;
}

interface NoteRow {
  id: string;
  note_body: string;
  created_at: string;
  author_id: string;
}

interface AuditRow {
  id: string;
  action_type: AuditAction;
  created_at: string;
  user_id: string | null;
  metadata: Record<string, unknown>;
}

const AUDIT_LABELS: Partial<Record<AuditAction, string>> = {
  deal_created: 'Deal created',
  deal_submitted: 'Submitted for review',
  deal_moved_to_under_review: 'Moved to under review',
  document_requested: 'Documents requested',
  deal_approved: 'Final approval granted',
  deal_rejected: 'Deal rejected',
  document_uploaded: 'Document uploaded',
  ipu_generated: 'IPU generated',
  ipu_sent: 'IPU sent',
  ipu_signed: 'IPU signed',
  funding_recorded: 'Funding recorded',
  repayment_recorded: 'Repayment recorded',
  deal_closed: 'Deal closed',
  deal_status_changed: 'Status changed',
  pricing_recalculated: 'Pricing recalculated',
  internal_note_added: 'Note added',
};

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const backPath = location.pathname.startsWith('/admin') ? '/admin/deals' : '/deals';

  const [deal, setDeal] = useState<DealRow | null>(null);
  const [exporter, setExporter] = useState<ExporterRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [exporterDocs, setExporterDocs] = useState<KycDocumentLike[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pricingOverride, setPricingOverride] = useState(false);
  const [overrideAdvPct, setOverrideAdvPct] = useState('80');
  const [requestDocsOpen, setRequestDocsOpen] = useState(false);

  // Editable pricing fields
  const [editPlatformFeePct, setEditPlatformFeePct] = useState('0');
  const [editDiscountFeePct, setEditDiscountFeePct] = useState('0');
  const [editAdvPct, setEditAdvPct] = useState('80');
  const [editPaymentTerms, setEditPaymentTerms] = useState('');
  const [pricingSaving, setPricingSaving] = useState(false);

  // Notes
  const [newNote, setNewNote] = useState('');
  const [validationFailures, setValidationFailures] = useState<ValidationFailure[]>([]);

  const isDM = role === 'deal_manager' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const currency = deal?.invoice_currency_v2 ?? 'GBP';
  const computedKyc = useMemo(() => computeKycStatus(exporterDocs), [exporterDocs]);
  const sym = CURRENCY_SYMBOLS[currency] ?? '£';

  const load = useCallback(async () => {
    if (!id) return;
    const [dealRes, docsRes, notesRes, auditRes] = await Promise.all([
      supabase.from('deals').select('*').eq('id', id).single(),
      supabase.from('deal_documents').select('*').eq('deal_id', id).order('uploaded_at', { ascending: false }),
      isDM ? supabase.from('internal_notes').select('*').eq('deal_id', id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      supabase.from('audit_logs').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
    ]);

    if (dealRes.data) {
      const d = dealRes.data as unknown as DealRow;
      setDeal(d);
      setOverrideAdvPct(String(d.advance_percentage));
      setEditAdvPct(String(d.advance_percentage));
      setEditPlatformFeePct(String((d.platform_fee_pct ?? 0) * 100));
      setEditDiscountFeePct(String((d.discount_fee_pct ?? 0) * 100));
      setEditPaymentTerms(String(d.payment_terms_days ?? ''));
      // Load exporter
      const { data: exp } = await supabase.from('exporters').select('*').eq('id', d.exporter_id).single();
      if (exp) {
        setExporter(exp as unknown as ExporterRow);
        // Load active exporter documents for live KYC computation
        const { data: eDocs } = await supabase
          .from('exporter_documents')
          .select('exporter_id, document_type, document_status, expiry_status')
          .eq('exporter_id', d.exporter_id)
          .eq('is_superseded', false);
        setExporterDocs((eDocs ?? []) as KycDocumentLike[]);
      }
    }
    setDocs((docsRes.data as unknown as DocRow[]) ?? []);
    setNotes((notesRes.data as unknown as NoteRow[]) ?? []);
    setAuditLogs((auditRes.data as unknown as AuditRow[]) ?? []);
    setLoading(false);
  }, [id, isDM]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (newStatus: DealStatus, extraFields: Record<string, unknown> = {}) => {
    if (!id || !deal) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('deals')
        .update({ status: newStatus, ...extraFields })
        .eq('id', id);
      if (error) throw error;

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_deal_id: id,
        p_user_id: user?.id,
        p_user_role: role as any,
        p_action_type: `deal_status_changed` as AuditAction,
        p_metadata: { actor_name: user?.email, from: deal.status, to: newStatus, ...extraFields },
      });

      toast({ title: `Deal ${DEAL_STATUS_LABELS[newStatus].toLowerCase()}` });
      load();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Action failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestDocs = () => setRequestDocsOpen(true);
  const handleSubmitForFinalApproval = () => updateStatus('ready_for_final_approval' as DealStatus);

  // Pricing is now read-only — set globally by Super Admin and accepted by exporter at submission
  const pricingEditable = false;

  const handleSavePricing = async () => {
    // No longer needed — pricing is set globally
    toast({ title: 'Info', description: 'Pricing is now managed globally in Admin → Pricing Configuration.' });
  };

  const handleApprove = async () => {
    if (!id || !deal) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('deals').update({
        status: 'approved' as DealStatus,
        approved_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: id,
        p_user_id: user?.id,
        p_user_role: role as any,
        p_action_type: 'deal_approved',
        p_metadata: { actor_name: user?.email, next_status: 'approved' },
      });

      toast({ title: 'Deal approved', description: 'The deal has been approved. IPU process can now begin.' });
      setPricingOverride(false);
      load();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Approval failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendOffer = async () => {
    if (!id || !deal) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('deals').update({
        status: 'pending_exporter_acceptance' as DealStatus,
        offer_declined_at: null,
        offer_declined_by: null,
        offer_decline_reason: null,
      }).eq('id', id);
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: id,
        p_user_id: user?.id,
        p_user_role: role as any,
        p_action_type: 'deal_status_changed' as AuditAction,
        p_metadata: { actor_name: user?.email, from: 'declined_by_exporter', to: 'pending_exporter_acceptance' },
      });

      toast({ title: 'Offer re-sent to exporter' });
      load();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to re-send offer', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecommendRejection = async () => {
    const failures = validateAndScroll([
      { fieldId: 'reject-reason-field', label: 'Rejection reason', condition: !!rejectReason.trim() },
    ]);
    if (failures.length > 0) return;
    await updateStatus('rejection_pending_approval' as DealStatus, { rejection_reason: rejectReason.trim() });
    setRejectOpen(false);
    setRejectReason('');
  };

  const handleFinalReject = async () => {
    const failures = validateAndScroll([
      { fieldId: 'reject-reason-field', label: 'Rejection reason', condition: !!rejectReason.trim() },
    ]);
    if (failures.length > 0) return;
    await updateStatus('rejected', { rejection_reason: rejectReason.trim() });
    setRejectOpen(false);
    setRejectReason('');
  };

  const handleAddNote = async () => {
    if (!id || !user || !newNote.trim()) return;
    const { error } = await supabase.from('internal_notes').insert({
      deal_id: id,
      author_id: user.id,
      note_body: newNote.trim(),
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await supabase.rpc('insert_audit_log', {
        p_deal_id: id,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'internal_note_added',
        p_metadata: {},
      });
      setNewNote('');
      load();
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  if (!deal) return <div className="py-20 text-center text-muted-foreground">Deal not found.</div>;

  const activeDocs = docs.filter(d => !d.is_superseded);

  // Approve prerequisites — pricing accepted by exporter, IPU verified
  const approvePrereqs: ValidationRule[] = [
    { fieldId: 'pricing-card', label: 'Exporter must have accepted pricing', condition: !!(deal as any)?.fee_acceptance_at },
    { fieldId: 'ipu-section', label: 'IPU must be uploaded and verified', condition: !!(deal as any)?.ipu_verified },
  ];
  const approveTooltip = buildPrerequisiteTooltip(approvePrereqs);
  const approveDisabled = actionLoading || approvePrereqs.some(r => !r.condition);
  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(backPath)} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Deals
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {deal.invoice_number || `Deal ${deal.id.slice(0, 8)}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Created {new Date(deal.created_at).toLocaleDateString('en-GB')}
          </p>
        </div>
        <DealStatusBadge status={deal.status} portal="veloxis" />
      </div>

      {/* Rejection banner */}
      {deal.status === 'rejected' && deal.rejection_reason && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <XCircle className="mt-0.5 h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Deal Rejected</p>
            <p className="text-sm text-muted-foreground">{deal.rejection_reason}</p>
          </div>
        </div>
      )}
      {deal.status === ('rejection_pending_approval' as DealStatus) && deal.rejection_reason && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Rejection Recommended</p>
            <p className="text-sm text-muted-foreground">{deal.rejection_reason}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending Super Admin review before finalisation.</p>
          </div>
        </div>
      )}

      {/* Exporter accepted offer banner */}
      {deal.status === 'approved' && (deal as any).offer_accepted_at && (
        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-success shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Exporter Accepted Offer</p>
            <p className="text-sm text-muted-foreground">
              Accepted on {new Date((deal as any).offer_accepted_at).toLocaleDateString('en-GB')} at {new Date((deal as any).offer_accepted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Proceed with sending the IPU to the buyer.
            </p>
          </div>
        </div>
      )}

      {/* Exporter declined offer banner */}
      {deal.status === ('declined_by_exporter' as DealStatus) && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <XCircle className="mt-0.5 h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Exporter Declined Offer</p>
            {(deal as any).offer_decline_reason && (
              <p className="text-sm text-muted-foreground mt-1">Reason: {(deal as any).offer_decline_reason}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">You may revise pricing and re-send the offer.</p>
          </div>
        </div>
      )}

      {/* Pending exporter acceptance banner */}
      {deal.status === ('pending_exporter_acceptance' as DealStatus) && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <Clock className="mt-0.5 h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Awaiting Exporter Response</p>
            <p className="text-sm text-muted-foreground">The facility offer has been sent to the exporter. Waiting for them to accept or decline.</p>
          </div>
        </div>
      )}

      {/* Validation Summary Banner */}
      {validationFailures.length > 0 && (
        <ValidationSummaryBanner failures={validationFailures} onDismiss={() => setValidationFailures([])} />
      )}

      {/* Payment Received Banner & Settlement Summary */}
      <SettlementSummaryBanner
        dealId={deal.id}
        dealReference={(deal as any).deal_reference ?? null}
        invoiceCurrency={deal.invoice_currency_v2}
        paymentDate={(deal as any).payment_date ?? null}
        paymentAmountReceived={(deal as any).payment_amount_received ?? null}
        advanceAmount={deal.advance_amount}
        platformFeeAmount={deal.platform_fee_amount}
        discountFeeAmount={deal.discount_fee_amount}
        latePenaltyAmount={(deal as any).late_penalty_amount ?? null}
        overdueDaysAtPayment={(deal as any).overdue_days_at_payment ?? null}
        residualBalance={(deal as any).residual_balance ?? null}
        paymentAdviceDocId={(deal as any).payment_advice_doc_id ?? null}
        exporterReceiptConfirmedAt={(deal as any).exporter_receipt_confirmed_at ?? null}
        dealStatus={deal.status}
        onReload={load}
      />

      {/* Deal Manager Actions */}
      {isDM && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {/* sent_to_veloxis and under_review both show review actions (no separate "Move to Review" step) */}
              {(deal.status === ('sent_to_veloxis' as DealStatus) || deal.status === 'under_review') && (
                <>
                  {role === 'deal_manager' && (
                    <>
                      <Button size="sm" onClick={handleSubmitForFinalApproval} disabled={actionLoading} className="gap-1">
                        <Send className="h-4 w-4" /> Recommend Approval
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={actionLoading} className="gap-1">
                        <XCircle className="h-4 w-4" /> Recommend Rejection
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleRequestDocs} disabled={actionLoading} className="gap-1">
                        <FileText className="h-4 w-4" /> Request Docs
                      </Button>
                    </>
                  )}
                  {isSuperAdmin && (
                    <>
                      <Button size="sm" onClick={() => setPricingOverride(true)} disabled={approveDisabled} className="gap-1 bg-success hover:bg-success/90" title={approveTooltip ?? undefined}>
                        <CheckCircle2 className="h-4 w-4" /> Approve Deal
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={actionLoading} className="gap-1">
                        <XCircle className="h-4 w-4" /> Reject Deal
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleRequestDocs} disabled={actionLoading} className="gap-1">
                        <FileText className="h-4 w-4" /> Request Docs
                      </Button>
                    </>
                  )}
                </>
              )}
              {/* Ready for final approval — super_admin only */}
              {deal.status === ('ready_for_final_approval' as DealStatus) && isSuperAdmin && (
                <>
                  <Button size="sm" onClick={() => setPricingOverride(true)} disabled={approveDisabled} className="gap-1 bg-success hover:bg-success/90" title={approveTooltip ?? undefined}>
                    <CheckCircle2 className="h-4 w-4" /> Approve Deal
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={actionLoading} className="gap-1">
                    <XCircle className="h-4 w-4" /> Reject Deal
                  </Button>
                </>
              )}
              {deal.status === ('ready_for_final_approval' as DealStatus) && role === 'deal_manager' && (
                <p className="text-sm text-muted-foreground italic">Awaiting final approval from Super Admin.</p>
              )}
              {/* Rejection pending approval — super_admin can finalize or send back */}
              {deal.status === ('rejection_pending_approval' as DealStatus) && isSuperAdmin && (
                <>
                  <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={actionLoading} className="gap-1">
                    <XCircle className="h-4 w-4" /> Confirm Rejection
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus('under_review')} disabled={actionLoading} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Send Back to Review
                  </Button>
                </>
              )}
              {deal.status === ('rejection_pending_approval' as DealStatus) && role === 'deal_manager' && (
                <p className="text-sm text-muted-foreground italic">Rejection recommendation pending Super Admin decision.</p>
              )}
              {deal.status === 'docs_requested' && (
                <Button size="sm" onClick={() => updateStatus('under_review')} disabled={actionLoading} className="gap-1">
                  <Clock className="h-4 w-4" /> Back to Review
                </Button>
              )}
              {/* Declined by exporter — super_admin can re-send offer */}
              {deal.status === ('declined_by_exporter' as DealStatus) && isSuperAdmin && (
                <Button size="sm" onClick={handleResendOffer} disabled={actionLoading} className="gap-1">
                  <Send className="h-4 w-4" /> Re-send Offer to Exporter
                </Button>
              )}
              {/* Pending exporter acceptance — informational */}
              {deal.status === ('pending_exporter_acceptance' as DealStatus) && (
                <p className="text-sm text-muted-foreground italic">Waiting for exporter to accept or decline the facility offer.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Exporter Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Exporter</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {exporter ? (
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium text-foreground">{exporter.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RC Number</span>
                  <span className="font-medium text-foreground">{exporter.rc_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entity</span>
                  <span className="font-medium text-foreground">{ENTITY_TYPE_LABELS[exporter.entity_type]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">KYC</span>
                  <Badge variant="secondary" className={cn("text-xs", computedKyc.color)}>{computedKyc.badgeLabel}</Badge>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        {/* Buyer Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Buyer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium text-foreground">{deal.buyer_company_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium text-foreground">{deal.buyer_country || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact</span>
                <span className="font-medium text-foreground">{deal.buyer_contact_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{deal.buyer_contact_email || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trade Details */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Trade Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commodity</span>
                <span className="font-medium text-foreground">{deal.commodity_type ? COMMODITY_TYPE_LABELS[deal.commodity_type] : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Goods</span>
                <span className="font-medium text-foreground max-w-[200px] truncate">{deal.goods_description || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice #</span>
                <span className="font-medium text-foreground">{deal.invoice_number || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Value</span>
                <span className="font-medium text-foreground">{sym}{(deal.invoice_value ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Date</span>
                <span className="font-medium text-foreground">{deal.invoice_date ? new Date(deal.invoice_date).toLocaleDateString('en-GB') : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms</span>
                <span className="font-medium text-foreground">{deal.payment_terms_days ?? '—'} days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Summary — Read Only */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Pricing Summary</CardTitle>
              <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">Read Only</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Advance ({deal.advance_percentage}%)</span>
                <span className="font-medium text-foreground">{deal.advance_amount ? `${sym}${deal.advance_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee ({((deal.platform_fee_pct ?? 0) * 100).toFixed(1)}%, one-off)</span>
                <span className="font-medium text-foreground">{deal.platform_fee_amount ? `${sym}${deal.platform_fee_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount Fee ({((deal.discount_fee_pct ?? 0) * 100).toFixed(1)}%/month × {deal.payment_terms_days ?? 0} days)</span>
                <span className="font-medium text-foreground">{deal.discount_fee_amount ? `${sym}${deal.discount_fee_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Fees</span>
                <span className="font-medium text-foreground">{sym}{((deal.platform_fee_amount ?? 0) + (deal.discount_fee_amount ?? 0)).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground font-medium">Net Advance to Exporter</span>
                <span className="font-semibold text-foreground">{deal.net_advance_amount ? `${sym}${deal.net_advance_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Expected Yield</span>
                <span className="font-semibold text-foreground">{deal.gross_yield ? `${sym}${deal.gross_yield.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Repayment Amount</span>
                <span className="font-semibold text-foreground">{deal.repayment_amount ? `${sym}${deal.repayment_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
              {(deal as any).fee_acceptance_at && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Exporter accepted these terms on {new Date((deal as any).fee_acceptance_at).toLocaleDateString('en-GB')} at {new Date((deal as any).fee_acceptance_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buyer Compliance — visible to partner admin and Veloxis only, not exporter */}
      {isDM && (
        <BuyerComplianceSection
          dealId={deal.id}
          buyerCountryOfIncorporation={(deal as any).buyer_country_of_incorporation ?? null}
          buyerSanctionsStatus={((deal as any).buyer_sanctions_status ?? 'pending_screening') as SanctionsScreeningStatus}
          buyerCreditCheckStatus={((deal as any).buyer_credit_check_status ?? 'pending') as BuyerCreditCheckStatus}
          buyerUnderwriterNotes={(deal as any).buyer_underwriter_notes ?? null}
          isVeloxis={isDM}
          onReload={load}
        />
      )}

      {/* IPU Upload & Verification */}
      {isDM && (
        <IpuUploadSection
          dealId={deal.id}
          ipuVerified={(deal as any).ipu_verified ?? false}
          ipuVerifiedAt={(deal as any).ipu_verified_at ?? null}
          ipuDocuments={activeDocs.filter(d => d.document_type === 'ipu_signed').map(d => ({ id: d.id, file_name: d.file_name, uploaded_at: d.uploaded_at }))}
          dealStatus={deal.status}
          onReload={load}
        />
      )}

      {/* Record Buyer Payment */}
      <PaymentAdvicePanel
        dealId={deal.id}
        invoiceCurrency={deal.invoice_currency_v2}
        advanceAmount={deal.advance_amount}
        invoiceValue={deal.invoice_value}
        platformFeeAmount={deal.platform_fee_amount}
        discountFeeAmount={deal.discount_fee_amount}
        repaymentDueDate={(deal as any).repayment_due_date ?? null}
        dealStatus={deal.status}
        discountFeePct={deal.discount_fee_pct}
        onReload={load}
      />

      {/* Settlement & FX */}
      {isDM && (
        <SettlementFxSection
          dealId={deal.id}
          invoiceCurrency={deal.invoice_currency_v2}
          settlementCurrency={(deal as any).settlement_currency ?? null}
          settlementMethod={((deal as any).settlement_method ?? null) as SettlementMethod | null}
          fxRateAtFunding={(deal as any).fx_rate_at_funding ?? null}
          ngnEquivalent={(deal as any).ngn_equivalent_at_disbursement ?? null}
          advanceAmount={deal.advance_amount}
          fxRiskAcknowledged={(deal as any).fx_risk_acknowledged ?? false}
          cbnRepatriationDeadline={(deal as any).cbn_repatriation_deadline ?? null}
          dealStatus={deal.status}
          isVeloxis={isDM}
          isExporter={false}
          onReload={load}
        />
      )}

      {/* Repayment FX Reconciliation */}
      <RepaymentFxSection
        dealId={deal.id}
        invoiceCurrency={deal.invoice_currency_v2}
        repaymentAmount={deal.repayment_amount}
        actualRepaymentAmount={(deal as any).actual_repayment_amount ?? null}
        repaymentCurrencyReceived={(deal as any).repayment_currency_received ?? null}
        repaymentFxRate={(deal as any).repayment_fx_rate ?? null}
        repaymentGbpEquivalent={(deal as any).repayment_gbp_equivalent ?? null}
        reconciliationStatus={((deal as any).repayment_reconciliation_status ?? null) as RepaymentReconciliationStatus | null}
        dealStatus={deal.status}
        onReload={load}
      />

      {/* Overdue Actions Panel */}
      <OverdueActionsPanel
        dealId={deal.id}
        dealStatus={deal.status}
        buyerContactEmail={deal.buyer_contact_email}
        buyerCompanyName={deal.buyer_company_name}
        dealReference={(deal as any).deal_reference ?? null}
        overdueDays={(deal as any).overdue_days ?? 0}
        onReload={load}
      />

      {/* Trade Pack Checklist */}
      <TradePackChecklist
        dealId={deal.id}
        documents={activeDocs as any}
        commodityType={deal.commodity_type}
        exportDestination={(deal as any).export_destination ?? null}
        dealStatus={deal.status}
        isVeloxis={isDM}
        onReload={load}
      />

      {/* Internal Notes (DM only) */}
      {isDM && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Internal Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add an internal note…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button size="icon" onClick={handleAddNote} disabled={!newNote.trim()} className="shrink-0 self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {notes.length > 0 && (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-sm text-foreground">{note.note_body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleString('en-GB')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      <DealAuditTrail dealId={deal.id} viewerRole="veloxis" />

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {role === 'deal_manager' ? 'Recommend Rejection' : 
               deal?.status === ('rejection_pending_approval' as DealStatus) ? 'Confirm Rejection' : 'Reject Deal'}
            </DialogTitle>
            <DialogDescription>
              {role === 'deal_manager'
                ? 'Provide a mandatory reason for recommending rejection. This will be reviewed by Super Admin before being sent to the originator.'
                : 'Provide a mandatory reason for rejecting this deal. This will be visible to the originator.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason for rejection</Label>
            <Textarea
              id="reject-reason-field"
              placeholder="Explain why this deal is being rejected…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            {deal?.rejection_reason && deal.status === ('rejection_pending_approval' as DealStatus) && isSuperAdmin && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Deal Manager's recommendation:</p>
                <p className="text-sm text-foreground">{deal.rejection_reason}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={role === 'deal_manager' ? handleRecommendRejection : handleFinalReject} disabled={!rejectReason.trim() || actionLoading}>
              {actionLoading ? 'Processing…' : role === 'deal_manager' ? 'Recommend Rejection' : 'Reject Deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Override Dialog */}
      <Dialog open={pricingOverride} onOpenChange={setPricingOverride}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Deal</DialogTitle>
            <DialogDescription>Confirm or adjust the advance percentage before approving. Pricing will be locked after approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Value</span>
                <span className="font-medium">{sym}{(deal.invoice_value ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms</span>
                <span className="font-medium">{deal.payment_terms_days} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subscription</span>
                <span className="font-medium">{exporter?.subscription_tier === 'veloxis_pro' ? 'Veloxis Pro' : 'Pay As You Go'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Advance Percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={overrideAdvPct}
                  onChange={(e) => setOverrideAdvPct(e.target.value)}
                  className="w-24"
                />
                <Percent className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPricingOverride(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={actionLoading} className="gap-1 bg-success hover:bg-success/90">
              {actionLoading ? 'Approving…' : 'Approve & Lock Pricing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Request Docs Modal */}
      {deal && (
        <RequestDocsModal
          open={requestDocsOpen}
          onOpenChange={setRequestDocsOpen}
          dealId={deal.id}
          commodityType={deal.commodity_type}
          onSent={load}
        />
      )}
    </div>
  );
}
