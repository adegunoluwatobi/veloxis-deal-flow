import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { isStaff } from '@/v2/roles';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const { signIn, user, roles, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={isStaff(roles) ? '/app' : '/portal'} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) { toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' }); return; }
    // RootRedirect handles role-based dashboard routing.
    nav('/home', { replace: true });
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: 'Email required', description: 'Enter your email address to receive a reset link.', variant: 'destructive' });
      return;
    }
    setResetBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetBusy(false);
    if (error) {
      toast({ title: 'Could not send reset link', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Reset link sent', description: 'Check your inbox for the password reset email.' });
    setResetMode(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="wordmark text-accent text-lg">VELOXIS</div>
          <p className="mt-2 text-sm text-muted-foreground">{resetMode ? 'Reset your password' : 'Sign in to continue'}</p>
        </div>
        <form onSubmit={resetMode ? onReset : onSubmit} className="space-y-4 card-elevated p-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          {!resetMode && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy || resetBusy}>
            {resetMode ? (resetBusy ? 'Sending…' : 'Send reset link') : (busy ? 'Signing in…' : 'Sign in')}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => setResetMode((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {resetMode ? 'Back to sign in' : 'Forgot password?'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
