import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import OriginatorDashboard from '@/pages/OriginatorDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  if (role === 'deal_manager') return <Navigate to="/admin" replace />;
  return <OriginatorDashboard />;
}
