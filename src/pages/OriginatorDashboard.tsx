import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DealStatusBadge from '@/components/DealStatusBadge';
import { FileText, Users, Plus, ArrowRight } from 'lucide-react';
import type { DealStatus } from '@/types';

interface DealRow {
  id: string;
  status: DealStatus;
  invoice_number: string | null;
  invoice_value: number | null;
  buyer_company_name: string | null;
  created_at: string;
}

export default function OriginatorDashboard() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [exporterCount, setExporterCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const [dealsRes, exportersRes] = await Promise.all([
      supabase.from('deals').select('id, status, invoice_number, invoice_value, buyer_company_name, created_at')
        .eq('originator_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('exporters').select('id', { count: 'exact', head: true }).eq('originator_id', user.id),
    ]);
    setDeals((dealsRes.data as DealRow[]) ?? []);
    setExporterCount(exportersRes.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();

    const channel = supabase
      .channel('originator-dashboard-deals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const activeDealCount = deals.filter((d) =>
    !['closed_repaid', 'closed_partial', 'rejected'].includes(d.status)
  ).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your deal pipeline at a glance</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/exporters/new"><Plus className="mr-2 h-4 w-4" />New Exporter</Link>
          </Button>
          <Button asChild>
            <Link to="/deals/new"><Plus className="mr-2 h-4 w-4" />New Application</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My Exporters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{exporterCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Deals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeDealCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{deals.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Applications</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/deals">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No deals yet. <Link to="/deals/new" className="text-primary underline">Create your first deal</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {deals.slice(0, 5).map((deal) => (
                <Link
                  key={deal.id}
                  to={`/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {deal.invoice_number || 'No invoice #'}
                    </p>
                    <p className="text-sm text-muted-foreground">{deal.buyer_company_name || 'No buyer'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {deal.invoice_value && (
                      <span className="text-sm font-medium text-foreground">
                        {deal.invoice_value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <DealStatusBadge status={deal.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
