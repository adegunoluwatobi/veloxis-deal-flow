import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/components/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Settings, Users, Plus, Shield, Loader2 } from 'lucide-react';
import type { AppRole } from '@/types';

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'originator_admin', label: 'Originator Admin' },
  { value: 'originator_staff', label: 'Originator Staff' },
  { value: 'deal_manager', label: 'Deal Manager' },
  { value: 'exporter', label: 'Exporter' },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-destructive/10 text-destructive',
  originator_admin: 'bg-success/10 text-success',
  originator_staff: 'bg-success/10 text-success',
  deal_manager: 'bg-primary/10 text-primary',
  exporter: 'bg-muted text-muted-foreground',
};

export default function SettingsPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'deal_manager' as AppRole, full_name: '', organisation: '' });
  const [createLoading, setCreateLoading] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('email');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin_user_roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });

  const getRoleForUser = (userId: string) => {
    const r = userRoles?.find((ur) => ur.user_id === userId);
    return (r?.role as AppRole) ?? null;
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      toast({ title: 'Error', description: 'Email and password are required', variant: 'destructive' });
      return;
    }
    if (createForm.password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    const ok = await confirm({
      title: 'Create New User',
      description: `Create user ${createForm.email} with role "${createForm.role.replace('_', ' ')}"?`,
      variant: 'info',
    });
    if (!ok) return;
    setCreateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: createForm.email,
          password: createForm.password,
          role: createForm.role,
          full_name: createForm.full_name,
          organisation: createForm.organisation,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'User created', description: `${createForm.email} has been added.` });
      setCreateUserOpen(false);
      setCreateForm({ email: '', password: '', role: 'deal_manager', full_name: '', organisation: '' });
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      queryClient.invalidateQueries({ queryKey: ['admin_user_roles'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string, email: string) => {
    const ok = await confirm({
      title: 'Change User Role',
      description: `Change ${email}'s role to "${newRole.replace('_', ' ')}"?`,
      variant: 'warning',
    });
    if (!ok) return;
    try {
      const { data, error } = await supabase.functions.invoke('change-user-role', {
        body: { user_id: userId, new_role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Role updated' });
      queryClient.invalidateQueries({ queryKey: ['admin_user_roles'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change role';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  if (role !== 'deal_manager') {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Shield className="h-8 w-8 mr-3" /> Access restricted to Deal Managers only.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage platform users and role assignments</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Users & Roles
          </CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateUserOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Create User
          </Button>
        </CardHeader>
        <CardContent>
          {usersLoading || rolesLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Organisation</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Current Role</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((u) => {
                    const currentRole = getRoleForUser(u.id);
                    const isCurrentUser = u.id === user?.id;
                    return (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="py-3 px-3 font-medium text-foreground">{u.email}</td>
                        <td className="py-3 px-3 text-foreground">{u.full_name || '—'}</td>
                        <td className="py-3 px-3 text-muted-foreground">{u.organisation || '—'}</td>
                        <td className="py-3 px-3">
                          <Badge variant="secondary" className={`text-xs capitalize ${ROLE_COLORS[currentRole ?? ''] ?? ''}`}>
                            {currentRole?.replace('_', ' ') ?? 'No role'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Select
                            value={currentRole ?? ''}
                            onValueChange={(v) => handleRoleChange(u.id, v, u.email)}
                            disabled={isCurrentUser}
                          >
                            <SelectTrigger className="w-44 h-8 text-xs">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                  {(users ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Min 8 characters" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Organisation</Label>
              <Input value={createForm.organisation} onChange={(e) => setCreateForm({ ...createForm, organisation: e.target.value })} placeholder="Company name" />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v as AppRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateUser} disabled={createLoading || !createForm.email || !createForm.password} className="w-full gap-2">
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createLoading ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
