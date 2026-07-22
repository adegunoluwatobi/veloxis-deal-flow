import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ExporterPortalLayout from "@/components/ExporterPortalLayout";
import Login from "@/pages/Login";
import SetPassword from "@/pages/SetPassword";
import Dashboard from "@/pages/Dashboard";
import ExportersList from "@/pages/ExportersList";
import ExporterNew from "@/pages/ExporterNew";
import ExporterDetail from "@/pages/ExporterDetail";
import DealsList from "@/pages/DealsList";
import DealNew from "@/pages/DealNew";
import DealDetail from "@/pages/DealDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminDeals from "@/pages/AdminDeals";
import SMEUpload from "@/pages/SMEUpload";
import SettingsPage from "@/pages/SettingsPage";
import PricingSettings from "@/pages/PricingSettings";
import CapitalPool from "@/pages/CapitalPool";
import AdminOpportunities from "@/pages/AdminOpportunities";
import AdminOpportunityFollowUps from "@/pages/AdminOpportunityFollowUps";
import BrandedNotFound from "@/pages/website/BrandedNotFound";
import LegalPage from "@/pages/website/LegalPage";
import AdminVerifications from "@/pages/admin/AdminVerifications";

// Exporter portal pages
import ExporterDashboardPage from "@/pages/exporter/ExporterDashboard";
import ExporterDocuments from "@/pages/exporter/ExporterDocuments";
import ExporterOnboarding from "@/pages/exporter/ExporterOnboarding";
import ExporterPendingApproval from "@/pages/exporter/ExporterPendingApproval";
import ExporterDeals from "@/pages/exporter/ExporterDeals";
import ExporterDealNew from "@/pages/exporter/ExporterDealNew";
import ExporterDealDetail from "@/pages/exporter/ExporterDealDetail";

// Website (marketing) pages
import VeloxisHome from "@/pages/website/VeloxisHome";
import ExporterApply from "@/pages/website/ExporterApply";
import ApplicationsAdmin from "@/pages/website/ApplicationsAdmin";
import Unsubscribe from "@/pages/website/Unsubscribe";
import NbccRedirect from "@/pages/website/NbccRedirect";
import MarketingLeads from "@/pages/MarketingLeads";
import AdminContentGeneration from "@/pages/AdminContentGeneration";

// Account pages
import AccountSettings from "@/pages/account/AccountSettings";
import ExporterCompanyProfile from "@/pages/account/ExporterCompanyProfile";
import AdminUserDirectory from "@/pages/account/AdminUserDirectory";
import NotificationsPage from "@/pages/NotificationsPage";

const queryClient = new QueryClient();

const ADMIN_ROLES = ['super_admin', 'deal_manager', 'admin_manager'] as const;

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function ExporterRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['exporter']}>
      <ExporterPortalLayout>{children}</ExporterPortalLayout>
    </ProtectedRoute>
  );
}

function NotificationsShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ConfirmProvider>
          <Routes>
            {/* Marketing website */}
            <Route path="/" element={<VeloxisHome />} />
            <Route path="/homepage" element={<VeloxisHome />} />
            <Route path="/apply/exporter" element={<ExporterApply />} />
            <Route path="/pipeline" element={<ApplicationsAdmin />} />

            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/upload/:token" element={<SMEUpload />} />

            {/* Legacy partner/greystar routes → redirect to admin dashboard */}
            <Route path="/greystar/*" element={<Navigate to="/admin" replace />} />
            <Route path="/partner-kyb" element={<Navigate to="/admin" replace />} />
            <Route path="/apply/partner" element={<Navigate to="/" replace />} />

            {/* Exporter onboarding */}
            <Route path="/exporter/onboarding" element={
              <ProtectedRoute allowedRoles={['exporter']}>
                <ExporterOnboarding />
              </ProtectedRoute>
            } />
            <Route path="/exporter/pending" element={
              <ProtectedRoute allowedRoles={['exporter']}>
                <ExporterPendingApproval />
              </ProtectedRoute>
            } />

            {/* Exporter portal */}
            <Route path="/exporter" element={<ExporterRoute><ExporterDashboardPage /></ExporterRoute>} />
            <Route path="/exporter/deals" element={<ExporterRoute><ExporterDeals /></ExporterRoute>} />
            <Route path="/exporter/deals/new" element={<ExporterRoute><ExporterDealNew /></ExporterRoute>} />
            <Route path="/exporter/deals/:id/edit" element={<ExporterRoute><ExporterDealNew /></ExporterRoute>} />
            <Route path="/exporter/deals/:id" element={<ExporterRoute><ExporterDealDetail /></ExporterRoute>} />
            <Route path="/exporter/documents" element={<ExporterRoute><ExporterDocuments /></ExporterRoute>} />
            <Route path="/exporter/account/profile" element={<ExporterRoute><ExporterCompanyProfile /></ExporterRoute>} />
            <Route path="/exporter/account/settings" element={<ExporterRoute><AccountSettings /></ExporterRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/deals" element={<AdminLayout><AdminDeals /></AdminLayout>} />
            <Route path="/admin/deals/:id" element={<AdminLayout><DealDetail /></AdminLayout>} />
            <Route path="/admin/registration-pipeline" element={<AdminLayout><ApplicationsAdmin embedded /></AdminLayout>} />
            <Route path="/admin/users" element={<AdminLayout><AdminUserDirectory /></AdminLayout>} />
            <Route path="/admin/account" element={<AdminLayout><AccountSettings /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />
            <Route path="/admin/pricing" element={<AdminLayout><PricingSettings /></AdminLayout>} />
            <Route path="/admin/marketing" element={<AdminLayout><MarketingLeads /></AdminLayout>} />
            <Route path="/admin/marketing/content" element={<AdminLayout><AdminContentGeneration /></AdminLayout>} />
            <Route path="/admin/capital" element={<AdminLayout><CapitalPool /></AdminLayout>} />
            <Route path="/admin/opportunities" element={<AdminLayout><AdminOpportunities /></AdminLayout>} />
            <Route path="/admin/opportunities/follow-ups" element={<AdminLayout><AdminOpportunityFollowUps /></AdminLayout>} />
            <Route path="/admin/verifications" element={<AdminLayout><AdminVerifications /></AdminLayout>} />

            {/* Originator/admin dashboard + exporter management */}
            <Route path="/dashboard" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
            <Route path="/exporters" element={<AuthenticatedLayout><ExportersList /></AuthenticatedLayout>} />
            <Route path="/exporters/new" element={<AuthenticatedLayout><ExporterNew /></AuthenticatedLayout>} />
            <Route path="/exporters/:id" element={<AuthenticatedLayout><ExporterDetail /></AuthenticatedLayout>} />
            <Route path="/deals" element={<AuthenticatedLayout><DealsList /></AuthenticatedLayout>} />
            <Route path="/deals/new" element={<AuthenticatedLayout><DealNew /></AuthenticatedLayout>} />
            <Route path="/deals/:id" element={<AuthenticatedLayout><DealDetail /></AuthenticatedLayout>} />

            {/* Legal */}
            <Route path="/privacy" element={<LegalPage slug="privacy" />} />
            <Route path="/privacy-policy" element={<LegalPage slug="privacy" />} />
            <Route path="/terms" element={<LegalPage slug="terms" />} />
            <Route path="/disclosure" element={<LegalPage slug="disclosure" />} />
            <Route path="/cookies" element={<LegalPage slug="cookies" />} />

            {/* Notifications (role-aware shell) */}
            <Route path="/notifications" element={<NotificationsShell><NotificationsPage /></NotificationsShell>} />

            {/* Misc */}
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/nbcc" element={<NbccRedirect />} />

            <Route path="*" element={<BrandedNotFound />} />
          </Routes>
          </ConfirmProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
