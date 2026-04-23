import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import SuspendedScreen from '@/pages/SuspendedScreen';
import type { AppRole } from '@/types';

interface Props {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [exporterStatus, setExporterStatus] = useState<string | null>(null);
  const [partnerKybSubmitted, setPartnerKybSubmitted] = useState<boolean | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    if (!user) {
      setStatusChecked(true);
      return;
    }

    // Check suspension via public.users.is_active (mirrors auth banned_until)
    (async () => {
      const { data: userRow } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle();
      if (userRow && userRow.is_active === false) {
        setIsSuspended(true);
      }

      if (role === 'exporter') {
        const { data } = await supabase
          .from('exporters')
          .select('onboarding_status')
          .eq('exporter_user_id', user.id)
          .maybeSingle();
        setExporterStatus(data?.onboarding_status ?? null);
      }

      if (role === 'partner_admin' || role === 'partner_staff') {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('partner_organisation_id')
          .eq('user_id', user.id)
          .maybeSingle();
        const orgId = roleRow?.partner_organisation_id;
        if (orgId) {
          const { data: orgRow } = await supabase
            .from('partner_organisations')
            .select('kyb_submitted_at, kyb_verified_at')
            .eq('id', orgId)
            .maybeSingle();
          // KYB gate clears once verified; partner_staff are not blocked (only admin can submit)
          setPartnerKybSubmitted(!!orgRow?.kyb_verified_at || role === 'partner_staff' || !!orgRow?.kyb_submitted_at);
        } else {
          setPartnerKybSubmitted(true);
        }
      }
      setStatusChecked(true);
    })();
  }, [role, user]);

  if (loading || !statusChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isSuspended) return <SuspendedScreen />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;

  // Partner KYB gate — partner_admin must submit KYB before reaching the dashboard
  if (role === 'partner_admin' && partnerKybSubmitted === false && location.pathname !== '/partner-kyb') {
    return <Navigate to="/partner-kyb" replace />;
  }
  // If submitted/verified, don't trap the user on /partner-kyb
  if (role === 'partner_admin' && partnerKybSubmitted === true && location.pathname === '/partner-kyb') {
    // allow showing the page (it will render the verified/submitted state) — no redirect
  }

  // Exporter routing enforcement based on persisted onboarding_status
  if (role === 'exporter') {
    const path = location.pathname;
    const isOnboardingRoute = path === '/exporter/onboarding';
    const isPendingRoute = path === '/exporter/pending';
    const isAccountRoute = path.startsWith('/account');

    // Allow access to /account regardless of onboarding stage
    if (isAccountRoute) return <>{children}</>;

    if (exporterStatus === 'onboarding_submitted') {
      if (!isPendingRoute) return <Navigate to="/exporter/pending" replace />;
    } else if (exporterStatus === 'onboarding_approved') {
      if (isOnboardingRoute || isPendingRoute) return <Navigate to="/exporter" replace />;
    } else {
      if (!isOnboardingRoute) return <Navigate to="/exporter/onboarding" replace />;
    }
  }

  return <>{children}</>;
}
