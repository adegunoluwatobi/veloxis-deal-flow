import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type KybView = {
  kyb_status: string | null;
  kyb_submitted_at: string | null;
  kyb_verified_at: string | null;
  kyb_rejected_at: string | null;
};

interface Props {
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Badge that shows the partner organisation's KYB lifecycle state.
 * Renders nothing for non-partner users.
 */
export default function PartnerKybStatusBadge({ variant = 'full', className }: Props) {
  const { user, role } = useAuth();
  const isPartner = role === 'partner_admin' || role === 'partner_staff';

  const { data: orgRow } = useQuery({
    queryKey: ['partner_kyb_status_badge', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('partner_organisation_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const orgId = roleRow?.partner_organisation_id;
      if (!orgId) return null;
      const { data } = await supabase
        .from('partner_organisations')
        .select('kyb_status, kyb_submitted_at, kyb_verified_at, kyb_rejected_at')
        .eq('id', orgId)
        .maybeSingle();
      return (data ?? null) as KybView | null;
    },
    enabled: !!user?.id && isPartner,
    staleTime: 60_000,
  });

  if (!isPartner || !orgRow) return null;

  const state = (() => {
    if (orgRow.kyb_verified_at) {
      return {
        key: 'verified' as const,
        label: 'KYB Verified',
        short: 'Verified',
        Icon: ShieldCheck,
        tone: 'bg-success/10 text-success border-success/30',
        tooltip: 'Your organisation has passed KYB review.',
      };
    }
    if (orgRow.kyb_rejected_at && !orgRow.kyb_verified_at) {
      return {
        key: 'rejected' as const,
        label: 'KYB Action Needed',
        short: 'Action needed',
        Icon: ShieldAlert,
        tone: 'bg-destructive/10 text-destructive border-destructive/30',
        tooltip: 'Your last KYB submission was returned. Please update and resubmit.',
      };
    }
    if (orgRow.kyb_submitted_at) {
      return {
        key: 'pending' as const,
        label: 'KYB In Review',
        short: 'In review',
        Icon: Clock,
        tone: 'bg-warning/10 text-warning border-warning/30',
        tooltip: 'Veloxis is reviewing your KYB submission.',
      };
    }
    return {
      key: 'not_submitted' as const,
      label: 'KYB Required',
      short: 'Required',
      Icon: ShieldQuestion,
      tone: 'bg-muted text-foreground/70 border-border',
      tooltip: 'Submit your KYB documents to unlock the full dashboard.',
    };
  })();

  const inner = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 font-medium border',
        state.tone,
        variant === 'compact' ? 'h-5 px-2 text-[10px]' : 'h-6 px-2.5 text-[11px]',
        className,
      )}
    >
      <state.Icon className={cn(variant === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {variant === 'compact' ? state.short : state.label}
    </Badge>
  );

  // Verified: just show a static badge. Otherwise link to the KYB page.
  const wrapped = state.key === 'verified' ? (
    inner
  ) : (
    <Link to="/partner-kyb" aria-label={state.tooltip}>
      {inner}
    </Link>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{wrapped}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{state.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
