import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

export default function SetPasswordFirst() {
  const { user, refresh, signOut } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast({ title: 'Password too short', description: 'Minimum 8 characters.', variant: 'destructive' });
    if (pw !== confirm) return toast({ title: 'Passwords do not match', variant: 'destructive' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setBusy(false); return toast({ title: 'Could not set password', description: error.message, variant: 'destructive' }); }
    if (user) await supabase.from('profiles').update({ password_set_at: new Date().toISOString() }).eq('user_id', user.id);
    await refresh();
    setBusy(false);
    toast({ title: 'Password set', description: 'You can now sign in with your email and password.' });
    nav('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="wordmark text-accent text-lg">VELOXIS</div>
          <p className="mt-2 text-sm text-muted-foreground">Set a password to finish setting up your account</p>
          {user?.email && <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>}
        </div>
        <form onSubmit={submit} className="space-y-4 card-elevated p-6">
          <div className="space-y-1.5">
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Set password & continue'}</Button>
          <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={async () => { await signOut(); nav('/login', { replace: true }); }}>Sign out</button>
        </form>
      </div>
    </div>
  );
}
