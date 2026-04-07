import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import DealStatusBadge from '@/components/DealStatusBadge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, FileText, Globe, CreditCard, AlertTriangle, CheckCircle2, Send, XCircle, MessageSquare, Loader2 } from 'lucide-react';
import type { DealStatus } from '@/types';

export default function GreystarDealDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deal, setDeal] = useState<any>(null);
  const [exporter, setExporter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<'changes' | 'reject' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setLoading(false);
  };

  useEffect(() => { loadDeal(); }, [id]);

  const updateStatus = async (status: DealStatus, extra: Record<string, any> = {}) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('deals')
        .update({ status, ...extra })
        .eq('id', id!);
      if (error) throw error;
      toast({ title: `Deal ${status.replace(/_/g, ' ')}` });
      await loadDeal();
      setActionDialog(null);
      setActionNote('');
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
            <Button variant="outline" onClick={() => setActionDialog('changes')}>
              <MessageSquare className="mr-2 h-4 w-4" />Request Changes
            </Button>
            <Button variant="destructive" onClick={() => setActionDialog('reject')}>
              <XCircle className="mr-2 h-4 w-4" />Reject Deal
            </Button>
            {canSubmitToVeloxis && (
              <Button onClick={() => updateStatus('sent_to_veloxis' as DealStatus, { sent_to_veloxis_at: new Date().toISOString() })}>
                <Send className="mr-2 h-4 w-4" />Submit to Veloxis
              </Button>
            )}
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

      {/* Request Changes Dialog */}
      <Dialog open={actionDialog === 'changes'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>Send a note to the exporter explaining what needs to be changed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note to exporter *</Label>
            <Textarea value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="Please update..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button disabled={!actionNote.trim() || submitting} onClick={() => updateStatus('changes_requested' as DealStatus, { partner_notes: actionNote })}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === 'reject'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Deal</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this deal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection reason *</Label>
            <Textarea value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="Reason for rejection..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!actionNote.trim() || submitting} onClick={() => updateStatus('rejected_by_partner' as DealStatus, { rejection_reason: actionNote, rejected_at: new Date().toISOString() })}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Reject Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
