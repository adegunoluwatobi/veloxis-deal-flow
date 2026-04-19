import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useConfirm } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { Loader2, UserPlus, Users, Trash2 } from 'lucide-react';

const TEAL = '#0BA4A4';

export default function PartnerTeamMembers() {
  const { user, role } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<'partner_admin' | 'partner_staff'>('partner_staff');
  const [inviting, setInviting] = useState(false);

  const { data: orgRoleRow } = useQuery({
    queryKey: ['user_role_org', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('user_roles').select('partner_organisation_id').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });
  const orgId = orgRoleRow?.partner_organisation_id ?? null;

  const { data: members, isLoading } = useQuery({
    queryKey: ['partner_team_members', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id, role, partner_organisation_id')
        .eq('partner_organisation_id', orgId);
      const userIds = (roleRows ?? []).map((r) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: users } = await supabase.from('users').select('id, email, full_name, created_at, is_active').in('id', userIds);
      return (roleRows ?? []).map((r) => {
        const u = users?.find((x) => x.id === r.user_id);
        return { ...r, ...u };
      });
    },
    enabled: !!orgId,
  });

  const isPartnerAdmin = role === 'partner_admin';

  const handleInvite = async () => {
    if (!isPartnerAdmin) return;
    if (!email.trim() || !fullName.trim()) { toast.error('Name and email are required'); return; }
    setInviting(true);
    const { data, error } = await supabase.functions.invoke('invite-partner-member', {
      body: { email: email.trim(), full_name: fullName.trim(), role: inviteRole },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? 'Failed to send invite');
      return;
    }
    toast.success(`Invitation sent to ${email}`);
    setEmail(''); setFullName(''); setInviteRole('partner_staff');
    queryClient.invalidateQueries({ queryKey: ['partner_team_members', orgId] });
  };

  const handleRemove = async (member: any) => {
    if (!isPartnerAdmin) return;
    const ok = await confirm({
      title: 'Remove team member',
      description: `Remove ${member.full_name || member.email} from your team? They will immediately lose access to the partner shell.`,
      confirmText: 'Remove',
      variant: 'destructive',
    });
    if (!ok) return;
    const { data, error } = await supabase.functions.invoke('admin-user-mgmt', {
      body: { action: 'remove_team_member', user_id: member.user_id },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? 'Failed to remove');
      return;
    }
    toast.success('Member removed');
    queryClient.invalidateQueries({ queryKey: ['partner_team_members', orgId] });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Helmet><title>Team Members · Veloxis</title></Helmet>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Team Members</h1>
        <p className="text-sm text-muted-foreground">Manage who can access your partner shell.</p>
      </div>

      {isPartnerAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invite a New Member</CardTitle>
            <CardDescription>They'll receive an email to set their password and join your team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="invite_name">Full name</Label>
                <Input id="invite_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite_email">Email address</Label>
                <Input id="invite_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner_admin">Partner Admin</SelectItem>
                    <SelectItem value="partner_staff">Partner User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleInvite} disabled={inviting} style={{ backgroundColor: TEAL, color: '#fff' }} className="hover:opacity-90">
              {inviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Send Invite
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Current Team</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  {isPartnerAdmin && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members ?? []).map((m: any) => (
                  <TableRow key={m.user_id}>
                    <TableCell className="font-medium">{m.full_name ?? '—'}{m.user_id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell><Badge variant="secondary">{m.role === 'partner_admin' ? 'Partner Admin' : 'Partner User'}</Badge></TableCell>
                    <TableCell>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={m.is_active === false ? 'destructive' : 'default'}>
                        {m.is_active === false ? 'Suspended' : 'Active'}
                      </Badge>
                    </TableCell>
                    {isPartnerAdmin && (
                      <TableCell>
                        {m.user_id !== user?.id && (
                          <Button size="sm" variant="ghost" onClick={() => handleRemove(m)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(members ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={isPartnerAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">No team members yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
