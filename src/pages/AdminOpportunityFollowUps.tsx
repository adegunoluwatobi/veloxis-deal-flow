import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowUpDown, Bookmark, ExternalLink, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Opportunity = {
  id: string;
  title: string;
  category: string | null;
  organisation: string | null;
  deadline: string | null;
  amount: string | null;
  fit: string | null;
  score: number | null;
  url: string | null;
  status: string | null;
  date_found: string | null;
  follow_up: boolean | null;
};

const STATUSES = ['To Review','To Apply','Applied','In Progress','Accepted','Rejected','Monitor'];

type SortKey = 'title' | 'organisation' | 'category' | 'fit' | 'score' | 'deadline' | 'status' | 'date_found';
type SortDir = 'asc' | 'desc';

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function DeadlineCell({ deadline }: { deadline: string | null }) {
  const days = daysUntil(deadline);
  if (!deadline) return <span className="text-muted-foreground">—</span>;
  const date = new Date(deadline).toLocaleDateString();
  if (days === null) return <span>{date}</span>;
  if (days < 0) return <span className="text-muted-foreground">{date} <Badge className="ml-1 bg-muted text-muted-foreground hover:bg-muted">Expired</Badge></span>;
  let cls = 'bg-muted text-muted-foreground hover:bg-muted';
  if (days <= 7) cls = 'bg-red-600 text-white hover:bg-red-600';
  else if (days <= 14) cls = 'bg-orange-500 text-white hover:bg-orange-500';
  else if (days <= 30) cls = 'bg-amber-500 text-white hover:bg-amber-500';
  return <span>{date} <Badge className={cn('ml-1', cls)}>{days}d</Badge></span>;
}

function FitCell({ fit }: { fit: string | null }) {
  if (!fit) return <span className="text-muted-foreground">—</span>;
  const f = fit.toUpperCase();
  if (f === 'HIGH') return <Badge className="bg-[#15946F] text-white hover:bg-[#15946F]">HIGH</Badge>;
  if (f === 'MEDIUM') return <Badge className="bg-amber-500 text-white hover:bg-amber-500">MEDIUM</Badge>;
  return <Badge variant="secondary">LOW</Badge>;
}

export default function AdminOpportunityFollowUps() {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('deadline');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showExpired, setShowExpired] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('follow_up', true)
      .limit(500);
    if (error) toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
    else setRows((data ?? []) as Opportunity[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = rows.filter((o) => {
      if (q) {
        const hay = `${o.title ?? ''} ${o.organisation ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (!showExpired) {
        const d = daysUntil(o.deadline);
        if (d !== null && d < 0) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const fitRank = (f: string | null) => f === 'HIGH' ? 3 : f === 'MEDIUM' ? 2 : f === 'LOW' ? 1 : 0;
    r.sort((a, b) => {
      let av: any; let bv: any;
      if (sortKey === 'deadline') {
        av = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        bv = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      } else if (sortKey === 'date_found') {
        av = a.date_found ? new Date(a.date_found).getTime() : 0;
        bv = b.date_found ? new Date(b.date_found).getTime() : 0;
      } else if (sortKey === 'score') {
        av = a.score ?? 0; bv = b.score ?? 0;
      } else if (sortKey === 'fit') {
        av = fitRank((a.fit ?? '').toUpperCase()); bv = fitRank((b.fit ?? '').toUpperCase());
      } else {
        av = (a[sortKey] ?? '').toString().toLowerCase();
        bv = (b[sortKey] ?? '').toString().toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return r;
  }, [rows, search, sortKey, sortDir, showExpired]);

  const updateStatus = async (id: string, next: string) => {
    const prev = rows;
    setRows((r) => r.map((o) => (o.id === id ? { ...o, status: next } : o)));
    const { error } = await supabase.from('opportunities').update({ status: next }).eq('id', id);
    if (error) { setRows(prev); toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); }
  };

  const removeFollowUp = async (id: string) => {
    const prev = rows;
    setRows((r) => r.filter((o) => o.id !== id));
    const { error } = await supabase.from('opportunities').update({ follow_up: false }).eq('id', id);
    if (error) { setRows(prev); toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); }
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
    >
      {label}
      <ArrowUpDown className={cn('h-3 w-3', sortKey === k ? 'text-foreground' : 'text-muted-foreground/50')} />
    </button>
  );

  return (
    <div className="space-y-6">
      <Helmet><title>Follow-ups · Opportunity Tracker · Veloxis</title></Helmet>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/admin/opportunities" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Opportunity Tracker
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-blue-500" /> Follow-ups
          </h1>
          <p className="text-sm text-muted-foreground">Opportunities you've bookmarked to review later.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowExpired((v) => !v)}>
          {showExpired ? 'Hide expired' : 'Show expired'}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or organisation…" className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading follow-ups…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No follow-ups yet. Bookmark opportunities from the tracker to see them here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortHeader k="title" label="Title" /></TableHead>
                    <TableHead><SortHeader k="organisation" label="Organisation" /></TableHead>
                    <TableHead><SortHeader k="category" label="Category" /></TableHead>
                    <TableHead><SortHeader k="fit" label="Fit" /></TableHead>
                    <TableHead className="text-right"><SortHeader k="score" label="Score" /></TableHead>
                    <TableHead><SortHeader k="deadline" label="Deadline" /></TableHead>
                    <TableHead><SortHeader k="status" label="Status" /></TableHead>
                    <TableHead><SortHeader k="date_found" label="Found" /></TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="max-w-xs">
                        <a
                          href={o.url ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-start gap-1 font-medium text-foreground hover:text-[#15946F]"
                        >
                          <span className="break-words">{o.title}</span>
                          <ExternalLink className="mt-1 h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.organisation ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.category ?? '—'}</TableCell>
                      <TableCell><FitCell fit={o.fit} /></TableCell>
                      <TableCell className="text-right text-sm font-medium">{o.score ?? 0}/10</TableCell>
                      <TableCell className="text-sm"><DeadlineCell deadline={o.deadline} /></TableCell>
                      <TableCell>
                        <Select value={o.status ?? 'To Review'} onValueChange={(v) => updateStatus(o.id, v)}>
                          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.date_found ? new Date(o.date_found).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => removeFollowUp(o.id)}
                          aria-label="Remove follow-up"
                          className="rounded p-1 text-blue-500 transition hover:text-muted-foreground"
                          title="Remove follow-up"
                        >
                          <Bookmark className="h-4 w-4 fill-blue-400" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} follow-up{rows.length === 1 ? '' : 's'}.
      </div>
    </div>
  );
}
