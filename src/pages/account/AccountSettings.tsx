import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/types';
import { User as UserIcon, Mail, KeyRound, Loader2, ShieldCheck } from 'lucide-react';

const TEAL = '#0BA4A4';

function PasswordRequirements({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains a number', ok: /\d/.test(password) },
    { label: 'Contains a special character', ok: /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]~`]/.test(password) },
  ];
  return (
    <ul className="text-xs space-y-0.5 mt-1">
      {checks.map((c) => (
        <li key={c.label} className={c.ok ? 'text-success' : 'text-muted-foreground'}>
          {c.ok ? '✓' : '○'} {c.label}
        </li>
      ))}
    </ul>
  );
}

export function isPasswordStrong(p: string) {
  return p.length >= 8 && /\d/.test(p) && /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]~`]/.test(p);
}

export default function AccountSettings() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['account_profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from('users')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', user.id);
    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('✓ Profile updated successfully.');
    queryClient.invalidateQueries({ queryKey: ['account_profile', user.id] });
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Enter a new email address');
      return;
    }
    if (newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      toast.error('Email addresses do not match');
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`A verification link has been sent to ${newEmail.trim()}. Your email will update once verified.`);
    setNewEmail('');
    setConfirmEmail('');
  };

  const handleUpdatePassword = async () => {
    setPwError(null);
    if (!currentPassword) {
      setPwError('Enter your current password');
      return;
    }
    if (!isPasswordStrong(newPassword)) {
      setPwError('New password does not meet the requirements');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    // Re-authenticate via signInWithPassword to verify current password
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });
    if (reauthErr) {
      setSavingPassword(false);
      setPwError('Current password is incorrect');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast.success('✓ Password updated successfully.');
  };

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Helmet><title>Account Settings · Veloxis</title></Helmet>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, email and password.</p>
      </div>

      {/* 1.1 Profile Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5" /> Profile Details</CardTitle>
          <CardDescription>Update your display name and contact phone number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Display name</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 ..." />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ''} disabled />
              <p className="text-xs text-muted-foreground">To change your email, use the section below.</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div>
                <Badge variant="secondary" className="capitalize">{role ? ROLE_LABELS[role] : '—'}</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Member since</Label>
              <p className="text-sm">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</p>
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            style={{ backgroundColor: TEAL, color: '#fff' }}
            className="hover:opacity-90"
          >
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* 1.2 Change Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Change Email Address</CardTitle>
          <CardDescription>You'll receive a verification link at your new address. Your current email stays active until verified.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new_email">New email address</Label>
              <Input id="new_email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_email">Confirm new email</Label>
              <Input id="confirm_email" type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={handleUpdateEmail}
            disabled={savingEmail || !newEmail || !confirmEmail}
            style={{ backgroundColor: TEAL, color: '#fff' }}
            className="hover:opacity-90"
          >
            {savingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Email
          </Button>
        </CardContent>
      </Card>

      {/* 1.3 Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Change Password</CardTitle>
          <CardDescription>Use a strong, unique password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_password">Current password</Label>
            <Input id="current_password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_password">New password</Label>
            <Input id="new_password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <PasswordRequirements password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm new password</Label>
            <Input id="confirm_password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {pwError && <p className="text-sm text-destructive">{pwError}</p>}
          <Button
            onClick={handleUpdatePassword}
            disabled={savingPassword}
            style={{ backgroundColor: TEAL, color: '#fff' }}
            className="hover:opacity-90"
          >
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Password
          </Button>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> All sessions remain active after password change.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
