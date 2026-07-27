import { Navigate } from 'react-router-dom';
import { useAuth } from '@/v2/useAuth';
import { isStaff } from '@/v2/roles';

export default function RootRedirect() {
  const { user, roles, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isStaff(roles) ? '/app' : '/portal'} replace />;
}
