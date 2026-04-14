import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types';

interface Props {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [exporterStatus, setExporterStatus] = useState<string | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);

  useEffect(() => {
    if (role !== 'exporter' || !user) {
      setStatusChecked(true);
      return;
    }
    // Fetch onboarding status for exporter routing
    supabase
      .from('exporters')
      .select('onboarding_status')
      .eq('exporter_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setExporterStatus(data?.onboarding_status ?? null);
        setStatusChecked(true);
      });
  }, [role, user]);

  if (loading || !statusChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;

  // Exporter routing enforcement based on persisted onboarding_status
  if (role === 'exporter') {
    const path = location.pathname;
    const isOnboardingRoute = path === '/exporter/onboarding';
    const isPendingRoute = path === '/exporter/pending';

    if (exporterStatus === 'onboarding_submitted') {
      if (!isPendingRoute) return <Navigate to="/exporter/pending" replace />;
    } else if (exporterStatus === 'onboarding_approved') {
      // Approved: allow full portal, but redirect away from onboarding/pending
      if (isOnboardingRoute || isPendingRoute) return <Navigate to="/exporter" replace />;
    } else {
      // invited, password_set, onboarding_in_progress, onboarding_rejected → onboarding form
      if (!isOnboardingRoute) return <Navigate to="/exporter/onboarding" replace />;
    }
  }

  return <>{children}</>;
}
