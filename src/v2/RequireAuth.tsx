import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { AppRole } from './roles';
import { isStaff } from './roles';
import { AuthLoading, AuthError } from './components/AuthStates';

export function RequireAuth({ children, allow }: { children: React.ReactNode; allow?: AppRole[] | 'staff' | 'exporter' }) {
  const { user, roles, profile, exporterOnboarding, ready, error, refresh } = useAuth();
  const loc = useLocation();

  // Single source of truth for readiness — never render role-based content before this.
  if (!ready) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (error) return <AuthError message={error} onRetry={() => { void refresh(); }} />;


  // Force first-time users (signed in via magic link) to set a password before anything else.
  if (profile && !(profile as any).password_set_at && loc.pathname !== '/set-password') {
    // Non-sensitive diagnostics: explains exactly why the gate triggered.
    console.info('[auth-gate] redirect to /set-password', {
      user_id: user.id,
      password_set_at: null,
      first_signed_in_at: (profile as any).first_signed_in_at ?? null,
      last_login: (profile as any).last_login ?? null,
      from: loc.pathname,
    });
    return <Navigate to="/set-password" replace />;
  }
  if (profile && (profile as any).password_set_at) {
    console.info('[auth-gate] password present, no redirect', {
      user_id: user.id,
      password_set_at: (profile as any).password_set_at,
    });
  }


  if (roles.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-sm text-muted-foreground">
        <div>Your account has no role assigned yet. Please contact an administrator.</div>
        <SignOutButton />
      </div>
    );
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
