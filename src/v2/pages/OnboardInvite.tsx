import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, MailCheck, Loader2 } from 'lucide-react';
import { passwordError, PASSWORD_RULE_TEXT } from '@/v2/lib/kybInvite';

type State =
  | { kind: 'loading' }
  | { kind: 'invalid'; message?: string }
  | { kind: 'form'; email: string; company: string }
  | { kind: 'check-inbox'; email: string };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-xs font-semibold uppercase tracking-wider text-primary">Veloxis · KYB Onboarding Invite</div>
        {children}
      </div>
    </div>
  );
}

export default function OnboardInvite() {
  const { token = '' } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ pw?: string; pw2?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke('kyb-invite-validate', { body: { token } });
      if (data?.valid) setState({ kind: 'form', email: data.email, company: data.company_name });
      else setState({ kind: 'invalid', message: data?.error });
    })();
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== 'form') return;
    const next: typeof errors = {};
    const pe = passwordError(pw); if (pe) next.pw = pe;
    if (pw !== pw2) next.pw2 = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('register-with-invite', { body: { token, password: pw } });
    if (error || !data?.success) {
      let msg = 'Something went wrong. Please try again.';
      try { msg = (await (error as any)?.context?.json())?.error ?? data?.error ?? msg; } catch { /* keep default */ }
      setBusy(false);
      setErrors({ form: msg });
      return;
    }
    if (data.existing_account) {
      const { error: sErr } = await supabase.auth.signInWithPassword({ email: data.email, password: pw });
      setBusy(false);
      if (sErr) { nav('/login', { replace: true }); return; }
      nav('/portal/onboarding', { replace: true });
      return;
    }
    setBusy(false);
    setCooldown(60);
    setState({ kind: 'check-inbox', email: data.email });
  };

  const resend = async () => {
    if (state.kind !== 'check-inbox' || cooldown > 0) return;
    await supabase.auth.resend({ type: 'signup', email: state.email, options: { emailRedirectTo: `${window.location.origin}/portal/onboarding` } });
    setCooldown(60);
  };

  if (state.kind === 'loading') return <Shell><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking your invitation…</div></Shell>;

  if (state.kind === 'invalid') return (
    <Shell>
      <h1 className="text-xl font-semibold">Invitation not valid</h1>
      <p className="mt-3 text-sm text-muted-foreground">{state.message ?? 'This invitation link is no longer valid. Please contact Veloxis for a new link.'}</p>
      <div className="mt-5 rounded-md bg-muted p-4 text-sm">
        <div className="font-medium">Veloxis Global Limited</div>
        <a className="text-primary underline" href="mailto:support@veloxis.co.uk">support@veloxis.co.uk</a>
      </div>
      <Link to="/login" className="mt-5 inline-block text-sm text-primary underline">Already have an account? Sign in</Link>
    </Shell>
  );

  if (state.kind === 'check-inbox') return (
    <Shell>
      <MailCheck className="h-8 w-8 text-primary" />
      <h1 className="mt-3 text-xl font-semibold">Check your inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link to <span className="font-medium text-foreground">{state.email}</span>. Click it to confirm your email and start onboarding.</p>
      <Button variant="outline" className="mt-5 w-full" disabled={cooldown > 0} onClick={resend}>
        {cooldown > 0 ? `Resend confirmation email (${cooldown}s)` : 'Resend confirmation email'}
      </Button>
      <Link to="/login" className="mt-4 inline-block text-sm text-primary underline">Go to sign in</Link>
    </Shell>
  );

  return (
    <Shell>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">For {state.company}</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="inv-email">Email</Label>
          <div className="relative">
            <Input id="inv-email" value={state.email} readOnly disabled className="pr-9" aria-describedby="inv-email-help" />
            <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          </div>
          <p id="inv-email-help" className="text-xs text-muted-foreground">This invitation is linked to this email address and cannot be changed. If it is incorrect, contact Veloxis for a new invitation.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-pw">Password</Label>
          <div className="relative">
            <Input id="inv-pw" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" aria-invalid={!!errors.pw} className="pr-9" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className={`text-xs ${errors.pw ? 'text-destructive' : 'text-muted-foreground'}`}>{errors.pw ?? PASSWORD_RULE_TEXT}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-pw2">Confirm password</Label>
          <Input id="inv-pw2" type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" aria-invalid={!!errors.pw2} />
          {errors.pw2 && <p className="text-xs text-destructive">{errors.pw2}</p>}
        </div>
        {errors.form && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{errors.form}</div>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
        <p className="text-center text-xs text-muted-foreground">Already have an account? <Link to="/login" className="text-primary underline">Sign in</Link></p>
      </form>
    </Shell>
  );
}
