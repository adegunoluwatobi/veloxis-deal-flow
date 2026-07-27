import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { AppRole } from './roles';
import { isStaff } from './roles';

export function RequireAuth({ children, allow }: { children: React.ReactNode; allow?: AppRole[] | 'staff' | 'exporter' }) {
  const { user, roles, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  if (allow === 'staff') {
    if (!isStaff(roles)) return <Navigate to="/portal" replace />;
  } else if (allow === 'exporter') {
    if (!roles.includes('exporter')) return <Navigate to="/app" replace />;
  } else if (Array.isArray(allow)) {
    if (!roles.some((r) => allow.includes(r))) return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
