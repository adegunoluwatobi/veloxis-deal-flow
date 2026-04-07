import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DealStatusBadge from '@/components/DealStatusBadge';
import { cn } from '@/lib/utils';
import { Search, ArrowUpDown } from 'lucide-react';
import {
  DEAL_STATUS_LABELS, COMMODITY_TYPE_LABELS,
  type DealStatus, type CommodityType,
} from '@/types';

interface DealRow {
  id: string;
  status: DealStatus;
  invoice_number: string | null;
  invoice_value: number | null;
  invoice_currency_v2: string | null;
  buyer_company_name: string | null;
  buyer_country: string | null;
  commodity_type: CommodityType | null;
  payment_terms_days: number | null;
  advance_percentage: number;
  created_at: string;
  updated_at: string;
  exporter_id: string;
}

interface ExporterMap {
  [id: string]: string;
}

type SortField = 'created_at' | 'invoice_value' | 'status';

export default function AdminDeals() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [exporterNames, setExporterNames] = useState<ExporterMap>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [dealsRes, exportersRes] = await Promise.all([
        supabase.from('deals')
          .select('id, status, invoice_number, invoice_value, invoice_currency_v2, buyer_company_name, buyer_country, commodity_type, payment_terms_days, advance_percentage, created_at, updated_at, exporter_id')
          .order('created_at', { ascending: false }),
        supabase.from('exporters').select('id, company_name'),
      ]);
      setDeals((dealsRes.data as DealRow[]) ?? []);
      const map: ExporterMap = {};
      (exportersRes.data ?? []).forEach((e: { id: string; company_name: string }) => { map[e.id] = e.company_name; });
      setExporterNames(map);
      setLoading(false);
    };
    load();
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filtered = deals
    .filter(d => {
      const matchSearch = !search ||
        (d.invoice_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (d.buyer_company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (exporterNames[d.exporter_id] ?? '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === 'invoice_value') cmp = (a.invoice_value ?? 0) - (b.invoice_value ?? 0);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      return sortAsc ? cmp : -cmp;
    });

  // Status counts for quick filters
  const statusCounts: Partial<Record<DealStatus | 'all', number>> = { all: deals.length };
  deals.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1; });

  const QUICK_STATUSES: (DealStatus | 'all')[] = ['all', 'submitted', 'under_review', 'docs_requested', 'approved', 'funded_active', 'overdue'];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Deals</h1>
        <p className="text-sm text-muted-foreground">{deals.length} deals in the system</p>
      </div>

      {/* Quick status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_STATUSES.map(s => {
          const count = statusCounts[s] ?? 0;
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
              )}
            >
              {s === 'all' ? 'All' : DEAL_STATUS_LABELS[s]}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', isActive ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {count}
              </span>
            </button>
          );
        })}
        {/* Dropdown for remaining */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue placeholder="More…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(DEAL_STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label} ({statusCounts[val as DealStatus] ?? 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search invoice, buyer, exporter…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-9 text-sm" />
      </div>

      {/* Table */}
      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No deals match your filters.</CardContent></Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px]">Invoice #</TableHead>
                <TableHead>Exporter</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort('invoice_value')}>
                    Value <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>Commodity</TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort('status')}>
                    Status <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1" onClick={() => toggleSort('created_at')}>
                    Created <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(deal => (
                <TableRow key={deal.id} className="cursor-pointer" onClick={() => window.location.href = `/admin/deals/${deal.id}`}>
                  <TableCell className="font-medium text-foreground text-sm">
                    <Link to={`/admin/deals/${deal.id}`} className="hover:underline">
                      {deal.invoice_number || deal.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                    {exporterNames[deal.exporter_id] || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                    {deal.buyer_company_name || '—'}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground tabular-nums">
                    {deal.invoice_value != null
                      ? `${deal.invoice_value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{deal.payment_terms_days ?? '—'}d</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {deal.commodity_type ? COMMODITY_TYPE_LABELS[deal.commodity_type] : '—'}
                  </TableCell>
                  <TableCell><DealStatusBadge status={deal.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(deal.created_at).toLocaleDateString('en-GB')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
