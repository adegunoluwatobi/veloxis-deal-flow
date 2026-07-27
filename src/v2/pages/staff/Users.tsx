import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import type { AppRole } from '@/v2/roles';
import { ROLE_LABEL } from '@/v2/roles';

type Row = { user_id: string; email: string; name: string | null; active: boolean; roles: AppRole[] };

export default function StaffUsers() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const [{ data: profs }, { data: allRoles }] = await Promise.all([
      supabase.from('profiles').select('*').order('joined_at', { ascending: false }),
      supabase.from('app_user_roles').select('user_id, role'),
    ]);
    const byUser = new Map<string, AppRole[]>();
    (allRoles ?? []).forEach((r: any) => {
      const arr = byUser.get(r.user_id) ?? []; arr.push(r.role); byUser.set(r.user_id, arr);
    });
    setRows((profs ?? []).map((p: any) => ({ user_id: p.user_id, email: p.email, name: p.name, active: p.active, roles: byUser.get(p.user_id) ?? [] })));
  };
  useEffect(() => { load(); }, []);

  const addRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from('app_user_roles').insert({ user_id: userId, role });
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    load();
  };
  const removeRole = async (userId: string, role: AppRole) => {
    await supabase.from('app_user_roles').delete().eq('user_id', userId).eq('role', role);
    load();
  };
  const setActive = async (userId: string, active: boolean) => {
    await supabase.from('profiles').update({ active }).eq('user_id', userId);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Users</h1>
        <p className="text-sm text-muted-foreground">Manage staff and exporter accounts. Create users via Sign-up (or invite) then assign roles here.</p>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-4 py-3">Name / Email</th><th className="text-left px-4 py-3">Roles</th><th className="text-left px-4 py-3">Active</th><th className="text-right px-4 py-3">Add role</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-t border-border align-top">
                <td className="px-4 py-3"><div>{r.name || '—'}</div><div className="text-xs text-muted-foreground">{r.email}</div></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.roles.map((role) => (
                      <button key={role} onClick={() => removeRole(r.user_id, role)} className="text-xs px-2 py-0.5 rounded bg-primary/20 text-accent hover:bg-destructive/20 hover:text-destructive" title="Click to remove">
                        {ROLE_LABEL[role]} ×
                      </button>
                    ))}
                    {r.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant={r.active ? 'outline' : 'destructive'} onClick={() => setActive(r.user_id, !r.active)}>{r.active ? 'Active' : 'Inactive'}</Button>
                </td>
                <td className="px-4 py-3 text-right">
                  <Select onValueChange={(v) => addRole(r.user_id, v as AppRole)}>
                    <SelectTrigger className="w-40 ml-auto"><SelectValue placeholder="+ role" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABEL) as AppRole[]).filter((x) => !r.roles.includes(x)).map((x) => (
                        <SelectItem key={x} value={x}>{ROLE_LABEL[x]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No users</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
