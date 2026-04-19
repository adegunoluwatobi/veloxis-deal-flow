import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useNotifications';

const typeColor: Record<Notification['type'], string> = {
  info: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  action_required: 'bg-destructive',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data as Notification[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    load();
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Helmet><title>Notifications · Veloxis</title></Helmet>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <Button variant="outline" size="sm" onClick={markAllRead}>Mark all as read</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No notifications yet</Card>
      ) : (
        <Card className="divide-y">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent',
                !n.read && 'bg-accent/30'
              )}
            >
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', typeColor[n.type], n.read && 'opacity-30')} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
