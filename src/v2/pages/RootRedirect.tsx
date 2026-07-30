import { Navigate } from 'react-router-dom';
import { useAuth } from '@/v2/useAuth';
import { isStaff } from '@/v2/roles';
import { AuthLoading } from '../components/AuthStates';

export default function RootRedirect() {
  const { user, roles, ready } = useAuth();
  if (!ready) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isStaff(roles) ? '/app' : '/portal'} replace />;
}
