import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SignOutButton from './SignOutButton';

/** Consistent full-screen loading state used everywhere auth readiness is pending. */
export function AuthLoading({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="w-full max-w-sm space-y-2 pt-4" aria-hidden>
        <div className="h-3 w-1/2 mx-auto rounded bg-muted/40 animate-pulse" />
        <div className="h-3 w-3/4 mx-auto rounded bg-muted/30 animate-pulse" />
      </div>
    </div>
  );
}

/** Graceful error state shown when roles/profile could not be fetched. */
export function AuthError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-7 w-7 text-warning" />
      <div className="space-y-1">
        <h1 className="text-base font-medium">We couldn't load your account</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your session is valid, but your roles and profile couldn't be fetched. This is usually a
          temporary network issue.
        </p>
        <p className="text-xs text-muted-foreground/80 pt-1">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}
