import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DealStatusBadge from '@/components/DealStatusBadge';
import { Plus, Search } from 'lucide-react';
import { DEAL_STATUS_LABELS, type DealStatus } from '@/types';

interface DealRow {
  id: string;
  status: DealStatus;
  invoice_number: string | null;
  invoice_value: number | null;
  buyer_company_name: string | null;
  commodity_type: string | null;
  created_at: string;
}

export default function DealsList() {
  const { user, role } = useAuth();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      let query = supabase.from('deals')
        .select('id, status, invoice_number, invoice_value, buyer_company_name, commodity_type, created_at')
        .order('created_at', { ascending: false });
      if (role === 'partner_staff' || role === 'partner_admin') {
        query = query.eq('originator_id', user.id);
      }
      const { data } = await query;
      setDeals((data as DealRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, [user, role]);

  const filtered = deals.filter((d) => {
    const matchSearch = !search ||
      (d.invoice_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.buyer_company_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Applications</h1>
          <p className="text-sm text-muted-foreground">{(role === 'super_admin' || role === 'deal_manager') ? 'All applications' : 'Your application pipeline'}</p>
        </div>
        {(role === 'partner_staff' || role === 'partner_admin') && (
          <Button asChild>
            <Link to="/deals/new"><Plus className="mr-2 h-4 w-4" />New Application</Link>
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoice # or buyer…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(DEAL_STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {search || statusFilter !== 'all' ? 'No deals match your filters.' : 'No deals yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((deal) => (
            <Link
              key={deal.id}
              to={`/deals/${deal.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium text-foreground">{deal.invoice_number || deal.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">{deal.buyer_company_name || 'No buyer'}</p>
              </div>
              <div className="flex items-center gap-3">
                {deal.invoice_value && (
                  <span className="text-sm font-medium text-foreground">
                    {deal.invoice_value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </span>
                )}
                <DealStatusBadge status={deal.status} portal="veloxis" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
