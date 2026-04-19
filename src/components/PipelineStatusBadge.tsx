import { cn } from '@/lib/utils';
import { pipelineStatusBadgeClass, pipelineStatusLabel, type PipelineStatus } from '@/lib/pipelineStatus';

interface PipelineStatusBadgeProps {
  status: PipelineStatus | string | null | undefined;
  className?: string;
}

/**
 * Renders the canonical pipeline status badge used by both the admin
 * Registration Pipeline and the partner shell.
 */
export default function PipelineStatusBadge({ status, className }: PipelineStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        pipelineStatusBadgeClass(status),
        className,
      )}
    >
      {pipelineStatusLabel(status)}
    </span>
  );
}
