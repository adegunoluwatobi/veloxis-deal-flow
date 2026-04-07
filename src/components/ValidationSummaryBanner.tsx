import { X } from 'lucide-react';
import type { ValidationFailure } from '@/lib/validation';

interface Props {
  failures: ValidationFailure[];
  onDismiss: () => void;
}

export default function ValidationSummaryBanner({ failures, onDismiss }: Props) {
  if (failures.length === 0) return null;

  const scrollTo = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('validation-error-highlight');
      setTimeout(() => el.classList.remove('validation-error-highlight'), 3000);
    }
  };

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-destructive">
            Please fix the following {failures.length} {failures.length === 1 ? 'issue' : 'issues'}:
          </p>
          <ul className="space-y-1">
            {failures.map(f => (
              <li key={f.fieldId}>
                <button
                  type="button"
                  onClick={() => scrollTo(f.fieldId)}
                  className="text-sm text-destructive underline cursor-pointer hover:text-destructive/80 transition-colors"
                >
                  • {f.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-sm p-1 text-destructive/70 hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
