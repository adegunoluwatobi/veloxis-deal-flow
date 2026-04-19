import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const typeColor: Record<Notification['type'], string> = {
  info: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  action_required: 'bg-destructive',
};

export default function NotificationBell({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(10);

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  const iconColor = tone === 'dark' ? 'text-sidebar-foreground' : 'text-foreground';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
        >
          <Bell className={cn('h-5 w-5', iconColor)} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={markAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
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
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t px-4 py-2 text-center">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => navigate('/notifications')}
          >
            View all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
