import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, FileText, LogOut, Briefcase,
  Menu, X, ChevronRight, Building2, UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import veloxisLogoWhite from '@/assets/veloxis-logo-white.png';
import NotificationBell from '@/components/NotificationBell';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/greystar', icon: LayoutDashboard },
  { label: 'Exporters', href: '/greystar/exporters', icon: Users },
  { label: 'Applications', href: '/greystar/deals', icon: Briefcase },
  { label: 'Review Queue', href: '/greystar/review', icon: FileText },
];

export default function GreystarLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const navItems = [
    ...NAV_ITEMS,
    { label: 'Organisation', href: '/greystar/account/organisation', icon: Building2 },
    ...(role === 'partner_admin' ? [{ label: 'Team Members', href: '/greystar/account/team', icon: Users }] : []),
    { label: 'Account', href: '/greystar/account', icon: UserCog },
  ];
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (href: string) =>
    location.pathname === href || (href !== '/greystar' && location.pathname.startsWith(href));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Helmet><title>Partner · Veloxis</title></Helmet>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-200 lg:static lg:translate-x-0',
          'bg-sidebar text-sidebar-foreground',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Link to="/greystar" className="flex h-16 items-center border-b border-sidebar-border px-5">
          <img src={veloxisLogoWhite} alt="Veloxis" className="h-7 w-auto" />
          <button className="ml-auto lg:hidden" onClick={(e) => { e.preventDefault(); setSidebarOpen(false); }}>
            <X className="h-5 w-5" />
          </button>
        </Link>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {active && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 px-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.email}</p>
            <p className="text-xs text-sidebar-muted">{role === 'partner_admin' ? 'Partner Admin' : 'Partner Staff'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-6 lg:px-8">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
