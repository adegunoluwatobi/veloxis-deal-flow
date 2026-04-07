import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import OriginatorDashboard from '@/pages/OriginatorDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  if (role === 'deal_manager') return <Navigate to="/admin" replace />;
  if (role === 'greystar_originator') return <Navigate to="/greystar" replace />;
  if (role === 'exporter') return <Navigate to="/exporter" replace />;
  return <OriginatorDashboard />;
}
