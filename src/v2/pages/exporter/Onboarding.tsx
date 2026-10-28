import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Check, CheckCircle2, Lock, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import SignOutButton from '@/v2/components/SignOutButton';
import NotificationBell from '@/v2/components/NotificationBell';
import { useOnboarding } from './onboarding/useOnboarding';
import { businessErrors, peopleErrors } from './onboarding/validation';
import BusinessStep from './onboarding/BusinessStep';
import PeopleStep from './onboarding/PeopleStep';
import ReviewSummary from './onboarding/ReviewSummary';

const STEPS = ['Business Details', 'Directors & Shareholders', 'Review & Submit'];

export function OnboardingHeader({ email }: { email?: string | null }) {
  return (
    <header className="h-16 border-b border-border bg-card print:hidden">
      <div className="mx-auto flex h-full max-w-4xl items-center gap-3 px-4 sm:px-6">
        <span className="wordmark text-accent">VELOXIS</span>
        <span className="ml-auto hidden truncate text-xs text-muted-foreground sm:inline">{email}</span>
        <NotificationBell />
        <SignOutButton />
      </div>
    </header>
  );
}

export default function ExporterOnboarding() {
  const ctx = useOnboarding();
  const nav = useNavigate();
  const { f, exp, docs, people, lock, profile, saveState } = ctx;
  const [step, setStep] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState<Record<number, boolean>>({});
  const [confirmTrue, setConfirmTrue] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittedOpen, setSubmittedOpen] = useState(false);

  const bErr = useMemo(() => (f ? businessErrors(f, docs) : {}), [f, docs]);
  const pErr = useMemo(() => peopleErrors(people, docs), [people, docs]);

  // Resume at the saved step, or the first incomplete one for older applications.
  useEffect(() => {
    if (!f || step !== null) return;
    const saved = Number(f.onboarding_step) || 1;
    const firstIncomplete = Object.keys(bErr).length ? 1 : pErr.count ? 2 : 3;
    setStep(exp?.onboarding_step ? Math.min(saved, firstIncomplete) : firstIncomplete);
  }, [f, exp, step, bErr, pErr]);

  if (!f || step === null) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
      <span>Loading…</span><SignOutButton />
    </div>
  );

  if (lock.formLocked) return <Navigate to="/portal/onboarding/status" replace />;

  const go = (n: number) => {
    setStep(n);
    if (Number(f.onboarding_step) !== n) { ctx.set('onboarding_step', n); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToError = () => setTimeout(() => document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);

  const next = () => {
    const count = step === 1 ? Object.keys(bErr).length : pErr.count;
    if (count) {
      setShowErrors((s) => ({ ...s, [step]: true }));
      toast({ title: 'Please fix the highlighted fields', description: `${count} item${count === 1 ? '' : 's'} need attention.`, variant: 'destructive' });
      scrollToError();
      return;
    }
    go(step + 1);
  };

  const submit = async () => {
    if (Object.keys(bErr).length) { setShowErrors((s) => ({ ...s, 1: true })); go(1); scrollToError(); return; }
    if (pErr.count) { setShowErrors((s) => ({ ...s, 2: true })); go(2); scrollToError(); return; }
    if (!confirmTrue || !consent) { toast({ title: 'Please tick both declarations to submit', variant: 'destructive' }); return; }
    setBusy(true);
    const id = await ctx.saveCompany();
    if (!id) { setBusy(false); toast({ title: 'Could not save your application', variant: 'destructive' }); return; }
    const now = new Date().toISOString();
    const { error } = await supabase.from('v2_exporters').update({
      onboarding_status: 'pending', kyb_status: 'pending', kyc_status: 'pending', onboarding_submitted_at: now,
      accuracy_confirmed_at: now, data_consent_at: now, bd_rejected_at: null, bd_rejection_reason: null,
    } as any).eq('id', id);
    setBusy(false);
    if (error) { toast({ title: 'Submit failed', description: 'Please try again.', variant: 'destructive' }); return; }
    setSubmittedOpen(true);
  };

  const errB = (k: string) => (showErrors[1] ? bErr[k] : undefined);
  const errP = (pid: string, k: string) => (showErrors[2] ? pErr.byPerson[pid]?.[k] : undefined);

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader email={profile?.email} />
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
        <div className="print:hidden">
          <h1 className="text-xl sm:text-2xl">Complete your onboarding</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your progress saves automatically — you can leave and come back at any time.</p>
        </div>

        {lock.bdRejected && (
          <div className="card-elevated flex items-start gap-3 border-destructive/60 bg-destructive/10 p-4 print:hidden">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <div className="font-medium text-destructive">More information requested</div>
              <div className="mt-1">{exp?.bd_rejection_reason || 'Your reviewer requested changes.'}</div>
              <div className="mt-1 text-muted-foreground">Update the details below and resubmit.</div>
            </div>
          </div>
        )}

        <ol className="grid grid-cols-3 gap-2 print:hidden" aria-label="Progress">
          {STEPS.map((label, i) => {
            const n = i + 1; const done = n < step; const active = n === step;
            return (
              <li key={label}>
                <button type="button" onClick={() => (n < step ? go(n) : n === step + 1 ? next() : undefined)}
                  className={`flex w-full flex-col items-start gap-1.5 rounded-md border p-2 text-left sm:flex-row sm:items-center sm:p-3 ${active ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${done ? 'bg-primary text-primary-foreground' : active ? 'border-2 border-primary text-primary' : 'border border-border text-muted-foreground'}`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : n}
                  </span>
                  <span className={`text-[11px] leading-tight sm:text-sm ${active ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {step === 1 && <BusinessStep ctx={ctx} err={errB} />}
        {step === 2 && <PeopleStep ctx={ctx} errFor={errP} listError={pErr.list} showErrors={!!showErrors[2]} />}
        {step === 3 && (
          <>
            <ReviewSummary ctx={ctx} onEdit={go} />
            <section className="card-elevated space-y-4 p-4 sm:p-6 print:hidden">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={confirmTrue} onCheckedChange={(v) => setConfirmTrue(!!v)} className="mt-0.5" />
                <span>I confirm the information provided is true, complete and accurate.</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                <span>I consent to Veloxis Global Limited processing this information and sharing it with its funding partners for the purpose of assessing financing, in line with the Nigeria Data Protection Act 2023.</span>
              </label>
            </section>
          </>
        )}

        <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/95 p-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 print:hidden">
          <div className="flex items-center gap-3">
            {step > 1 && <Button variant="outline" onClick={() => go(step - 1)}>Back</Button>}
            <span className="text-xs text-muted-foreground">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Draft saved' : saveState === 'error' ? 'Not saved — check your connection' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            {step === 3 && <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / save PDF</Button>}
            {step < 3
              ? <Button onClick={next} className="flex-1 sm:flex-none">Continue</Button>
              : <Button onClick={submit} disabled={busy || !confirmTrue || !consent} className="flex-1 sm:flex-none">{busy ? 'Submitting…' : 'Submit application'}</Button>}
          </div>
        </div>
      </main>

      <Dialog open={submittedOpen} onOpenChange={(o) => { setSubmittedOpen(o); if (!o) nav('/portal/onboarding/status', { replace: true }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-accent"><CheckCircle2 className="h-5 w-5" /><DialogTitle>Application submitted</DialogTitle></div>
            <DialogDescription className="pt-2">Your Business Developer reviews first, then Credit &amp; Compliance gives final approval.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-muted-foreground">Your details are now locked while under review. We'll email you as soon as there's a decision.</div>
          </div>
          <DialogFooter><Button onClick={() => { setSubmittedOpen(false); nav('/portal/onboarding/status', { replace: true }); }}>View status</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
