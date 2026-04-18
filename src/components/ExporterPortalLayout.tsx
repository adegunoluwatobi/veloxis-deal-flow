import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, FileText, LogOut, Briefcase,
  Menu, X, ChevronRight, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import veloxisLogoWhite from '@/assets/veloxis-logo-white.png';

const NAV_ITEMS = [
  { label: 'My Profile', href: '/exporter', icon: LayoutDashboard },
  { label: 'Applications', href: '/exporter/deals', icon: Briefcase },
  { label: 'Documents', href: '/exporter/documents', icon: FileText },
];

export default function ExporterPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Gate: redirect unapproved exporters to onboarding
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from('exporters')
        .select('onboarding_status')
        .eq('exporter_user_id', user.id)
        .maybeSingle();

      if (!data || !['onboarding_approved'].includes(data.onboarding_status as string)) {
        const status = data?.onboarding_status;
        if (status === 'onboarding_submitted') {
          navigate('/exporter/pending', { replace: true });
        } else {
          navigate('/exporter/onboarding', { replace: true });
        }
        return;
      }
      setOnboardingChecked(true);
    };
    check();
  }, [user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (href: string) =>
    location.pathname === href || (href !== '/exporter' && location.pathname.startsWith(href));

  if (!onboardingChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Helmet><title>Exporter · Veloxis</title></Helmet>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-200 lg:static lg:translate-x-0',
          'bg-[hsl(220,25%,18%)] text-[hsl(220,20%,90%)]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Link to="/" className="flex h-16 items-center border-b border-[hsl(220,20%,25%)] px-5">
          <img src={veloxisLogoWhite} alt="Veloxis" className="h-7 w-auto" />
          <button className="ml-auto lg:hidden" onClick={(e) => { e.preventDefault(); setSidebarOpen(false); }}>
            <X className="h-5 w-5" />
          </button>
        </Link>

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
