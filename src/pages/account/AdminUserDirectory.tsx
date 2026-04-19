import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { Loader2, Search, KeyRound, ShieldOff, ShieldCheck, Users } from 'lucide-react';
import type { AppRole } from '@/types';
import { ROLE_LABELS } from '@/types';

const TEAL = '#0BA4A4';
const ALL_ROLES: AppRole[] = ['super_admin', 'deal_manager', 'partner_admin', 'partner_staff', 'exporter'];

export default function AdminUserDirectory() {
  const { user: currentUser } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['admin_user_directory'],
    queryFn: async () => {
      const [{ data: users }, { data: roles }, { data: orgs }] = await Promise.all([
        supabase.from('users').select('id, email, full_name, organisation, is_active, created_at'),
        supabase.from('user_roles').select('user_id, role, partner_organisation_id'),
        supabase.from('partner_organisations').select('id, name'),
      ]);
      return (users ?? []).map((u) => {
        const r = roles?.find((x) => x.user_id === u.id);
        const orgName = r?.partner_organisation_id ? orgs?.find((o) => o.id === r.partner_organisation_id)?.name : null;
        return { ...u, role: r?.role as AppRole | undefined, organisation_name: orgName ?? u.organisation };
      });
    },
  });

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r: any) => {
      if (roleFilter !== 'all' && r.role !== roleFilter) return false;
      if (statusFilter === 'active' && r.is_active === false) return false;
      if (statusFilter === 'suspended' && r.is_active !== false) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${r.email ?? ''} ${r.full_name ?? ''} ${r.organisation_name ?? ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, roleFilter, statusFilter]);

  const selectedUser = useMemo(() => (rows ?? []).find((r: any) => r.id === selectedUserId), [rows, selectedUserId]);

  return (
    <div className="space-y-6">
      <Helmet><title>User Management · Veloxis</title></Helmet>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> User Management</h1>
        <p className="text-sm text-muted-foreground">All platform users. Click a row to manage.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, email, organisation…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedUserId(r.id)}>
                    <TableCell className="font-medium">{r.full_name ?? '—'}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.role ? <Badge variant="secondary">{ROLE_LABELS[r.role as AppRole]}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell>{r.organisation_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_active === false ? 'destructive' : 'default'}>
                        {r.is_active === false ? 'Suspended' : 'Active'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users match your filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UserDetailSheet
        user={selectedUser}
        currentUserId={currentUser?.id}
        onClose={() => setSelectedUserId(null)}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['admin_user_directory'] })}
        confirm={confirm}
      />
    </div>
  );
}

function UserDetailSheet({ user, currentUserId, onClose, onChanged, confirm }: any) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [newRole, setNewRole] = useState<AppRole | ''>('');
  const [saving, setSaving] = useState(false);

  // Reset state when user changes
  useState(() => {
    if (user) {
      setFullName(user.full_name ?? '');
      setPhone(user.phone ?? '');
      setNewRole(user.role ?? '');
    }
  });

  const open = !!user;
  // Sync when user changes (Sheet remount via key)
  if (user && fullName === '' && (user.full_name ?? '') !== '') setFullName(user.full_name ?? '');

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-user-mgmt', {
      body: { action: 'update_profile', user_id: user.id, full_name: fullName, phone },
    });
    if (!error && !(data as any)?.error && newRole && newRole !== user.role) {
      // Role change via existing change-user-role function
      await supabase.functions.invoke('change-user-role', {
        body: { user_id: user.id, new_role: newRole },
      });
    }
    setSaving(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message); return; }
    toast.success('✓ User updated.');
    onChanged();
    onClose();
  };

  const handleForceReset = async () => {
    const ok = await confirm({
      title: 'Force password reset',
      description: `Send a password reset email to ${user.email}? They will be required to set a new password.`,
      confirmText: 'Send Reset Email',
    });
    if (!ok) return;
    const { data, error } = await supabase.functions.invoke('admin-user-mgmt', {
      body: { action: 'force_password_reset', user_id: user.id },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message); return; }
    toast.success(`✓ Password reset email sent to ${user.email}.`);
  };

  const handleSuspend = async () => {
    const ok = await confirm({
      title: 'Suspend account',
      description: `Suspend ${user.full_name || user.email}'s account? They will immediately lose access to the platform.`,
      confirmText: 'Suspend',
      variant: 'destructive',
    });
    if (!ok) return;
    const { data, error } = await supabase.functions.invoke('admin-user-mgmt', {
      body: { action: 'suspend', user_id: user.id },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message); return; }
    toast.success('User suspended');
    onChanged();
    onClose();
  };

  const handleReactivate = async () => {
    const ok = await confirm({
      title: 'Reactivate account',
      description: `Restore access for ${user.full_name || user.email}?`,
      confirmText: 'Reactivate',
    });
    if (!ok) return;
    const { data, error } = await supabase.functions.invoke('admin-user-mgmt', {
      body: { action: 'reactivate', user_id: user.id },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message); return; }
    toast.success('User reactivated');
    onChanged();
    onClose();
  };

  if (!user) return null;
  const isSelf = user.id === currentUserId;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} key={user.id}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{user.full_name ?? user.email}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input defaultValue={user.full_name ?? ''} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input defaultValue={user.phone ?? ''} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email (read-only)</Label>
            <Input value={user.email} disabled />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select defaultValue={user.role ?? ''} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} style={{ backgroundColor: TEAL, color: '#fff' }} className="w-full hover:opacity-90">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
          </Button>

          <div className="border-t pt-5 space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={handleForceReset}>
              <KeyRound className="h-4 w-4 mr-2" /> Force Password Reset
            </Button>
            {!isSelf && (
              user.is_active === false ? (
                <Button variant="outline" className="w-full justify-start" onClick={handleReactivate}>
                  <ShieldCheck className="h-4 w-4 mr-2 text-success" /> Reactivate Account
                </Button>
              ) : (
                <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleSuspend}>
                  <ShieldOff className="h-4 w-4 mr-2" /> Suspend Account
                </Button>
              )
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
