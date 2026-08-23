import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCheck, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  title: string | null;
  message: string | null;
  type: string | null;
  link: string | null;
  read: boolean | null;
  created_at: string;
};

const dotClass = (type: string | null) =>
  type === 'error' || type === 'rejected' ? 'bg-destructive'
    : type === 'warning' ? 'bg-amber-400'
    : type === 'success' || type === 'approved' ? 'bg-accent'
    : 'bg-primary';

type Filter = 'all' | 'unread';

export default function MyNotifications() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, link, read, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setItems((data as Notification[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const unread = items.filter((n) => !n.read);
  const visible = filter === 'unread' ? unread : items;

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    setItems((xs) => xs.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  };

  const openItem = async (n: Notification) => {
    if (!n.read) await markRead([n.id]);
    if (n.link) nav(n.link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread.length ? `${unread.length} unread` : 'You are all caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(['all', 'unread'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1 text-xs rounded-[4px] capitalize transition-colors',
                  filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!unread.length}
            onClick={() => markRead(unread.map((n) => n.id))}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" /> Mark all read
          </Button>
        </div>
      </div>

      <Card className="divide-y divide-border">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="px-4 py-14 text-center text-muted-foreground">
            <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{filter === 'unread' ? 'No unread notifications.' : 'You have no notifications yet.'}</p>
          </div>
        ) : (
          visible.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openItem(n)}
              className={cn(
                'w-full text-left px-4 py-4 hover:bg-muted/30 transition-colors',
                !n.read && 'bg-primary/5',
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', n.read ? 'bg-transparent' : dotClass(n.type))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn('text-sm', !n.read && 'font-medium')}>{n.title || 'Update'}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  {n.message && <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>}
                </div>
              </div>
            </button>
          ))
        )}
      </Card>

      {pathname.startsWith('/portal') && (
        <p className="text-xs text-muted-foreground">Showing the most recent 200 notifications.</p>
      )}
    </div>
  );
}
