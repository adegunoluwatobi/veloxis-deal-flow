import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { ROLE_LABEL } from './roles';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, FileText, Building2, ShieldCheck,
  Landmark, ScrollText, UserCog, Settings, LogOut, UserCircle, Database,
  Bell, Eye, Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/exporters', label: 'Exporters', icon: Users },
  { to: '/app/invoices', label: 'Applications', icon: FileText },
  { to: '/app/buyers', label: 'Buyers', icon: Building2 },
  { to: '/app/verifications', label: 'Verifications', icon: ShieldCheck },
  { to: '/app/settlements', label: 'Settlements', icon: Landmark },
  { to: '/app/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/admin/access-log', label: 'Access Log', icon: Eye, superOnly: true },
  { to: '/admin/retention', label: 'Retention', icon: Archive, superOnly: true },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell, superOnly: true },
  { to: '/admin/notifications/failures', label: 'Undelivered', icon: BellOff, superOnly: true },

  { to: '/app/users', label: 'User Management', icon: UserCog, superOnly: true },
  { to: '/admin/reference-data', label: 'Reference Data', icon: Database, superOnly: true },
  { to: '/app/account', label: 'My Account', icon: UserCircle },
  { to: '/app/settings', label: 'Settings', icon: Settings, superOnly: true },
];


export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const nav = useNavigate();
  const isSuper = roles.includes('super_admin');
  const items = NAV.filter((n) => !n.superOnly || isSuper);
  const primary = roles.find((r) => r !== 'exporter') ?? 'super_admin';

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
          <span className="wordmark text-accent">VELOXIS</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground')
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 space-y-2">
          <div className="text-xs">
            <div className="font-medium truncate">{profile?.name || profile?.email}</div>
            <div className="text-sidebar-muted">{ROLE_LABEL[primary as keyof typeof ROLE_LABEL]}</div>
          </div>
          <Button size="sm" variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={async () => { await signOut(); nav('/login'); }}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
