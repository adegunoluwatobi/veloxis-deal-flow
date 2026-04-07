import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ExportersList from "@/pages/ExportersList";
import ExporterNew from "@/pages/ExporterNew";
import ExporterDetail from "@/pages/ExporterDetail";
import DealsList from "@/pages/DealsList";
import DealNew from "@/pages/DealNew";
import SMEUpload from "@/pages/SMEUpload";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
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
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/upload/:token" element={<SMEUpload />} />
            <Route path="/" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
            <Route path="/exporters" element={<AuthenticatedLayout><ExportersList /></AuthenticatedLayout>} />
            <Route path="/exporters/new" element={<AuthenticatedLayout><ExporterNew /></AuthenticatedLayout>} />
            <Route path="/exporters/:id" element={<AuthenticatedLayout><ExporterDetail /></AuthenticatedLayout>} />
            <Route path="/deals" element={<AuthenticatedLayout><DealsList /></AuthenticatedLayout>} />
            <Route path="/deals/new" element={<AuthenticatedLayout><DealNew /></AuthenticatedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
