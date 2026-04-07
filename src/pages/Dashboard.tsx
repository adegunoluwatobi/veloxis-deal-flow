import { useAuth } from '@/hooks/useAuth';
import OriginatorDashboard from '@/pages/OriginatorDashboard';
import DealManagerDashboard from '@/pages/DealManagerDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  if (role === 'deal_manager') return <DealManagerDashboard />;
  return <OriginatorDashboard />;
}
