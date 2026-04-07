import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DealStatusBadge from '@/components/DealStatusBadge';
import { LayoutDashboard, TrendingUp, AlertTriangle, ArrowRight, Banknote } from 'lucide-react';
import type { DealStatus } from '@/types';

interface DealRow {
  id: string;
  status: DealStatus;
  invoice_number: string | null;
  invoice_value: number | null;
  gbp_equivalent: number | null;
  buyer_company_name: string | null;
  created_at: string;
}

interface SystemConfig {
  key: string;
  value: string;
}

export default function DealManagerDashboard() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [config, setConfig] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [dealsRes, configRes] = await Promise.all([
        supabase.from('deals').select('id, status, invoice_number, invoice_value, gbp_equivalent, buyer_company_name, created_at')
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('system_config').select('key, value'),
      ]);
      setDeals((dealsRes.data as DealRow[]) ?? []);
      setConfig((configRes.data as SystemConfig[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const poolGbp = Number(config.find((c) => c.key === 'pilot_pool_gbp')?.value ?? 150000);
  const activeStatuses: DealStatus[] = ['funded_active', 'repayment_due', 'overdue'];
  const deployed = deals
    .filter((d) => activeStatuses.includes(d.status))
    .reduce((sum, d) => sum + (d.gbp_equivalent ?? 0), 0);
  const available = poolGbp - deployed;

  const pendingReview = deals.filter((d) => d.status === 'submitted').length;
  const overdueCount = deals.filter((d) => d.status === 'overdue').length;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Capital Dashboard</h1>
        <p className="text-sm text-muted-foreground">Pilot pool overview and deal pipeline</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pool Size</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">£{poolGbp.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deployed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">£{deployed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{((deployed / poolGbp) * 100).toFixed(1)}% of pool</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">£{available.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{pendingReview}</div>
            {overdueCount > 0 && (
              <p className="text-xs text-destructive">{overdueCount} overdue</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-warning/5 p-3 text-sm text-warning">
        Non-GBP deals are converted to GBP at manually recorded FX rates. Exchange rate movement between advance and repayment is not hedged.
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Deals</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/deals">Full pipeline <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No deals in the system yet.</p>
          ) : (
            <div className="space-y-2">
              {deals.slice(0, 10).map((deal) => (
                <Link
                  key={deal.id}
                  to={`/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-foreground">{deal.invoice_number || deal.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">{deal.buyer_company_name || '—'}</p>
                  </div>
                  <DealStatusBadge status={deal.status} portal="veloxis" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
