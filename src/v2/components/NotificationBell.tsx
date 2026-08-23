import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../useAuth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCheck } from 'lucide-react';
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

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const dotClass = (type: string | null) =>
  type === 'error' || type === 'rejected' ? 'bg-destructive'
    : type === 'warning' ? 'bg-amber-400'
    : type === 'success' || type === 'approved' ? 'bg-accent'
    : 'bg-primary';

export default function NotificationBell({ variant = 'light' }: { variant?: 'light' | 'sidebar' }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, link, read, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data as Notification[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();
    const poll = window.setInterval(load, 60_000);
    return () => { supabase.removeChannel(channel); window.clearInterval(poll); };
  }, [user, load]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    setItems((xs) => xs.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  };

  const openItem = async (n: Notification) => {
    if (!n.read) await markRead([n.id]);
    setOpen(false);
    if (n.link) nav(n.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          className={cn('relative', variant === 'sidebar' && 'text-sidebar-foreground/70 hover:text-sidebar-foreground')}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-[1.05rem] text-center font-medium">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              onClick={() => markRead(items.filter((n) => !n.read).map((n) => n.id))}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You have no notifications yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn('w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors', !n.read && 'bg-primary/5')}
                  >
                    <div className="flex items-start gap-2">
                      <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', n.read ? 'bg-transparent' : dotClass(n.type))} />
                      <div className="min-w-0">
                        <div className={cn('text-sm truncate', !n.read && 'font-medium')}>{n.title || 'Update'}</div>
                        {n.message && <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>}
                        <div className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
