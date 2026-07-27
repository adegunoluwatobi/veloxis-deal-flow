import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ROLE_LABEL } from '@/v2/roles';

export default function Account() {
  const { user, profile, roles, refresh } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() || null, phone: phone.trim() || null })
      .eq('user_id', user.id);
    setSavingProfile(false);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    await refresh();
    toast({ title: 'Profile updated' });
  };

  const savePassword = async () => {
    if (!user?.email) return;
    if (newPw.length < 8) return toast({ title: 'Password too short', description: 'Minimum 8 characters.', variant: 'destructive' });
    if (newPw !== confirmPw) return toast({ title: 'Passwords do not match', variant: 'destructive' });

    setSavingPw(true);
    // Re-authenticate to prove current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw });
    if (signInErr) {
      setSavingPw(false);
      return toast({ title: 'Current password incorrect', variant: 'destructive' });
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) return toast({ title: 'Password update failed', description: error.message, variant: 'destructive' });
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    toast({ title: 'Password updated' });
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl">Account</h1>
        <p className="text-sm text-muted-foreground">Manage your personal details and password.</p>
      </div>

      <section className="card-elevated p-6 space-y-4">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Roles</Label>
            <Input value={roles.map((r) => ROLE_LABEL[r]).join(', ') || '—'} disabled />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div><Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</Button></div>
      </section>

      <section className="card-elevated p-6 space-y-4">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Change password</h2>
        <div className="grid grid-cols-1 gap-4 max-w-sm">
          <div className="space-y-1">
            <Label className="text-xs">Current password</Label>
            <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">New password</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confirm new password</Label>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <div>
          <Button onClick={savePassword} disabled={savingPw || !currentPw || !newPw}>
            {savingPw ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </section>
    </div>
  );
}
