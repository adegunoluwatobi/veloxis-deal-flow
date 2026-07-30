import { Lock, AlertTriangle, Clock, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepState =
  | 'Not started'
  | 'In progress'
  | 'Submitted'
  | 'Approved'
  | 'Complete'
  | 'Action required';

type StepProps = {
  index: 1 | 2;
  name: string;
  state: StepState;
  done: number;
  total: number;
  active: boolean;
  locked?: boolean;
  requestedCount?: number;
};

const stateClass = (s: StepState) =>
  s === 'Action required'
    ? 'bg-amber-500/15 text-amber-600 border-amber-500/40'
    : s === 'Approved' || s === 'Complete'
      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40'
      : s === 'Submitted'
        ? 'bg-primary/15 text-primary border-primary/40'
        : 'bg-muted text-muted-foreground border-border';

function Step({ index, name, state, done, total, active, locked, requestedCount }: StepProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn('flex-1 rounded-md border p-3', locked && 'opacity-50')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {locked && <Lock className="h-3.5 w-3.5" />}
          <span>Step {index} · {name}</span>
        </div>
        <span className={cn('rounded-full border px-2 py-0.5 text-xs whitespace-nowrap', stateClass(state))}>
          {state}
        </span>
      </div>

      {locked ? (
        <p className="mt-2 text-xs text-muted-foreground">Unlocks once your submission is approved</p>
      ) : (
        <>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', state === 'Action required' ? 'bg-amber-500' : 'bg-primary')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {done} of {total} documents uploaded
          </p>
          {state === 'Action required' && !!requestedCount && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {requestedCount} document{requestedCount === 1 ? '' : 's'} requested by Veloxis
            </p>
          )}
          {active && <span className="sr-only">Current step</span>}
        </>
      )}
    </div>
  );
}

export type SubmissionProgressProps = {
  step1: { state: StepState; done: number; total: number };
  step2: { state: StepState; done: number; total: number; locked: boolean };
  requestedCount: number;
  decisionDueAt?: string | null;
  clockPaused?: boolean;
};

export default function SubmissionProgress({
  step1, step2, requestedCount, decisionDueAt, clockPaused,
}: SubmissionProgressProps) {
  const activeStep = step2.locked ? 1 : 2;

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border md:px-4">
      {/* Mobile: one compact line */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">
            Step {activeStep} · {activeStep === 1 ? 'Submission' : 'Pre funding'}
          </span>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs', stateClass(activeStep === 1 ? step1.state : step2.state))}>
            {activeStep === 1 ? step1.state : step2.state}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', step1.state === 'Action required' ? 'bg-amber-500' : 'bg-primary')}
            style={{ width: `${step1.total ? Math.round((step1.done / step1.total) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {step1.done} of {step1.total} documents uploaded
          {requestedCount > 0 && ` · ${requestedCount} requested by Veloxis`}
        </p>
      </div>

      {/* Desktop: two steps */}
      <div className="hidden gap-3 md:flex">
        <Step index={1} name="Submission" state={step1.state} done={step1.done} total={step1.total} active={activeStep === 1} requestedCount={requestedCount} />
        <Step index={2} name="Pre funding" state={step2.state} done={step2.done} total={step2.total} active={activeStep === 2} locked={step2.locked} />
      </div>

      {(decisionDueAt || clockPaused) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {clockPaused ? (
            <><PauseCircle className="h-3.5 w-3.5" />Decision clock paused while we wait for your documents</>
          ) : (
            <><Clock className="h-3.5 w-3.5" />Decision due by {new Date(decisionDueAt!).toLocaleString()}</>
          )}
        </p>
      )}
    </div>
  );
}
