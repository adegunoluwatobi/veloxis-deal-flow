import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, FileText, LogOut,
  Menu, X, ChevronRight, UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'My Profile', href: '/exporter', icon: LayoutDashboard },
  { label: 'Documents', href: '/exporter/documents', icon: FileText },
];

export default function ExporterPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (href: string) =>
    location.pathname === href || (href !== '/exporter' && location.pathname.startsWith(href));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-200 lg:static lg:translate-x-0',
          'bg-[hsl(220,25%,18%)] text-[hsl(220,20%,90%)]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-[hsl(220,20%,25%)] px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <UserCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-sm font-semibold">Exporter</span>
            <span className="ml-1 text-xs text-[hsl(220,15%,55%)]">Portal</span>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[hsl(220,20%,25%)] text-[hsl(220,20%,95%)]'
                    : 'text-[hsl(220,15%,65%)] hover:bg-[hsl(220,20%,22%)] hover:text-[hsl(220,20%,90%)]'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {active && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[hsl(220,20%,25%)] p-4">
          <div className="mb-3 px-1">
            <p className="truncate text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-[hsl(220,15%,55%)]">Exporter</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-[hsl(220,15%,65%)] hover:text-[hsl(220,20%,90%)] hover:bg-[hsl(220,20%,22%)]"
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
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
