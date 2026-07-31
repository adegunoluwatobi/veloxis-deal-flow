import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

interface Delivery {
  id: string;
  template_key: string;
  channel: string;
  recipient: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  provider_response: string | null;
  attempts: number;
  next_attempt_at: string | null;
  created_at: string;
  sent_at: string | null;
}

const STATUSES = ['all', 'failed', 'suppressed', 'queued'] as const;

export default function StaffNotificationFailures() {
  const [rows, setRows] = useState<Delivery[]>([]);
  const [status, setStatus] = useState<string>('failed');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let q = supabase.from('notification_deliveries').select('*').order('created_at', { ascending: false }).limit(500);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) toast({ title: 'Could not load deliveries', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as Delivery[]);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const retryNow = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('retry_failed_notifications');
    setBusy(false);
    if (error) return toast({ title: 'Retry failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Retry run complete', description: `${data ?? 0} message(s) re queued.` });
    load();
  };

  const filtered = rows.filter((r) =>
    !search || `${r.template_key} ${r.recipient} ${r.provider_response ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <Helmet><title>Undelivered notifications · Veloxis</title></Helmet>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Undelivered notifications</h1>
          <p className="text-sm text-muted-foreground">
            Every send attempt is logged. Failed emails are retried three times with an increasing delay.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={retryNow} disabled={busy}>
          <RefreshCw className="mr-2 h-4 w-4" />Run retry now
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded border px-3 py-1 text-xs capitalize ${status === s ? 'border-accent text-accent' : 'border-border text-muted-foreground'}`}
          >
            {s}
          </button>
        ))}
        <Input className="h-8 max-w-xs" placeholder="Search recipient, template or error" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="px-4 py-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-GB')}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.template_key}</td>
                <td className="px-4 py-3">{r.channel === 'in_app' ? 'in app' : 'email'}</td>
                <td className="px-4 py-3">{r.recipient || '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={r.status === 'failed' ? 'destructive' : r.status === 'sent' ? 'default' : 'secondary'}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">{r.attempts}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.provider_response ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing to show.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
