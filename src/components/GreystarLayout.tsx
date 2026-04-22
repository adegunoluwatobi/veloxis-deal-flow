import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, FileText, LogOut, Briefcase,
  Menu, X, Building2, UserCog, ChevronDown, Plus, GitPullRequestArrow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: { count: number; tone: 'warn' | 'danger' };
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

function buildNavGroups(role: string | null): NavGroup[] {
  const groups: NavGroup[] = [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', href: '/greystar', icon: LayoutDashboard }],
    },
    {
      section: 'Exporters',
      items: [{ label: 'Exporters', href: '/greystar/exporters', icon: Users }],
    },
    {
      section: 'Finance',
      items: [
        { label: 'Applications', href: '/greystar/deals', icon: FileText },
        { label: 'Requests', href: '/greystar/review', icon: GitPullRequestArrow },
      ],
    },
    {
      section: 'Settings',
      items: [
        { label: 'Organisation', href: '/greystar/account/organisation', icon: Building2 },
        ...(role === 'partner_admin'
          ? [{ label: 'Team Members', href: '/greystar/account/team', icon: Users }]
          : []),
        { label: 'Account', href: '/greystar/account', icon: UserCog },
      ],
    },
  ];
  return groups;
}

const PAGE_TITLES: Array<{ match: RegExp; title: string }> = [
  { match: /^\/greystar\/exporters\/new/, title: 'New Exporter' },
  { match: /^\/greystar\/exporters\/[^/]+/, title: 'Exporter Profile' },
  { match: /^\/greystar\/exporters$/, title: 'Exporters' },
  { match: /^\/greystar\/deals\/[^/]+/, title: 'Application Detail' },
  { match: /^\/greystar\/deals$/, title: 'Applications' },
  { match: /^\/greystar\/review/, title: 'Requests' },
  { match: /^\/greystar\/account\/organisation/, title: 'Organisation' },
  { match: /^\/greystar\/account\/team/, title: 'Team Members' },
  { match: /^\/greystar\/account/, title: 'Account' },
  { match: /^\/greystar$/, title: 'Dashboard' },
];

function getPageTitle(pathname: string): string {
  return PAGE_TITLES.find((p) => p.match.test(pathname))?.title ?? 'Dashboard';
}

export default function GreystarLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const navGroups = buildNavGroups(role);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (href: string) =>
    location.pathname === href || (href !== '/greystar' && location.pathname.startsWith(href));

  const userInitial = (user?.email ?? '?').charAt(0).toUpperCase();
  const roleLabel = role === 'partner_admin' ? 'Partner Admin' : 'Partner Staff';
  const pageTitle = getPageTitle(location.pathname);
  const showNewExporterCta = location.pathname.startsWith('/greystar/exporters') && !location.pathname.includes('/new');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Helmet><title>Partner · Veloxis</title></Helmet>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[228px] flex-col transition-transform duration-200 lg:static lg:translate-x-0',
          'bg-sidebar text-sidebar-foreground border-r border-sidebar-border',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <Link to="/greystar" className="flex items-center gap-2.5 border-b border-sidebar-border px-[18px] py-[14px]">
          <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
            <path d="M1 1l5 6-5 6" stroke="hsl(142 76% 64%)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 1l5 6-5 6" stroke="hsl(142 71% 45%)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[14px] font-bold tracking-[0.04em] uppercase text-sidebar-foreground">Veloxis</span>
          <button
            className="ml-auto lg:hidden"
            aria-label="Close menu"
            onClick={(e) => { e.preventDefault(); setSidebarOpen(false); }}
          >
            <X className="h-5 w-5" />
          </button>
        </Link>

        {/* Org pill */}
        <div className="mx-3 my-2.5 flex items-center gap-2.5 rounded-[10px] border border-sidebar-border bg-white/5 px-3 py-2.5">
          <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-md bg-[hsl(142_71%_45%)] text-[11px] font-bold text-white">
            {(user?.email ?? 'P').charAt(0).toUpperCase()}
          </div>
          <span className="flex-1 truncate text-[12px] font-semibold text-sidebar-foreground">
            {role === 'partner_admin' || role === 'partner_staff' ? 'Partner Workspace' : 'Workspace'}
          </span>
          <ChevronDown className="h-3 w-3 text-sidebar-foreground/30" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-1.5">
          {navGroups.map((group) => (
            <div key={group.section}>
              <div className="px-[18px] pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/25">
                {group.section}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'mx-2 my-px flex items-center gap-2.5 rounded-md px-[14px] py-[7px] text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-[hsl(142_71%_45%/0.14)] text-[hsl(142_76%_64%)]'
                        : 'text-white/55 hover:bg-white/5 hover:text-white/85'
                    )}
                  >
                    <item.icon className="h-[15px] w-[15px] flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          'min-w-[18px] rounded-full px-1.5 py-px text-center text-[10px] font-bold text-white',
                          item.badge.tone === 'danger' ? 'bg-destructive' : 'bg-warning'
                        )}
                      >
                        {item.badge.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-md p-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--veloxis-teal))] text-[11px] font-bold text-white">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white/80">{user?.email ?? 'User'}</div>
              <div className="text-[11px] text-white/55">{roleLabel}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-white/55 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-7">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            {showNewExporterCta && (
              <Button
                asChild
                size="sm"
                className="h-[34px] gap-1.5 bg-[hsl(var(--veloxis-teal))] px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[hsl(var(--veloxis-teal-dark))]"
              >
                <Link to="/greystar/exporters/new">
                  <Plus className="h-3.5 w-3.5" />
                  New Exporter
                </Link>
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
