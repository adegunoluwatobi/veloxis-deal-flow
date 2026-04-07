import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DealStatusBadge from '@/components/DealStatusBadge';
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
  exporter_id: string;
  exporters: { company_name: string } | null;
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'sent_to_veloxis', label: 'Submitted to Veloxis' },
  { value: 'rejected', label: 'Rejected' },
];

export default function GreystarDeals() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, deal_reference, status, invoice_number, invoice_value, invoice_currency_v2, buyer_company_name, submitted_at, created_at, exporter_id, exporters(company_name)')
        .order('created_at', { ascending: false });
      setDeals((data as any[]) ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  const currencySymbol = (c: string | null) => {
    const map: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', NGN: '₦' };
    return map[c ?? ''] ?? '';
  };

  const filtered = deals.filter(d => {
    if (tab === 'all') return true;
    if (tab === 'rejected') return d.status === 'rejected_by_partner' || d.status === 'rejected_by_veloxis' || d.status === 'rejected';
    return d.status === tab;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Applications</h1>
        <p className="text-sm text-muted-foreground">Applications submitted by your exporters</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No applications found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((deal) => (
            <Link
              key={deal.id}
              to={`/greystar/deals/${deal.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium text-foreground">{deal.deal_reference || deal.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">
                  {(deal.exporters as any)?.company_name ?? 'Unknown Exporter'} · {deal.buyer_company_name || 'No buyer'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {deal.invoice_value && (
                  <span className="text-sm font-medium text-foreground">
                    {currencySymbol(deal.invoice_currency_v2)}{deal.invoice_value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </span>
                )}
                <DealStatusBadge status={deal.status} portal="partner" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
