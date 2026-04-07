import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

export default function ExporterDeals() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporterId, setExporterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: exp } = await supabase
        .from('exporters')
        .select('id')
        .eq('exporter_user_id', user.id)
        .maybeSingle();
      if (!exp) { setLoading(false); return; }
      setExporterId(exp.id);

      const { data } = await supabase
        .from('deals')
        .select('id, deal_reference, status, invoice_number, invoice_value, invoice_currency_v2, buyer_company_name, submitted_at, created_at')
        .eq('exporter_id', exp.id)
        .order('created_at', { ascending: false });
      setDeals((data as DealRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  const currencySymbol = (c: string | null) => {
    const map: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', NGN: '₦' };
    return map[c ?? ''] ?? '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Applications</h1>
          <p className="text-sm text-muted-foreground">Your trade finance applications</p>
        </div>
        <Button asChild>
          <Link to="/exporter/deals/new"><Plus className="mr-2 h-4 w-4" />Submit Application</Link>
        </Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : deals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">You have no deals yet. Submit your first deal to get started.</p>
            <Button asChild>
              <Link to="/exporter/deals/new"><Plus className="mr-2 h-4 w-4" />Submit Deal</Link>
            </Button>
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
                <DealStatusBadge status={deal.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
