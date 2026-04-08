import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DealStatusBadge from '@/components/DealStatusBadge';
import { cn } from '@/lib/utils';
import { computeKycStatus, groupDocumentsByExporter, type KycDocumentLike } from '@/lib/computeKycStatus';
import {
  LayoutDashboard, TrendingUp, AlertTriangle, ArrowRight, Banknote,
  Users, FileText,
} from 'lucide-react';
import { type DealStatus } from '@/types';

interface DealRow {
  id: string;
  status: DealStatus;
  invoice_number: string | null;
  invoice_value: number | null;
  invoice_currency_v2: string | null;
  gbp_equivalent: number | null;
  buyer_company_name: string | null;
  created_at: string;
}

interface ExporterRow {
  id: string;
  company_name: string;
}

interface ExporterDocRow extends KycDocumentLike {
  exporter_id: string;
  is_superseded: boolean;
}

interface SystemConfig {
  key: string;
  value: string;
}

export default function AdminDashboard() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [exportersWithKyc, setExportersWithKyc] = useState<(ExporterRow & { kyc: ReturnType<typeof computeKycStatus> })[]>([]);
  const [config, setConfig] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [dealsRes, exportersRes, configRes] = await Promise.all([
      supabase.from('deals')
        .select('id, status, invoice_number, invoice_value, invoice_currency_v2, gbp_equivalent, buyer_company_name, created_at')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('exporters')
        .select('id, company_name')
        .order('created_at', { ascending: false }),
      supabase.from('system_config').select('key, value'),
    ]);

    const exporters = (exportersRes.data as ExporterRow[]) ?? [];
    const exporterIds = exporters.map(e => e.id);

    let docs: ExporterDocRow[] = [];
    if (exporterIds.length > 0) {
      const { data: docData } = await supabase
        .from('exporter_documents')
        .select('exporter_id, document_type, document_status, expiry_status, is_superseded')
        .in('exporter_id', exporterIds)
        .eq('is_superseded', false);
      docs = (docData as ExporterDocRow[]) ?? [];
    }

    const docsByExporter = groupDocumentsByExporter(docs);
    const withKyc = exporters.map(exp => ({
      ...exp,
      kyc: computeKycStatus(docsByExporter.get(exp.id) ?? []),
    }));

    setDeals((dealsRes.data as DealRow[]) ?? []);
    setExportersWithKyc(withKyc);
    setConfig((configRes.data as SystemConfig[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('admin-dashboard-deals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const poolGbp = Number(config.find(c => c.key === 'pilot_pool_gbp')?.value ?? 150000);
  const activeStatuses: DealStatus[] = ['funded_active', 'repayment_due', 'overdue'];
  const activeDeals = deals.filter(d => activeStatuses.includes(d.status));
  const deployed = activeDeals.reduce((sum, d) => sum + (d.gbp_equivalent ?? 0), 0);
  const available = poolGbp - deployed;
  const utilization = poolGbp > 0 ? (deployed / poolGbp) * 100 : 0;

  // Group deployed by currency
  const deployedByCurrency: Record<string, number> = {};
  activeDeals.forEach(d => {
    const cur = d.invoice_currency_v2 || 'GBP';
    deployedByCurrency[cur] = (deployedByCurrency[cur] || 0) + (d.invoice_value ?? d.gbp_equivalent ?? 0);
  });
  const CURRENCY_SYMBOLS_MAP: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };

  // Total repaid
  const closedStatuses: DealStatus[] = ['closed_repaid', 'closed_partial'];
  const closedDeals = deals.filter(d => closedStatuses.includes(d.status));
  const totalRepaid = closedDeals.reduce((sum, d) => sum + (d.invoice_value ?? 0), 0);
  const repaidByCurrency: Record<string, { amount: number; count: number }> = {};
  closedDeals.forEach(d => {
    const cur = d.invoice_currency_v2 || 'GBP';
    if (!repaidByCurrency[cur]) repaidByCurrency[cur] = { amount: 0, count: 0 };
    repaidByCurrency[cur].amount += d.invoice_value ?? 0;
    repaidByCurrency[cur].count += 1;
  });

  const pendingReview = deals.filter(d => d.status === 'submitted').length;
  const underReview = deals.filter(d => d.status === 'under_review').length;
  const overdueCount = deals.filter(d => d.status === 'overdue').length;
  const docsRequested = deals.filter(d => d.status === 'docs_requested').length;
  const verifiedExporters = exportersWithKyc.filter(e => e.kyc.status === 'verified').length;
  const pendingKyc = exportersWithKyc.filter(e => e.kyc.status !== 'verified').length;

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Capital pool & pipeline overview</p>
      </div>

      {/* Pool Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pool Size (GBP)</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">£{poolGbp.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Deployed (GBP equiv.)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">£{deployed.toLocaleString()}</div>
            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', utilization > 90 ? 'bg-destructive' : utilization > 75 ? 'bg-warning' : 'bg-success')}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{utilization.toFixed(1)}% utilization</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available</CardTitle>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', available > 0 ? 'text-success' : 'text-destructive')}>
              £{available.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attention</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {pendingReview > 0 && <p className="text-foreground"><span className="font-bold">{pendingReview}</span> pending review</p>}
              {underReview > 0 && <p className="text-foreground"><span className="font-bold">{underReview}</span> under review</p>}
              {docsRequested > 0 && <p className="text-warning"><span className="font-bold">{docsRequested}</span> docs requested</p>}
              {overdueCount > 0 && <p className="text-destructive"><span className="font-bold">{overdueCount}</span> overdue</p>}
              {pendingReview === 0 && underReview === 0 && docsRequested === 0 && overdueCount === 0 && (
                <p className="text-muted-foreground">No items need attention</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployed by Currency */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(['GBP', 'USD', 'EUR'] as const).map(cur => {
          const amt = deployedByCurrency[cur] || 0;
          const dealCount = activeDeals.filter(d => (d.invoice_currency_v2 || 'GBP') === cur).length;
          return (
            <Card key={cur}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deployed in {cur}</CardTitle>
                <Badge variant="secondary" className="text-xs">{dealCount} deal{dealCount !== 1 ? 's' : ''}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">
                  {CURRENCY_SYMBOLS_MAP[cur]}{Number(amt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {utilization > 90 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Pool utilization is above 90%. New application approvals may be blocked.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Recent Deals</CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/deals">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No deals in the system.</p>
            ) : (
              <div className="space-y-1.5">
                {deals.slice(0, 8).map(deal => (
                  <Link
                    key={deal.id}
                    to={`/admin/deals/${deal.id}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{deal.invoice_number || deal.id.slice(0, 8)}</span>
                      <span className="ml-2 text-muted-foreground">{deal.buyer_company_name || ''}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {deal.invoice_value != null && (
                        <span className="text-xs font-medium text-muted-foreground">
                          {deal.invoice_value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
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

        {/* Exporters Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Exporters</CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/exporters">Manage <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-border p-2">
                <p className="text-lg font-bold text-foreground">{exportersWithKyc.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-2">
                <p className="text-lg font-bold text-success">{verifiedExporters}</p>
                <p className="text-xs text-muted-foreground">Verified</p>
              </div>
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-2">
                <p className="text-lg font-bold text-warning">{pendingKyc}</p>
                <p className="text-xs text-muted-foreground">Pending KYC</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {exportersWithKyc.slice(0, 6).map(exp => (
                <Link
                  key={exp.id}
                  to={`/exporters/${exp.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium text-foreground">{exp.company_name}</span>
                  <Badge variant="secondary" className={cn('text-xs', exp.kyc.color)}>
                    {exp.kyc.badgeLabel}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
