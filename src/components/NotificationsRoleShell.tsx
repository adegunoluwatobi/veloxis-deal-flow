import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import GreystarLayout from '@/components/GreystarLayout';
import ExporterPortalLayout from '@/components/ExporterPortalLayout';

export default function NotificationsRoleShell({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role === 'exporter') return <ExporterPortalLayout>{children}</ExporterPortalLayout>;
  if (role === 'partner_admin' || role === 'partner_staff') return <GreystarLayout>{children}</GreystarLayout>;
  return <DashboardLayout>{children}</DashboardLayout>;
}
