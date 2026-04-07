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
import { Settings, Users, Plus, Shield, Loader2, UserPlus } from 'lucide-react';

export default function GreystarSettings() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', organisation: '' });
  const [loading, setLoading] = useState(false);

  // Get current user's partner org
  const { data: myRole } = useQuery({
    queryKey: ['my_user_role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, partner_organisation_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const partnerOrgId = myRole?.partner_organisation_id;

  const { data: orgName } = useQuery({
    queryKey: ['partner_org_name', partnerOrgId],
    queryFn: async () => {
      if (!partnerOrgId) return null;
      const { data, error } = await supabase
        .from('partner_organisations')
        .select('name')
        .eq('id', partnerOrgId)
        .maybeSingle();
      if (error) throw error;
      return data?.name ?? null;
    },
    enabled: !!partnerOrgId,
  });

  // Get users in this org
  const { data: orgUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['partner_org_users', partnerOrgId],
    queryFn: async () => {
      if (!partnerOrgId) return [];
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('partner_organisation_id', partnerOrgId);
      if (rolesErr) throw rolesErr;
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds)
        .order('email');
      if (usersErr) throw usersErr;

      return (usersData ?? []).map(u => ({
        ...u,
        role: roles.find(r => r.user_id === u.id)?.role ?? 'unknown',
      }));
    },
    enabled: !!partnerOrgId,
  });

  const resetForm = () => {
    setForm({ email: '', password: '', full_name: '', organisation: '' });
  };

  const handleCreate = async () => {
    if (!form.email.trim()) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }
    if (!form.full_name.trim()) {
      toast({ title: 'Error', description: 'Full name is required', variant: 'destructive' });
      return;
    }
    if (!form.password || form.password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    const ok = await confirm({
      title: 'Create Partner Staff',
      description: `Create ${form.email} as partner staff for ${orgName ?? 'your organisation'}?`,
      variant: 'info',
    });
    if (!ok) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email.trim(),
          password: form.password,
          role: 'partner_staff',
          full_name: form.full_name.trim(),
          organisation: orgName ?? '',
          partner_organisation_id: partnerOrgId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Staff created', description: `${form.email} has been added.` });
      setCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['partner_org_users'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'partner_admin') {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Shield className="h-8 w-8 mr-3" /> Access restricted to Partner Admins only.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-[hsl(160,50%,35%)]" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
          <p className="text-sm text-muted-foreground">
            {orgName ? `Manage staff and exporters for ${orgName}` : "Manage your organisation's staff and exporters"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Organisation Staff
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Staff
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {(orgUsers ?? []).map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="py-3 px-3 font-medium text-foreground">{u.email}</td>
                      <td className="py-3 px-3 text-foreground">{u.full_name || '—'}</td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary" className="text-xs capitalize bg-success/10 text-success">
                          {(u.role as string).replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {(orgUsers ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted-foreground">No staff members found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Partner Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@example.com" />
            </div>

            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
            </div>

            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" />
            </div>

            <Button
              onClick={handleCreate}
              disabled={loading || !form.email.trim() || !form.full_name.trim() || !form.password || form.password.length < 8}
              className="w-full gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? 'Creating…' : 'Create Staff Member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
