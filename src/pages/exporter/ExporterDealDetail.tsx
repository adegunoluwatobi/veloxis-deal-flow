import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DealStatusBadge from '@/components/DealStatusBadge';
import DealAuditTrail from '@/components/DealAuditTrail';
import { ArrowLeft, Building2, FileText, Globe, CreditCard, AlertTriangle } from 'lucide-react';
import type { DealStatus } from '@/types';
import { Loader2 } from 'lucide-react';

export default function ExporterDealDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => { setDeal(data); setLoading(false); });
  }, [user, id]);

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
      </div>

      {deal.partner_notes && (
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
    </div>
  );
}
