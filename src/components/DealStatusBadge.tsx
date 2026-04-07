import { Badge } from '@/components/ui/badge';
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS, type DealStatus } from '@/types';
import { cn } from '@/lib/utils';

export default function DealStatusBadge({ status }: { status: DealStatus }) {
  return (
    <Badge variant="secondary" className={cn('font-medium', DEAL_STATUS_COLORS[status])}>
      {DEAL_STATUS_LABELS[status]}
    </Badge>
  );
}
