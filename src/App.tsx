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
import NotFound from "@/pages/NotFound";

// Greystar pages
import GreystarDashboard from "@/pages/greystar/GreystarDashboard";
import GreystarExportersList from "@/pages/greystar/GreystarExportersList";
import GreystarExporterNew from "@/pages/greystar/GreystarExporterNew";
import GreystarExporterDetail from "@/pages/greystar/GreystarExporterDetail";
import GreystarReviewQueue from "@/pages/greystar/GreystarReviewQueue";

// Exporter portal pages
import ExporterDashboardPage from "@/pages/exporter/ExporterDashboard";
import ExporterDocuments from "@/pages/exporter/ExporterDocuments";

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
    <ProtectedRoute allowedRoles={['deal_manager']}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function GreystarRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['greystar_originator']}>
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

            {/* Greystar routes */}
            <Route path="/greystar" element={<GreystarRoute><GreystarDashboard /></GreystarRoute>} />
            <Route path="/greystar/exporters" element={<GreystarRoute><GreystarExportersList /></GreystarRoute>} />
            <Route path="/greystar/exporters/new" element={<GreystarRoute><GreystarExporterNew /></GreystarRoute>} />
            <Route path="/greystar/exporters/:id" element={<GreystarRoute><GreystarExporterDetail /></GreystarRoute>} />
            <Route path="/greystar/review" element={<GreystarRoute><GreystarReviewQueue /></GreystarRoute>} />

            {/* Exporter portal routes */}
            <Route path="/exporter" element={<ExporterRoute><ExporterDashboardPage /></ExporterRoute>} />
            <Route path="/exporter/documents" element={<ExporterRoute><ExporterDocuments /></ExporterRoute>} />

            {/* Admin routes (deal_manager only) */}
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/deals" element={<AdminLayout><AdminDeals /></AdminLayout>} />
            <Route path="/admin/deals/:id" element={<AdminLayout><DealDetail /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />

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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
