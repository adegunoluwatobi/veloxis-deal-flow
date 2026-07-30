import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { AppRole } from './roles';
import { isStaff } from './roles';

export function RequireAuth({ children, allow }: { children: React.ReactNode; allow?: AppRole[] | 'staff' | 'exporter' }) {
  const { user, roles, profile, exporterOnboarding, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  // Force first-time users (signed in via magic link) to set a password before anything else.
  if (profile && !(profile as any).password_set_at && loc.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />;
  }

  if (roles.length === 0) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">Your account has no role assigned yet. Please contact an administrator.</div>;
  }

  // Exporter must complete KYB/KYC and be approved before entering the portal.
  // Staff roles take precedence — never trap a staff user in the exporter onboarding flow.
  const isExporter = roles.includes('exporter') && !isStaff(roles);
  const onboardingComplete = exporterOnboarding?.onboarding_status === 'active';
  if (isExporter && !onboardingComplete && loc.pathname !== '/portal/onboarding' && loc.pathname !== '/portal/account') {
    return <Navigate to="/portal/onboarding" replace />;
  }

  if (allow === 'staff') {
    if (!isStaff(roles)) return <Navigate to="/portal" replace />;
  } else if (allow === 'exporter') {
    if (!isExporter) return <Navigate to="/app" replace />;
  } else if (Array.isArray(allow)) {
    if (!roles.some((r) => allow.includes(r))) return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
