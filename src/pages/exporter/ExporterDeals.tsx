import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DealStatusBadge from '@/components/DealStatusBadge';
import { Plus } from 'lucide-react';
import type { DealStatus } from '@/types';

interface DealRow {
  id: string;
  deal_reference: string | null;
  status: DealStatus;
  invoice_number: string | null;
  invoice_value: number | null;
  invoice_currency_v2: string | null;
  buyer_company_name: string | null;
  submitted_at: string | null;
  created_at: string;
}

const REQUIRED_KYC_DOC_TYPES = ['cac_certificate', 'director_id', 'nepc_certificate'] as const;

export default function ExporterDeals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDocsComplete, setAllDocsComplete] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: exp } = await supabase
        .from('exporters')
        .select('id, registered_address_line1, registered_city')
        .eq('exporter_user_id', user.id)
        .maybeSingle();
      if (!exp) { setLoading(false); return; }

      const [{ data: dealsData }, { data: docsData }] = await Promise.all([
        supabase
          .from('deals')
          .select('id, deal_reference, status, invoice_number, invoice_value, invoice_currency_v2, buyer_company_name, submitted_at, created_at')
          .eq('exporter_id', exp.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('exporter_documents')
          .select('document_type')
          .eq('exporter_id', exp.id)
          .eq('is_superseded', false),
      ]);

      setDeals((dealsData as DealRow[]) ?? []);
      const uploadedTypes = new Set((docsData ?? []).map((d) => d.document_type));
      const docsOk = REQUIRED_KYC_DOC_TYPES.every((t) => uploadedTypes.has(t));
      const addressOk = !!(exp.registered_address_line1 && exp.registered_city);
      setAllDocsComplete(docsOk && addressOk);
      setLoading(false);
    };
    load();
  }, [user]);

  const currencySymbol = (c: string | null) => {
    const map: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', NGN: '₦' };
    return map[c ?? ''] ?? '';
  };

  const submitButton = (key: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={!allDocsComplete ? 'cursor-not-allowed' : undefined}>
          <Button
            disabled={!allDocsComplete}
            onClick={() => navigate('/exporter/deals/new')}
            className="disabled:pointer-events-none disabled:opacity-60"
          >
            <Plus className="mr-2 h-4 w-4" />Submit Application
          </Button>
        </span>
      </TooltipTrigger>
      {!allDocsComplete && (
        <TooltipContent side="bottom" className="max-w-xs">
          Upload all 4 KYC documents (CAC Certificate, Director ID, Export Licence, Registered Address Proof) to enable new applications.
        </TooltipContent>
      )}
    </Tooltip>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Applications</h1>
          <p className="text-sm text-muted-foreground">Your trade finance applications</p>
        </div>
        {submitButton('header')}
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : deals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">You have no applications yet. Submit your first application to get started.</p>
            {submitButton('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => (
            <Link
              key={deal.id}
              to={`/exporter/deals/${deal.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium text-foreground">{deal.deal_reference || deal.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">
                  {deal.buyer_company_name || 'No buyer'} · {deal.invoice_number || 'No invoice'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {deal.invoice_value && (
                  <span className="text-sm font-medium text-foreground">
                    {currencySymbol(deal.invoice_currency_v2)}{deal.invoice_value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </span>
                )}
                <DealStatusBadge status={deal.status} portal="exporter" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
