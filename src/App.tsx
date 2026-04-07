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
import ExporterDetail from "@/pages/ExporterDetail";
import DealsList from "@/pages/DealsList";
import DealNew from "@/pages/DealNew";
import DealDetail from "@/pages/DealDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminDeals from "@/pages/AdminDeals";
import SMEUpload from "@/pages/SMEUpload";
import SettingsPage from "@/pages/SettingsPage";
import CapitalPool from "@/pages/CapitalPool";
import PartnersPage from "@/pages/PartnersPage";
import PartnerDetail from "@/pages/PartnerDetail";
import NotFound from "@/pages/NotFound";

// Greystar pages
import GreystarDashboard from "@/pages/greystar/GreystarDashboard";
import GreystarExportersList from "@/pages/greystar/GreystarExportersList";
import GreystarExporterNew from "@/pages/greystar/GreystarExporterNew";
import GreystarExporterDetail from "@/pages/greystar/GreystarExporterDetail";
import GreystarReviewQueue from "@/pages/greystar/GreystarReviewQueue";
import GreystarSettings from "@/pages/greystar/GreystarSettings";
import GreystarDeals from "@/pages/greystar/GreystarDeals";
import GreystarDealDetail from "@/pages/greystar/GreystarDealDetail";

// Exporter portal pages
import ExporterDashboardPage from "@/pages/exporter/ExporterDashboard";
import ExporterDocuments from "@/pages/exporter/ExporterDocuments";
import ExporterOnboarding from "@/pages/exporter/ExporterOnboarding";
import ExporterPendingApproval from "@/pages/exporter/ExporterPendingApproval";
import ExporterDeals from "@/pages/exporter/ExporterDeals";
import ExporterDealNew from "@/pages/exporter/ExporterDealNew";
import ExporterDealDetail from "@/pages/exporter/ExporterDealDetail";

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
            <Route path="/greystar/settings" element={<GreystarRoute><GreystarSettings /></GreystarRoute>} />

            {/* Exporter portal routes (require approved onboarding) */}
            <Route path="/exporter" element={<ExporterRoute><ExporterDashboardPage /></ExporterRoute>} />
            <Route path="/exporter/deals" element={<ExporterRoute><ExporterDeals /></ExporterRoute>} />
            <Route path="/exporter/deals/new" element={<ExporterRoute><ExporterDealNew /></ExporterRoute>} />
            <Route path="/exporter/deals/:id" element={<ExporterRoute><ExporterDealDetail /></ExporterRoute>} />
            <Route path="/exporter/documents" element={<ExporterRoute><ExporterDocuments /></ExporterRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/deals" element={<AdminLayout><AdminDeals /></AdminLayout>} />
            <Route path="/admin/deals/:id" element={<AdminLayout><DealDetail /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />
            <Route path="/admin/capital" element={<AdminLayout><CapitalPool /></AdminLayout>} />
            <Route path="/admin/partners" element={<AdminLayout><PartnersPage /></AdminLayout>} />
            <Route path="/admin/partners/:id" element={<AdminLayout><PartnerDetail /></AdminLayout>} />

            {/* Originator routes */}
            <Route path="/" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
            <Route path="/exporters" element={<AuthenticatedLayout><ExportersList /></AuthenticatedLayout>} />
            <Route path="/exporters/new" element={<AuthenticatedLayout><ExporterNew /></AuthenticatedLayout>} />
            <Route path="/exporters/:id" element={<AuthenticatedLayout><ExporterDetail /></AuthenticatedLayout>} />
            <Route path="/deals" element={<AuthenticatedLayout><DealsList /></AuthenticatedLayout>} />
            <Route path="/deals/new" element={<AuthenticatedLayout><DealNew /></AuthenticatedLayout>} />
            <Route path="/deals/:id" element={<AuthenticatedLayout><DealDetail /></AuthenticatedLayout>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </ConfirmProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
