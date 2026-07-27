import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { AppRole } from '@/v2/roles';
import { ROLE_LABEL } from '@/v2/roles';
import { Copy, Send, Check, Clock } from 'lucide-react';

type Row = {
  user_id: string; email: string; name: string | null; active: boolean; roles: AppRole[];
  invited_at: string | null; first_signed_in_at: string | null; password_set_at: string | null; last_login: string | null;
};

export default function StaffUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AppRole | ''>('');
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const load = async () => {
    const [{ data: profs }, { data: allRoles }] = await Promise.all([
      supabase.from('profiles').select('*').order('joined_at', { ascending: false }),
      supabase.from('app_user_roles').select('user_id, role'),
    ]);
    const byUser = new Map<string, AppRole[]>();
    (allRoles ?? []).forEach((r: any) => {
      const arr = byUser.get(r.user_id) ?? []; arr.push(r.role); byUser.set(r.user_id, arr);
    });
    setRows((profs ?? []).map((p: any) => ({
      user_id: p.user_id, email: p.email, name: p.name, active: p.active,
      roles: byUser.get(p.user_id) ?? [],
      invited_at: p.invited_at, first_signed_in_at: p.first_signed_in_at,
      password_set_at: p.password_set_at, last_login: p.last_login,
    })));
  };
  useEffect(() => { load(); }, []);

  const addRole = async (userId: string, role: AppRole, currentRoles: AppRole[]) => {
    // Enforce mutual exclusivity: exporter cannot mix with staff
    if (role === 'exporter' && currentRoles.length > 0) {
      return toast({ title: 'Exporter role is exclusive', description: 'Remove other roles first.', variant: 'destructive' });
    }
    if (role !== 'exporter' && currentRoles.includes('exporter')) {
      return toast({ title: 'Cannot add staff role to exporter', description: 'Remove the Exporter role first.', variant: 'destructive' });
    }
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

  const sendInvite = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast({ title: 'Enter a valid email', variant: 'destructive' });
    }
    setSending(true); setLastLink(null);
    const { data, error } = await supabase.functions.invoke('invite-magic-link', {
      body: { email: email.trim(), name: name.trim(), role: role || undefined },
    });
    setSending(false);
    if (error) return toast({ title: 'Invite failed', description: error.message, variant: 'destructive' });
    setLastLink((data as any)?.action_link ?? null);
    toast({ title: 'Magic link sent', description: `${email} has been invited.` });
    load();
  };

  const resendMagic = async (row: Row) => {
    const { data, error } = await supabase.functions.invoke('invite-magic-link', {
      body: { email: row.email, name: row.name ?? '' },
    });
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    const link = (data as any)?.action_link;
    if (link) {
      await navigator.clipboard.writeText(link).catch(() => {});
      toast({ title: 'Magic link ready', description: 'Link copied to clipboard.' });
    } else {
      toast({ title: 'Magic link sent' });
    }
    load();
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Users</h1>
          <p className="text-sm text-muted-foreground">Invite users by magic link and manage roles. Staff users may hold multiple roles; the Exporter role is exclusive.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEmail(''); setName(''); setRole(''); setLastLink(null); } }}>
          <DialogTrigger asChild><Button><Send className="h-4 w-4 mr-2" />Invite via magic link</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite user</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assign role (optional)</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger><SelectValue placeholder="No role — add later" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {lastLink && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
                  <div className="text-muted-foreground">Magic link (also emailed):</div>
                  <div className="break-all font-mono">{lastLink}</div>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(lastLink)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
              <Button onClick={sendInvite} disabled={sending}>{sending ? 'Sending…' : 'Send invite'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name / Email</th>
              <th className="text-left px-4 py-3">Roles</th>
              <th className="text-left px-4 py-3">Onboarding</th>
              <th className="text-left px-4 py-3">Active</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isExporter = r.roles.includes('exporter');
              const availableRoles = (Object.keys(ROLE_LABEL) as AppRole[]).filter((x) => {
                if (r.roles.includes(x)) return false;
                if (x === 'exporter' && r.roles.length > 0) return false;
                if (x !== 'exporter' && isExporter) return false;
                return true;
              });
              return (
                <tr key={r.user_id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div>{r.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.roles.map((role) => (
                        <button key={role} onClick={() => removeRole(r.user_id, role)}
                          className="text-xs px-2 py-0.5 rounded bg-primary/20 text-accent hover:bg-destructive/20 hover:text-destructive"
                          title="Click to remove">{ROLE_LABEL[role]} ×</button>
                      ))}
                      {r.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs space-y-1">
                    <StatusLine ok={!!r.invited_at} label="Invited" ts={r.invited_at} />
                    <StatusLine ok={!!r.first_signed_in_at} label="Signed in" ts={r.first_signed_in_at} />
                    <StatusLine ok={!!r.password_set_at} label="Password set" ts={r.password_set_at} />
                    {r.last_login && <div className="text-muted-foreground pt-0.5">Last: {fmt(r.last_login)}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant={r.active ? 'outline' : 'destructive'} onClick={() => setActive(r.user_id, !r.active)}>
                      {r.active ? 'Active' : 'Inactive'}
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {availableRoles.length > 0 && (
                        <Select onValueChange={(v) => addRole(r.user_id, v as AppRole, r.roles)}>
                          <SelectTrigger className="w-40"><SelectValue placeholder="+ add role" /></SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((x) => (
                              <SelectItem key={x} value={x}>{ROLE_LABEL[x]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button size="sm" variant="outline" onClick={() => resendMagic(r)}>
                        <Send className="h-3 w-3 mr-1" />Magic link
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No users</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusLine({ ok, label, ts }: { ok: boolean; label: string; ts: string | null }) {
  return (
    <div className={`flex items-center gap-1.5 ${ok ? 'text-success' : 'text-muted-foreground'}`}>
      {ok ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      <span>{label}</span>
      {ok && ts && <span className="text-muted-foreground">· {new Date(ts).toLocaleDateString()}</span>}
    </div>
  );
}
