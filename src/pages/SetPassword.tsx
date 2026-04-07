import { useState, useEffect } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getConfiguredPublicAppUrl, getConfiguredSetPasswordUrl, isDisallowedAuthCallbackHost } from '@/lib/publicAppUrl';
import { Shield, CheckCircle2, Loader2 } from 'lucide-react';

export default function SetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resendExporterId, setResendExporterId] = useState('');
  const [resendingInvite, setResendingInvite] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const configuredPublicAppUrl = getConfiguredPublicAppUrl();
    const configuredSetPasswordUrl = getConfiguredSetPasswordUrl();

    const updateSessionState = (hasSession: boolean, message?: string | null) => {
      if (!isMounted) return;
      setSessionReady(hasSession);
      setErrorMessage(hasSession ? null : message ?? null);
      setChecking(false);
    };

    const clearAuthParamsFromUrl = () => {
      const url = new URL(window.location.href);
      const authSearchKeys = [
        'code',
        'token_hash',
        'type',
        'error',
        'error_code',
        'error_description',
      ];
      const authHashKeys = [
        'access_token',
        'refresh_token',
        'expires_at',
        'expires_in',
        'token_type',
        'provider_token',
        'provider_refresh_token',
        'type',
        'error',
        'error_code',
        'error_description',
      ];

      authSearchKeys.forEach((key) => url.searchParams.delete(key));

      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      authHashKeys.forEach((key) => hashParams.delete(key));

      const nextSearch = url.searchParams.toString();
      const nextHash = hashParams.toString();
      const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash ? `#${nextHash}` : ''}`;

      window.history.replaceState({}, document.title, nextUrl);
    };

    const readAuthParam = (
      searchParams: URLSearchParams,
      hashParams: URLSearchParams,
      key: string,
    ) => searchParams.get(key) ?? hashParams.get(key);

    const formatUrlError = (value: string | null) => {
      if (!value) return null;
      try {
        return decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        return value;
      }
    };

    const redactSensitiveParams = (params: URLSearchParams) => {
      const redacted = new URLSearchParams();
      const sensitiveKeys = new Set([
        'code',
        'token_hash',
        'access_token',
        'refresh_token',
        'provider_token',
        'provider_refresh_token',
      ]);

      params.forEach((value, key) => {
        redacted.set(key, sensitiveKeys.has(key) ? '[redacted]' : value);
      });

      return redacted.toString();
    };

    const restoreInviteSession = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

        console.info('SetPassword auth callback', {
          currentHost: window.location.host,
          currentPath: window.location.pathname,
          configuredPublicAppUrl,
          configuredSetPasswordUrl,
          searchParams: redactSensitiveParams(searchParams),
          hashParams: redactSensitiveParams(hashParams),
        });

        const code = readAuthParam(searchParams, hashParams, 'code');
        const tokenHash = readAuthParam(searchParams, hashParams, 'token_hash');
        const rawType = readAuthParam(searchParams, hashParams, 'type');
        const otpType = rawType && ['invite', 'recovery', 'magiclink', 'signup', 'email_change'].includes(rawType)
          ? (rawType as EmailOtpType)
          : null;
        const inviteEmail = readAuthParam(searchParams, hashParams, 'email');
        const exporterId = readAuthParam(searchParams, hashParams, 'exporter_id');
        const accessToken = readAuthParam(searchParams, hashParams, 'access_token');
        const refreshToken = readAuthParam(searchParams, hashParams, 'refresh_token');
        const authError = formatUrlError(readAuthParam(searchParams, hashParams, 'error_description'));

        if (inviteEmail) {
          setResendEmail(inviteEmail);
        }

        if (exporterId) {
          setResendExporterId(exporterId);
        }

        if (isDisallowedAuthCallbackHost(window.location.hostname)) {
          updateSessionState(
            false,
            configuredSetPasswordUrl
              ? `This invite link opened on a preview domain. Please open a fresh invite on ${configuredSetPasswordUrl}.`
              : 'This invite link opened on a preview domain. Please contact your administrator to configure a stable public app URL and send a fresh invite.',
          );
          return;
        }

        if (authError) {
          updateSessionState(false, authError);
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          clearAuthParamsFromUrl();
        }

        if (tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (error) throw error;
          clearAuthParamsFromUrl();
        }

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          clearAuthParamsFromUrl();
          if (data.session) {
            updateSessionState(true);
            return;
          }
        }

        for (let attempt = 0; attempt < 12; attempt += 1) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            updateSessionState(true);
            return;
          }

          if (attempt < 11) {
            await new Promise((resolve) => window.setTimeout(resolve, 250));
          }
        }

        updateSessionState(false, 'Invalid or expired invite link. Please contact your administrator.');
      } catch (error) {
        console.error('Failed to restore invite session', error);
        updateSessionState(
          false,
          error instanceof Error
            ? error.message
            : 'Invalid or expired invite link. Please contact your administrator.',
        );
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'PASSWORD_RECOVERY', 'USER_UPDATED'].includes(event) &&
        session
      ) {
        updateSessionState(true);
      }
    });

    void restoreInviteSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleResendInvite = async () => {
    const email = resendEmail.trim();
    if (!email) {
      toast({ title: 'Email required', description: 'Enter your invite email to receive a fresh setup link.', variant: 'destructive' });
      return;
    }

    if (!resendExporterId) {
      toast({ title: 'Invite unavailable', description: 'This link is missing exporter details. Please contact your administrator.', variant: 'destructive' });
      return;
    }

    setResendingInvite(true);
    const { data, error } = await supabase.functions.invoke('invite-exporter', {
      body: {
        email,
        exporter_id: resendExporterId,
      },
    });
    setResendingInvite(false);

    if (error || data?.error) {
      toast({ title: 'Unable to resend invite', description: error?.message ?? data?.error ?? 'Please contact your administrator.', variant: 'destructive' });
      return;
    }

    toast({
      title: 'New invite sent',
      description: 'A fresh invitation email is on the way. Open it directly in your browser.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Password too short', description: 'Must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Update onboarding status to password_set
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('exporters')
          .update({ onboarding_status: 'password_set' as any, invite_accepted_at: new Date().toISOString() } as any)
          .eq('exporter_user_id', user.id);
      }
      
      setDone(true);
      toast({ title: 'Password set', description: 'Redirecting to onboarding…' });
      setTimeout(() => navigate('/exporter/onboarding'), 2000);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="mb-4 h-12 w-12 text-success" />
            <h2 className="text-xl font-bold text-foreground">Account Activated</h2>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting to onboarding…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Set Your Password</h1>
          <p className="text-sm text-muted-foreground">
            {sessionReady
              ? 'Choose a secure password to activate your exporter account.'
              : errorMessage || 'Invalid or expired invite link. Please contact your administrator.'}
          </p>
        </div>

        {sessionReady && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Create Password</CardTitle>
              <CardDescription>Minimum 8 characters</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Setting Password…' : 'Activate Account'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!sessionReady && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Need a fresh invite?</CardTitle>
              <CardDescription>
                Invite links are single-use. If your mail app or a security scanner opened it first, request a new one below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resend-email">Invite Email</Label>
                <Input
                  id="resend-email"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="exporter@company.ng"
                  autoComplete="email"
                />
              </div>
              <Button type="button" className="w-full" onClick={handleResendInvite} disabled={resendingInvite || !resendEmail.trim() || !resendExporterId}>
                {resendingInvite ? 'Sending…' : 'Send a new invite'}
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Trade Finance Platform
        </p>
      </div>
    </div>
  );
}
