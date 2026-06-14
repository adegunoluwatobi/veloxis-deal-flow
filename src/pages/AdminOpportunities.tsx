import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Search, Sparkles, AlertTriangle, CalendarClock, Layers, RefreshCw, Star, Bookmark } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
  summary: string | null;
  status: string | null;
  date_found: string | null;
  search_query: string | null;
  created_at: string;
  favorited: boolean | null;
  follow_up: boolean | null;
};

const CATEGORIES = ['Accelerator','Incubator','Grant','Seed Investment','Regulatory Programme','Competition','Fellowship','News'];
const STATUSES = ['To Review','To Apply','Applied','In Progress','Accepted','Rejected','Monitor'];
const FITS = ['HIGH','MEDIUM','LOW'];

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const days = daysUntil(deadline);
  if (days === null) return <Badge variant="outline" className="text-muted-foreground">No deadline</Badge>;
  if (days < 0) return <Badge className="bg-muted text-muted-foreground hover:bg-muted">Expired</Badge>;
  if (days <= 7) return <Badge className="bg-red-600 text-white hover:bg-red-600 animate-pulse">{days}d left</Badge>;
  if (days <= 14) return <Badge className="bg-orange-500 text-white hover:bg-orange-500">{days}d left</Badge>;
  if (days <= 30) return <Badge className="bg-amber-500 text-white hover:bg-amber-500">{days}d left</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">{days}d left</Badge>;
}

function FitBadge({ fit }: { fit: string | null }) {
  if (!fit) return null;
  const f = fit.toUpperCase();
  if (f === 'HIGH') return <Badge className="bg-[#15946F] text-white hover:bg-[#15946F]">HIGH</Badge>;
  if (f === 'MEDIUM') return <Badge className="bg-amber-500 text-white hover:bg-amber-500">MEDIUM</Badge>;
  return <Badge variant="secondary">LOW</Badge>;
}

