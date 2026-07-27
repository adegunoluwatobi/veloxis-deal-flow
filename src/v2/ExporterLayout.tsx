import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Building2, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/portal', label: 'My Dashboard', icon: LayoutDashboard, end: true },
  { to: '/portal/invoices', label: 'My Invoices', icon: FileText },
  { to: '/portal/profile', label: 'My Company', icon: Building2 },
];

export default function ExporterLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card">
        <div className="max-w-6xl mx-auto h-full flex items-center px-6 gap-8">
          <span className="wordmark text-accent">VELOXIS</span>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cn('px-3 py-2 rounded-md text-sm inline-flex items-center gap-2',
                  isActive ? 'bg-primary/15 text-accent' : 'text-muted-foreground hover:text-foreground')}>
                <n.icon className="h-4 w-4" />{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-muted-foreground truncate max-w-[200px]">{profile?.email}</span>
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); nav('/login'); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">{children}</main>
    </div>
  );
}
