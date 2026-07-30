import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const type = hashParams.get('type') ?? searchParams.get('type');
    const urlError = hashParams.get('error_description') ?? searchParams.get('error_description') ?? hashParams.get('error') ?? searchParams.get('error');

    if (urlError) {
      setError('This password reset link is invalid or has expired. Please request a new one.');
      setChecking(false);
      return;
    }

    if (type !== 'recovery') {
      setError('This page can only be used from a password reset email.');
      setChecking(false);
      return;
    }

    const verify = async () => {
      // Supabase recovery links establish the session automatically once the hash is processed.
      // Wait briefly for the session to become available.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (mounted) {
            setValid(true);
            setChecking(false);
          }
          return;
        }
        if (attempt < 11) await new Promise((r) => window.setTimeout(r, 250));
      }
      if (mounted) {
        setError('Unable to verify your reset link. It may have expired.');
        setChecking(false);
      }
    };

    void verify();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session && mounted) {
        setValid(true);
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      toast({ title: 'Password too short', description: 'Minimum 8 characters.', variant: 'destructive' });
      return;
    }
    if (pw !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password: pw });
    if (updateErr) {
      setBusy(false);
      toast({ title: 'Could not update password', description: updateErr.message, variant: 'destructive' });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ password_set_at: new Date().toISOString() }).eq('user_id', user.id);
    }
    setBusy(false);
    setDone(true);
  };


  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm text-center card-elevated p-8 space-y-6">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <div>
            <h1 className="text-xl font-semibold">Password updated</h1>
            <p className="mt-2 text-sm text-muted-foreground">You can now sign in with your new password.</p>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="wordmark text-accent text-lg">VELOXIS</div>
          <h1 className="mt-2 text-xl font-semibold">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {valid ? 'Choose a secure password for your account.' : error}
          </p>
        </div>

        {valid && (
          <form onSubmit={submit} className="space-y-4 card-elevated p-6">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <div className="relative">
                <Input
                  id="pw"
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}

        {!valid && (
          <div className="text-center">
            <Button asChild variant="outline">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