export default function AdminOpportunities() {
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ found: number; added: number } | null>(null);
  const [search, setSearch] = useState('');
  const [fit, setFit] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [sort, setSort] = useState<'relevance' | 'deadline' | 'newest'>('relevance');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [showExpired, setShowExpired] = useState(false);

  useEffect(() => {
    (async () => {
      const [oppRes, cronRes] = await Promise.all([
        supabase.from('opportunities').select('*').limit(500),
        supabase.from('cron_log').select('run_date').order('run_date', { ascending: false }).limit(1),
      ]);
      if (oppRes.error) toast({ title: 'Failed to load', description: oppRes.error.message, variant: 'destructive' });
      else setRows((oppRes.data ?? []) as Opportunity[]);
      setLastScan(cronRes.data?.[0]?.run_date ?? null);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = rows.filter((o) => {
      if (q) {
        const hay = `${o.title ?? ''} ${o.organisation ?? ''} ${o.summary ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fit !== 'all' && (o.fit ?? '').toUpperCase() !== fit) return false;
      if (category !== 'all' && o.category !== category) return false;
      if (status !== 'all' && o.status !== status) return false;
      if (favoritesOnly && !o.favorited) return false;
      if (followUpOnly && !o.follow_up) return false;
      if (!showExpired) {
        const d = daysUntil(o.deadline);
        if (d !== null && d < 0) return false;
      }
      return true;
    });
    if (sort === 'relevance') r.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (sort === 'newest') r.sort((a, b) => (b.date_found ?? '').localeCompare(a.date_found ?? ''));
    if (sort === 'deadline') {
      r.sort((a, b) => {
        const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return ad - bd;
      });
    }
    return r;
  }, [rows, search, fit, category, status, sort, favoritesOnly, followUpOnly, showExpired]);

  const stats = useMemo(() => {
    const total = rows.length;
    const high = rows.filter((o) => (o.fit ?? '').toUpperCase() === 'HIGH').length;
    const action = rows.filter((o) => o.status === 'To Review' || o.status === 'To Apply').length;
    const soon = rows.filter((o) => {
      const d = daysUntil(o.deadline);
      return d !== null && d >= 0 && d <= 14;
    }).length;
    return { total, high, action, soon };
  }, [rows]);

  const updateStatus = async (id: string, next: string) => {
    const prev = rows;
    setRows((r) => r.map((o) => (o.id === id ? { ...o, status: next } : o)));
    const { error } = await supabase.from('opportunities').update({ status: next }).eq('id', id);
    if (error) {
      setRows(prev);
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const toggleFavorite = async (id: string, next: boolean) => {
    const prev = rows;
    setRows((r) => r.map((o) => (o.id === id ? { ...o, favorited: next } : o)));
    const { error } = await supabase.from('opportunities').update({ favorited: next }).eq('id', id);
    if (error) {
      setRows(prev);
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const runScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('opportunity-scan', { body: { batch: 1 } });
      if (error) throw error;
      setScanResult({ found: data.found ?? 0, added: data.added ?? 0 });
      toast({ title: 'Scan complete', description: `${data.found ?? 0} found · ${data.added ?? 0} added` });
      // Refresh list
      const oppRes = await supabase.from('opportunities').select('*').limit(500);
      if (!oppRes.error) setRows((oppRes.data ?? []) as Opportunity[]);
      const cronRes = await supabase.from('cron_log').select('run_date').order('run_date', { ascending: false }).limit(1);
      setLastScan(cronRes.data?.[0]?.run_date ?? null);
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Helmet><title>Opportunity Tracker · Veloxis</title></Helmet>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Opportunity Tracker</h1>
          <p className="text-sm text-muted-foreground">Accelerators, grants, seed investors, regulatory programmes & competitions.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button size="sm" onClick={runScan} disabled={scanning} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', scanning && 'animate-spin')} />
            {scanning ? 'Scanning…' : 'Run scan now'}
          </Button>
          {scanResult && (
            <span className="text-xs text-muted-foreground">
              {scanResult.found} found · {scanResult.added} added
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Last scan: <span className="font-medium text-foreground">{lastScan ? new Date(lastScan).toLocaleString() : '—'}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Layers className="h-4 w-4" />} label="Total opportunities" value={stats.total} />
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="High fit" value={stats.high} accent />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Action required" value={stats.action} />
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Deadline ≤14 days" value={stats.soon} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, organisation, summary…" className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex">
            <Select value={fit} onValueChange={setFit}>
              <SelectTrigger className="w-full lg:w-[130px]"><SelectValue placeholder="Fit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All fits</SelectItem>
                {FITS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full lg:w-[170px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full lg:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-full lg:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 lg:ml-2">
            <div className="flex items-center gap-2">
              <Switch id="fav-only" checked={favoritesOnly} onCheckedChange={setFavoritesOnly} />
              <Label htmlFor="fav-only" className="cursor-pointer text-xs whitespace-nowrap flex items-center gap-1">
                <Star className="h-3.5 w-3.5" /> Favorites only
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-expired" checked={showExpired} onCheckedChange={setShowExpired} />
              <Label htmlFor="show-expired" className="cursor-pointer text-xs whitespace-nowrap">Show expired</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading opportunities…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No opportunities match. The daily scan runs every morning at 07:00.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => <OpportunityCard key={o.id} o={o} onStatus={(s) => updateStatus(o.id, s)} onToggleFavorite={(v) => toggleFavorite(o.id, v)} />)}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <Card className={cn(accent && 'border-[#15946F]/40')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <span className={cn('text-muted-foreground', accent && 'text-[#15946F]')}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-semibold', accent && 'text-[#15946F]')}>{value}</div>
      </CardContent>
    </Card>
  );
}

function OpportunityCard({ o, onStatus, onToggleFavorite }: { o: Opportunity; onStatus: (s: string) => void; onToggleFavorite: (v: boolean) => void }) {
  const score = o.score ?? 0;
  const fav = !!o.favorited;
  return (
    <Card className={cn('transition-shadow hover:shadow-md', fav && 'border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10')}>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 flex items-start gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(!fav)}
              aria-label={fav ? 'Unfavorite' : 'Favorite'}
              className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition hover:text-amber-500"
            >
              <Star className={cn('h-4 w-4', fav && 'fill-amber-400 text-amber-500')} />
            </button>
            <div className="min-w-0 flex-1">
              <a
                href={o.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-start gap-1.5 text-base font-semibold text-foreground hover:text-[#15946F]"
              >
                <span className="break-words">{o.title}</span>
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
              </a>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {o.organisation ?? '—'}{o.category ? ` · ${o.category}` : ''}{o.amount ? ` · ${o.amount}` : ''}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FitBadge fit={o.fit} />
            <DeadlineBadge deadline={o.deadline} />
          </div>
        </div>

        {o.summary && <p className="text-sm text-muted-foreground">{o.summary}</p>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-32">
              <Progress value={score * 10} className="h-1.5" />
            </div>
            <span className="text-xs font-medium text-foreground">{score}/10</span>
            {o.date_found && (
              <span className="text-xs text-muted-foreground">Found {new Date(o.date_found).toLocaleDateString()}</span>
            )}
          </div>
          <Select value={o.status ?? 'To Review'} onValueChange={onStatus}>
            <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
