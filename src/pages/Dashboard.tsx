import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import OriginatorDashboard from '@/pages/OriginatorDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  if (role === 'super_admin' || role === 'deal_manager') return <Navigate to="/admin" replace />;
  if (role === 'originator_admin' || role === 'originator_staff') return <Navigate to="/greystar" replace />;
  if (role === 'exporter') return <Navigate to="/exporter" replace />;
  return <OriginatorDashboard />;
}
