import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, FileText, Settings, LogOut,
  Menu, X, ChevronRight, ShieldCheck, Banknote, Building2, Inbox, Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import veloxisLogoWhite from '@/assets/veloxis-logo-white.png';
import NotificationBell from '@/components/NotificationBell';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

// Top cluster only shown for non-admin internal roles (none today, kept for future)
const NAV_ITEMS: NavItem[] = [];

const ADMIN_NAV: NavItem[] = [
  { label: 'Overview', href: '/admin', icon: ShieldCheck, roles: ['super_admin', 'deal_manager'] },
  { label: 'Exporters', href: '/exporters', icon: Users, roles: ['super_admin', 'deal_manager'] },
  { label: 'Applications', href: '/admin/deals', icon: FileText, roles: ['super_admin', 'deal_manager'] },
  { label: 'Registration Pipeline', href: '/admin/registration-pipeline', icon: Inbox, roles: ['super_admin', 'deal_manager'] },
  { label: 'Capital Pool', href: '/admin/capital', icon: Banknote, roles: ['super_admin', 'deal_manager'] },
  { label: 'Partners', href: '/admin/partners', icon: Building2, roles: ['super_admin'] },
  { label: 'Pricing', href: '/admin/pricing', icon: Banknote, roles: ['super_admin'] },
  { label: 'Marketing', href: '/admin/marketing', icon: Megaphone, roles: ['super_admin', 'deal_manager'] },
  { label: 'User Management', href: '/admin/users', icon: Users, roles: ['super_admin'] },
  { label: 'Account', href: '/admin/account', icon: Settings, roles: ['super_admin', 'deal_manager'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = NAV_ITEMS.filter((item) => role && item.roles.includes(role as string));
  const filteredAdmin = ADMIN_NAV.filter((item) => role && item.roles.includes(role as string));

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const roleLabel = role === 'super_admin' ? 'Super Admin' : role === 'deal_manager' ? 'Deal Manager' : 'Staff';

  const isActive = (href: string) =>
    location.pathname === href || (href !== '/' && href !== '/admin' && location.pathname.startsWith(href));

  const renderNavLink = (item: NavItem) => {
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
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
        {active && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Helmet><title>Admin · Veloxis</title></Helmet>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Link to="/admin" className="flex h-16 items-center border-b border-sidebar-border px-5">
          <img src={veloxisLogoWhite} alt="Veloxis" className="h-7 w-auto" />
          <button className="ml-auto lg:hidden" onClick={(e) => { e.preventDefault(); setSidebarOpen(false); }}>
            <X className="h-5 w-5" />
          </button>
        </Link>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {filteredNav.map(renderNavLink)}

          {filteredAdmin.length > 0 && filteredAdmin.map(renderNavLink)}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 px-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.email}</p>
            <p className="text-xs text-sidebar-muted">{roleLabel}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
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
