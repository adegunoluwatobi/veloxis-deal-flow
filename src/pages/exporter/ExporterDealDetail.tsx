import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DealStatusBadge from '@/components/DealStatusBadge';
import DealAuditTrail from '@/components/DealAuditTrail';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, FileText, Globe, CreditCard, AlertTriangle, Send, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import type { DealStatus } from '@/types';
import type { FlaggedField } from '@/components/ChangeRequestModal';
import { CurrencyInput, stripCommas } from '@/components/ui/currency-input';

export default function ExporterDealDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCR, setPendingCR] = useState<any>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    setDeal(data);

    // Load pending change request
    const { data: crData } = await supabase
      .from('deal_change_requests')
      .select('*')
      .eq('deal_id', id)
      .eq('status', 'pending')
      .maybeSingle();
    setPendingCR(crData);

    // Pre-populate edit values with current deal values for flagged fields
    if (crData && data) {
      const flagged = (crData.fields_flagged ?? []) as unknown as FlaggedField[];
      const vals: Record<string, string> = {};
      for (const f of flagged) {
        vals[f.field] = (data as any)[f.field]?.toString() ?? '';
      }
      setEditValues(vals);
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user, id]);

  const flaggedFields = (pendingCR?.fields_flagged ?? []) as unknown as FlaggedField[];
  const flaggedSet = new Set(flaggedFields.map(f => f.field));
  const hasCR = deal?.status === 'changes_requested' && flaggedFields.length > 0;

  const getNoteForField = (field: string): string | undefined => {
    return flaggedFields.find(f => f.field === field)?.note;
  };

  const handleResubmit = async () => {
    setSubmitting(true);
    try {
      // Build update payload with only flagged fields
      const updatePayload: Record<string, any> = { status: 'submitted' };
      for (const f of flaggedFields) {
        let val: any = editValues[f.field] ?? '';
        if (f.field === 'invoice_value') val = val ? Number(stripCommas(val)) : null;
        else if (val === '') val = null;
        updatePayload[f.field] = val;
      }

      const { error } = await supabase.from('deals').update(updatePayload as any).eq('id', id!);
      if (error) throw error;

      // Resolve change request
      await supabase.from('deal_change_requests')
        .update({ status: 'resolved' as any, resolved_at: new Date().toISOString() })
        .eq('id', pendingCR.id);

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_deal_id: id!,
        p_user_id: user!.id,
        p_user_role: 'exporter' as any,
        p_action_type: 'deal_resubmitted' as any,
        p_metadata: {
          actor_name: user!.email,
          updated_fields: flaggedFields.map(f => f.label),
        },
      });

      toast({ title: 'Application resubmitted successfully' });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDraft = async () => {
    const ok = await confirm({
      title: 'Delete Draft Application',
      description: 'Are you sure you want to delete this draft? This action cannot be undone.',
      variant: 'warning',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from('deals').delete().eq('id', id!);
      if (error) throw error;
      toast({ title: 'Draft deal deleted' });
      navigate('/exporter/deals');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!deal) return <div className="py-20 text-center text-muted-foreground">Deal not found</div>;

  const isFlagged = (field: string) => flaggedSet.has(field);

  // Editable field component — shows input if flagged, otherwise read-only
  const DealField = ({ field, label, value, type = 'text' }: { field: string; label: string; value: string | null | undefined; type?: string }) => {
    const flagged = hasCR && isFlagged(field);
    const note = getNoteForField(field);

    if (!flagged) {
      return (
        <div className={hasCR ? 'opacity-50' : ''}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground">{value || '—'}</p>
        </div>
      );
    }

    return (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {field === 'invoice_value' ? (
          <CurrencyInput
            value={editValues[field] ?? ''}
            onChange={v => setEditValues(prev => ({ ...prev, [field]: v }))}
            className="border-warning bg-warning/5"
          />
        ) : field === 'invoice_currency_v2' ? (
          <Select value={editValues[field] ?? ''} onValueChange={v => setEditValues(prev => ({ ...prev, [field]: v }))}>
            <SelectTrigger className="border-warning bg-warning/5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="NGN">NGN</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            type={type}
            value={editValues[field] ?? ''}
            onChange={e => setEditValues(prev => ({ ...prev, [field]: e.target.value }))}
            className="border-warning bg-warning/5"
          />
        )}
        {note && (
          <p className="text-xs text-warning mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {note}
          </p>
        )}
      </div>
    );
  };

  const MatchBadge = ({ match, label }: { match: boolean | null; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {match === true ? (
        <span className="text-success">✅</span>
      ) : match === false ? (
        <span className="text-destructive">⚠️</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/exporter/deals"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{deal.deal_reference || deal.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">Deal Application</p>
        </div>
        <DealStatusBadge status={deal.status} />
        {deal.status === 'draft' && (
          <>
            <Button asChild>
              <Link to={`/exporter/deals/${deal.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Deal
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleDeleteDraft}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Draft
            </Button>
          </>
        )}
      </div>

      {/* Change Request Banner */}
      {hasCR && (
        <Card className="border-warning">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Changes have been requested for this deal. Please review and update the highlighted fields below.
              </p>
              {flaggedFields.map(f => (
                <p key={f.field} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{f.label}</span>
                  {f.note ? `: ${f.note}` : ''}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legacy partner_notes fallback */}
      {!hasCR && deal.partner_notes && deal.status === 'changes_requested' && (
        <Card className="border-warning">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Changes Requested</p>
              <p className="text-sm text-muted-foreground mt-1">{deal.partner_notes}</p>
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
          <DealField field="bank_name" label="Bank Name" value={deal.bank_name} />
          <DealField field="bank_account_name" label="Account Name" value={deal.bank_account_name} />
          <DealField field="bank_account_number" label="Account Number" value={deal.bank_account_number} />
          <DealField field="bank_sort_code_iban" label="Sort Code / IBAN / SWIFT" value={deal.bank_sort_code_iban} />
          <DealField field="bank_country" label="Bank Country" value={deal.bank_country} />
        </CardContent>
      </Card>

      {/* Invoice Details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Invoice Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <DealField field="invoice_number" label="Invoice Number" value={deal.invoice_number} />
          <DealField field="invoice_date" label="Invoice Date" value={deal.invoice_date} type="date" />
          <DealField field="invoice_value" label="Invoice Amount" value={deal.invoice_value ? `${deal.invoice_currency_v2 ?? ''} ${Number(deal.invoice_value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : null} />
          <DealField field="invoice_currency_v2" label="Invoice Currency" value={deal.invoice_currency_v2} />
          <DealField field="payment_due_date" label="Payment Due Date" value={deal.payment_due_date} type="date" />
        </CardContent>
      </Card>

      {/* Buyer Details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Buyer Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <DealField field="buyer_company_name" label="Company Name" value={deal.buyer_company_name} />
          <DealField field="buyer_country" label="Country" value={deal.buyer_country} />
          <DealField field="buyer_contact_name" label="Contact Name" value={deal.buyer_contact_name} />
          <DealField field="buyer_contact_email" label="Contact Email" value={deal.buyer_contact_email} />
          <DealField field="buyer_contact_phone" label="Contact Phone" value={deal.buyer_contact_phone} />
        </CardContent>
      </Card>

      {/* Export Details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Export Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <DealField field="goods_description" label="Goods Description" value={deal.goods_description} />
          <DealField field="export_destination" label="Destination Country" value={deal.export_destination} />
          <DealField field="export_licence_number" label="Export Licence Number" value={deal.export_licence_number} />
          <DealField field="hs_code" label="HS Code" value={deal.hs_code} />
          <DealField field="incoterms" label="Incoterms" value={deal.incoterms} />
        </CardContent>
      </Card>

      {/* Resubmit Button */}
      {hasCR && (
        <div className="flex justify-end">
          <Button onClick={handleResubmit} disabled={submitting} size="lg">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Resubmit Deal
          </Button>
        </div>
      )}

      {/* Audit Trail */}
      <DealAuditTrail dealId={deal.id} viewerRole="exporter" />
    </div>
  );
}
