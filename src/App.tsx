import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import GreystarLayout from "@/components/GreystarLayout";
import ExporterPortalLayout from "@/components/ExporterPortalLayout";
import Login from "@/pages/Login";
import SetPassword from "@/pages/SetPassword";
import Dashboard from "@/pages/Dashboard";
import ExportersList from "@/pages/ExportersList";
import ExporterNew from "@/pages/ExporterNew";
import ExporterDetail from "@/pages/greystar/GreystarExporterDetail";
import DealsList from "@/pages/DealsList";
import DealNew from "@/pages/DealNew";
import DealDetail from "@/pages/DealDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminDeals from "@/pages/AdminDeals";
import SMEUpload from "@/pages/SMEUpload";
import SettingsPage from "@/pages/SettingsPage";
import PricingSettings from "@/pages/PricingSettings";
import CapitalPool from "@/pages/CapitalPool";
import PartnersPage from "@/pages/PartnersPage";
import PartnerDetail from "@/pages/PartnerDetail";
import PartnerKyb from "@/pages/PartnerKyb";
import AdminPartnerKybQueue from "@/pages/AdminPartnerKybQueue";
import AdminOpportunities from "@/pages/AdminOpportunities";
import BrandedNotFound from "@/pages/website/BrandedNotFound";
import LegalPage from "@/pages/website/LegalPage";
import { Navigate } from "react-router-dom";

// Greystar pages
import GreystarDashboard from "@/pages/greystar/GreystarDashboard";
import GreystarExportersList from "@/pages/greystar/GreystarExportersList";
import GreystarExporterNew from "@/pages/greystar/GreystarExporterNew";
import GreystarExporterDetail from "@/pages/greystar/GreystarExporterDetail";
import GreystarReviewQueue from "@/pages/greystar/GreystarReviewQueue";
import GreystarSettings from "@/pages/greystar/GreystarSettings";
import GreystarDeals from "@/pages/greystar/GreystarDeals";
import GreystarDealDetail from "@/pages/greystar/GreystarDealDetail";
import GreystarVerifications from "@/pages/greystar/GreystarVerifications";
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
import PartnerApply from "@/pages/website/PartnerApply";
import ApplicationsAdmin from "@/pages/website/ApplicationsAdmin";
import Unsubscribe from "@/pages/website/Unsubscribe";
import NbccRedirect from "@/pages/website/NbccRedirect";
import MarketingLeads from "@/pages/MarketingLeads";

// Account pages
import AccountSettings from "@/pages/account/AccountSettings";
import ExporterCompanyProfile from "@/pages/account/ExporterCompanyProfile";
import PartnerOrgProfile from "@/pages/account/PartnerOrgProfile";
import PartnerTeamMembers from "@/pages/account/PartnerTeamMembers";
import AdminUserDirectory from "@/pages/account/AdminUserDirectory";
import NotificationsPage from "@/pages/NotificationsPage";
import NotificationsRoleShell from "@/components/NotificationsRoleShell";

