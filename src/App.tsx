import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/v2/useAuth';
import { RequireAuth } from '@/v2/RequireAuth';
import StaffLayout from '@/v2/StaffLayout';
import ExporterLayout from '@/v2/ExporterLayout';
import RootRedirect from '@/v2/pages/RootRedirect';
import Login from '@/v2/pages/Login';
import StaffDashboard from '@/v2/pages/staff/Dashboard';
import StaffInvoices from '@/v2/pages/staff/Invoices';
import StaffInvoiceNew from '@/v2/pages/staff/InvoiceNew';
import StaffInvoiceDetail from '@/v2/pages/staff/InvoiceDetail';
import StaffExporters from '@/v2/pages/staff/Exporters';
import StaffExporterDetail from '@/v2/pages/staff/ExporterDetail';
import StaffBuyers from '@/v2/pages/staff/Buyers';
import StaffBuyerDetail from '@/v2/pages/staff/BuyerDetail';
import StaffUsers from '@/v2/pages/staff/Users';
import StaffAudit from '@/v2/pages/staff/Audit';
import StaffSettings from '@/v2/pages/staff/Settings';
import ExporterDashboard from '@/v2/pages/exporter/Dashboard';
import ExporterInvoices from '@/v2/pages/exporter/Invoices';
import ExporterInvoiceNew from '@/v2/pages/exporter/InvoiceNew';
import ExporterInvoiceDetail from '@/v2/pages/exporter/InvoiceDetail';
import ExporterProfile from '@/v2/pages/exporter/Profile';
import ExporterOnboarding from '@/v2/pages/exporter/Onboarding';
import VeloxisHome from '@/pages/website/VeloxisHome';
import StaffCapitalPool from '@/v2/pages/staff/CapitalPool';
import StaffVerifications from '@/v2/pages/staff/Verifications';
import StaffSettlements from '@/v2/pages/staff/Settlements';
import Account from '@/v2/pages/Account';
import SetPasswordFirst from '@/v2/pages/SetPasswordFirst';
import ResetPassword from '@/v2/pages/ResetPassword';
import StaffReferenceData from '@/v2/pages/staff/ReferenceData';
import StaffNotifications from '@/v2/pages/staff/Notifications';
import StaffAccessLog from '@/v2/pages/staff/AccessLog';
import StaffNotificationFailures from '@/v2/pages/staff/NotificationFailures';

import StaffRetention from '@/v2/pages/staff/Retention';
import StaffTemplates from '@/v2/pages/staff/Templates';
import SingleReviewerReport from '@/v2/pages/staff/SingleReviewerReport';
import KnowledgeBase from '@/v2/pages/KnowledgeBase';
import MyNotifications from '@/v2/pages/MyNotifications';


// Don't refetch every query when the user comes back to the tab — it makes the
// whole app look like it reloaded. Data still refreshes on mount and on demand.
const qc = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 30_000 },
  },
});


const Staff = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth allow="staff"><StaffLayout>{children}</StaffLayout></RequireAuth>
);
const Portal = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth allow="exporter"><ExporterLayout>{children}</ExporterLayout></RequireAuth>
);

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Toaster /><Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<VeloxisHome />} />
              <Route path="/set-password" element={<RequireAuth><SetPasswordFirst /></RequireAuth>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/home" element={<RootRedirect />} />

              <Route path="/app" element={<Staff><StaffDashboard /></Staff>} />
              <Route path="/app/invoices" element={<Staff><StaffInvoices /></Staff>} />
              <Route path="/app/invoices/new" element={<Staff><StaffInvoiceNew /></Staff>} />
              <Route path="/app/invoices/:id" element={<Staff><StaffInvoiceDetail /></Staff>} />
              <Route path="/app/exporters" element={<Staff><StaffExporters /></Staff>} />
              <Route path="/app/exporters/:id" element={<Staff><StaffExporterDetail /></Staff>} />
              <Route path="/app/buyers" element={<Staff><StaffBuyers /></Staff>} />
              <Route path="/app/buyers/:id" element={<Staff><StaffBuyerDetail /></Staff>} />
              <Route path="/app/capital-pool" element={<Staff><StaffCapitalPool /></Staff>} />
              <Route path="/app/verifications" element={<Staff><StaffVerifications /></Staff>} />
              <Route path="/app/settlements" element={<Staff><StaffSettlements /></Staff>} />
              <Route path="/app/users" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffUsers /></StaffLayout></RequireAuth>} />
              <Route path="/app/audit" element={<Staff><StaffAudit /></Staff>} />
              <Route path="/app/settings" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffSettings /></StaffLayout></RequireAuth>} />
              <Route path="/admin/reference-data" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffReferenceData /></StaffLayout></RequireAuth>} />
              <Route path="/app/reference-data" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffReferenceData /></StaffLayout></RequireAuth>} />
              <Route path="/admin/notifications" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffNotifications /></StaffLayout></RequireAuth>} />
              <Route path="/admin/notifications/failures" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffNotificationFailures /></StaffLayout></RequireAuth>} />

              <Route path="/admin/access-log" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffAccessLog /></StaffLayout></RequireAuth>} />
              <Route path="/admin/templates" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffTemplates /></StaffLayout></RequireAuth>} />
              <Route path="/admin/retention" element={<RequireAuth allow={['super_admin']}><StaffLayout><StaffRetention /></StaffLayout></RequireAuth>} />
              <Route path="/admin/single-reviewer" element={<RequireAuth allow={['super_admin']}><StaffLayout><SingleReviewerReport /></StaffLayout></RequireAuth>} />

              <Route path="/app/notifications" element={<Staff><MyNotifications /></Staff>} />
              <Route path="/app/help" element={<Staff><KnowledgeBase audience="staff" /></Staff>} />
              <Route path="/app/account" element={<Staff><Account /></Staff>} />

              <Route path="/portal/onboarding" element={<RequireAuth allow="exporter"><ExporterOnboarding /></RequireAuth>} />
              <Route path="/portal" element={<Portal><ExporterDashboard /></Portal>} />
              <Route path="/portal/invoices" element={<Portal><ExporterInvoices /></Portal>} />
              <Route path="/portal/invoices/new" element={<Portal><ExporterInvoiceNew /></Portal>} />
              <Route path="/portal/invoices/:id" element={<Portal><ExporterInvoiceDetail /></Portal>} />
              <Route path="/portal/profile" element={<Portal><ExporterProfile /></Portal>} />
              <Route path="/portal/notifications" element={<Portal><MyNotifications /></Portal>} />
              <Route path="/portal/help" element={<Portal><KnowledgeBase audience="exporter" /></Portal>} />
              <Route path="/portal/account" element={<Portal><Account /></Portal>} />

              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
