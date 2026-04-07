import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import DealStatusBadge from '@/components/DealStatusBadge';
import DealAuditTrail from '@/components/DealAuditTrail';
import ChangeRequestModal, { type FlaggedField } from '@/components/ChangeRequestModal';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, FileText, Globe, CreditCard, AlertTriangle, CheckCircle2, Send, XCircle, Loader2 } from 'lucide-react';
import type { DealStatus } from '@/types';

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

      toast({ title: 'Deal rejected' });
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
    setSubmitting(true);
    try {
      await supabase.from('deals').update({
        status: 'sent_to_veloxis' as any,
        sent_to_veloxis_at: new Date().toISOString(),
      }).eq('id', id!);

      await supabase.rpc('insert_audit_log', {
        p_deal_id: id!,
        p_user_id: user!.id,
        p_user_role: 'partner_admin' as any,
        p_action_type: 'deal_sent_to_veloxis' as any,
        p_metadata: { actor_name: user!.email },
      });

      toast({ title: 'Deal submitted to Veloxis' });
      await loadDeal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!deal) return <div className="py-20 text-center text-muted-foreground">Deal not found</div>;

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
        <DealStatusBadge status={deal.status} />
      </div>

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
              <XCircle className="mr-2 h-4 w-4" />Reject Deal
            </Button>
            {canSubmitToVeloxis && (
              <Button onClick={handleSubmitToVeloxis} disabled={submitting}>
                <Send className="mr-2 h-4 w-4" />Submit to Veloxis
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
          <Field label="Sort Code / IBAN / SWIFT" value={deal.bank_sort_code_iban} />
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
            <DialogTitle>Reject Deal</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this deal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection reason *</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || submitting} onClick={handleReject}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Reject Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
