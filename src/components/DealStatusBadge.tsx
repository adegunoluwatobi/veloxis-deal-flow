import { Badge } from '@/components/ui/badge';
import { getDealStatusLabel, DEAL_STATUS_COLORS, type DealStatus, type Portal } from '@/types';
import { cn } from '@/lib/utils';

export default function DealStatusBadge({ status, portal }: { status: DealStatus; portal?: Portal }) {
  return (
    <Badge variant="secondary" className={cn('font-medium', DEAL_STATUS_COLORS[status])}>
      {getDealStatusLabel(status, portal)}
    </Badge>
  );
}