const queryClient = new QueryClient();

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['super_admin', 'deal_manager']}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function GreystarRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['partner_admin', 'partner_staff']}>
      <GreystarLayout>{children}</GreystarLayout>
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ConfirmProvider>
          <Routes>
            {/* Marketing website — homepage */}
            <Route path="/" element={<VeloxisHome />} />
            <Route path="/homepage" element={<VeloxisHome />} />
            <Route path="/apply/exporter" element={<ExporterApply />} />
            <Route path="/apply/partner" element={<PartnerApply />} />
            <Route path="/pipeline" element={<ApplicationsAdmin />} />

            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/upload/:token" element={<SMEUpload />} />

            {/* Exporter onboarding (before approval) */}
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

            {/* Greystar routes */}
            <Route path="/greystar" element={<GreystarRoute><GreystarDashboard /></GreystarRoute>} />
            <Route path="/greystar/exporters" element={<GreystarRoute><GreystarExportersList /></GreystarRoute>} />
            <Route path="/greystar/exporters/new" element={<GreystarRoute><GreystarExporterNew /></GreystarRoute>} />
            <Route path="/greystar/exporters/:id" element={<GreystarRoute><GreystarExporterDetail /></GreystarRoute>} />
            <Route path="/greystar/deals" element={<GreystarRoute><GreystarDeals /></GreystarRoute>} />
            <Route path="/greystar/deals/:id" element={<GreystarRoute><GreystarDealDetail /></GreystarRoute>} />
            <Route path="/greystar/review" element={<GreystarRoute><GreystarReviewQueue /></GreystarRoute>} />
            <Route path="/greystar/verifications" element={<GreystarRoute><GreystarVerifications /></GreystarRoute>} />
            <Route path="/greystar/settings" element={<GreystarRoute><GreystarSettings /></GreystarRoute>} />
            {/* Registration Pipeline is admin-only — partners are redirected to their Applications view */}
            <Route path="/greystar/pipeline" element={<Navigate to="/greystar/deals" replace />} />
            <Route path="/greystar/account/organisation" element={<GreystarRoute><PartnerOrgProfile /></GreystarRoute>} />
            <Route path="/greystar/account/team" element={<GreystarRoute><PartnerTeamMembers /></GreystarRoute>} />

            {/* Exporter portal routes (require approved onboarding) */}
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
            <Route path="/greystar/account" element={<GreystarRoute><AccountSettings /></GreystarRoute>} />
            <Route path="/admin/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />
            <Route path="/admin/pricing" element={<AdminLayout><PricingSettings /></AdminLayout>} />
            <Route path="/admin/marketing" element={<AdminLayout><MarketingLeads /></AdminLayout>} />
            <Route path="/admin/capital" element={<AdminLayout><CapitalPool /></AdminLayout>} />
            <Route path="/admin/partners" element={<AdminLayout><PartnersPage /></AdminLayout>} />
            <Route path="/admin/partners/:id" element={<AdminLayout><PartnerDetail /></AdminLayout>} />
            <Route path="/admin/partner-kyb" element={<AdminLayout><AdminPartnerKybQueue /></AdminLayout>} />
            <Route path="/admin/opportunities" element={<AdminLayout><AdminOpportunities /></AdminLayout>} />
            <Route path="/admin/verifications" element={<AdminLayout><AdminVerifications /></AdminLayout>} />

            {/* Partner KYB onboarding gate (no GreystarLayout — full-screen form) */}
            <Route path="/partner-kyb" element={
              <ProtectedRoute allowedRoles={['partner_admin', 'partner_staff']}>
                <PartnerKyb />
              </ProtectedRoute>
            } />

            {/* Originator routes */}
            <Route path="/dashboard" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
            <Route path="/exporters" element={<AuthenticatedLayout><ExportersList /></AuthenticatedLayout>} />
            <Route path="/exporters/new" element={<AuthenticatedLayout><ExporterNew /></AuthenticatedLayout>} />
            <Route path="/exporters/:id" element={<AuthenticatedLayout><ExporterDetail /></AuthenticatedLayout>} />
            <Route path="/deals" element={<AuthenticatedLayout><DealsList /></AuthenticatedLayout>} />
            <Route path="/deals/new" element={<AuthenticatedLayout><DealNew /></AuthenticatedLayout>} />
            <Route path="/deals/:id" element={<AuthenticatedLayout><DealDetail /></AuthenticatedLayout>} />

            {/* Legal pages */}
            <Route path="/privacy" element={<LegalPage slug="privacy" />} />
            <Route path="/privacy-policy" element={<LegalPage slug="privacy" />} />
            <Route path="/terms" element={<LegalPage slug="terms" />} />
            <Route path="/disclosure" element={<LegalPage slug="disclosure" />} />
            <Route path="/cookies" element={<LegalPage slug="cookies" />} />

            {/* Notifications (role-aware shell) */}
            <Route path="/notifications" element={
              <ProtectedRoute>
                <NotificationsRoleShell><NotificationsPage /></NotificationsRoleShell>
              </ProtectedRoute>
            } />

            {/* Email unsubscribe */}
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
