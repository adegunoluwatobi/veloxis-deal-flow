import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, FileEdit, Printer, XCircle } from 'lucide-react';
import { wizardStatus, WIZARD_STATUS_LABEL } from '@/v2/lib/onboardingRules';
import { useOnboarding } from './onboarding/useOnboarding';
import ReviewSummary from './onboarding/ReviewSummary';
import DocUpload from './onboarding/DocUpload';
import { OnboardingHeader } from './Onboarding';

export default function OnboardingStatus() {
  const ctx = useOnboarding();
  const nav = useNavigate();
  const { f, exp, docs, profile, uploadDoc } = ctx;
  if (!f) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  const status = wizardStatus(exp);
  if (status === 'draft') return <Navigate to="/portal/onboarding" replace />;

  // Rejected documents can be replaced even while the rest of the form is locked.
  const rejectedLatest = Object.values(
    docs.reduce<Record<string, typeof docs[number]>>((acc, d) => {
      const k = `${d.code}:${d.person_id ?? ''}`;
      if (!acc[k]) acc[k] = d;
      return acc;
    }, {}),
  ).filter((d) => d.status === 'rejected');

  const tone = {
    submitted: { Icon: Clock, cls: 'border-amber-500/40 bg-amber-500/10', text: 'Your application has been received and is waiting for your Business Developer to review it.' },
    under_review: { Icon: Clock, cls: 'border-amber-500/40 bg-amber-500/10', text: 'Your Business Developer has reviewed your application. Credit & Compliance is now giving final approval.' },
    more_info: { Icon: AlertCircle, cls: 'border-destructive/60 bg-destructive/10', text: exp?.bd_rejection_reason || 'Your reviewer needs more information.' },
    approved: { Icon: CheckCircle2, cls: 'border-primary/40 bg-primary/10', text: 'Your business is approved. You can now use the exporter portal.' },
    rejected: { Icon: XCircle, cls: 'border-destructive/60 bg-destructive/10', text: 'Your application was not approved. Please contact Veloxis for more information.' },
  }[status as Exclude<typeof status, 'draft'>];

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader email={profile?.email} />
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
        <h1 className="text-xl sm:text-2xl print:hidden">Application status</h1>
        <div className={`card-elevated flex items-start gap-3 p-4 print:hidden ${tone.cls}`}>
          <tone.Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">{WIZARD_STATUS_LABEL[status]}</div>
            {exp?.onboarding_submitted_at && <div className="text-xs text-muted-foreground">Submitted {new Date(exp.onboarding_submitted_at).toLocaleString('en-GB')}</div>}
            <div className="mt-1">{tone.text}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {status === 'approved' && <Button size="sm" onClick={() => nav('/portal', { replace: true })}>Go to dashboard</Button>}
              {status === 'more_info' && <Button size="sm" onClick={() => nav('/portal/onboarding')}><FileEdit className="mr-1 h-4 w-4" />Update and resubmit</Button>}
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / save PDF</Button>
            </div>
          </div>
        </div>

        {rejectedLatest.length > 0 && status !== 'more_info' && (
          <section className="card-elevated space-y-3 border-destructive/50 p-4 sm:p-6 print:hidden">
            <h2 className="text-sm uppercase tracking-wider text-destructive">Documents to replace</h2>
            <p className="text-xs text-muted-foreground">Upload corrected copies of these documents. The rest of your application stays locked.</p>
            {rejectedLatest.map((d) => (
              <DocUpload key={d.id} label={d.label} files={[d]} locked needsIssueDate={['business_address_proof', 'proof_of_address'].includes(d.code)}
                photoOnly={d.code === 'passport_photo'} onUpload={(file, issueDate) => uploadDoc(file, d.code, { personId: d.person_id, issueDate })} />
            ))}
          </section>
        )}

        <ReviewSummary ctx={ctx} />
      </main>
    </div>
  );
}
