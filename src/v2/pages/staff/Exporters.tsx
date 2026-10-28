import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';

type E = { id: string; company_name: string; rc_number: string | null; commodity: string | null; onboarding_status: string; email: string | null; created_at: string; onboarding_submitted_at: string | null; bd_approved_at: string | null; bd_rejected_at: string | null };

function stageOf(r: E) {
  if (r.onboarding_status === 'active') return { label: 'Active', action: 'View' };
  if (r.onboarding_status === 'suspended') return { label: 'Suspended', action: 'View' };
  if (r.bd_rejected_at && !r.bd_approved_at) return { label: 'Returned to exporter', action: 'View' };
  if (r.bd_approved_at) return { label: 'With Credit & Compliance', action: 'Final approval' };
  if (r.onboarding_submitted_at) return { label: 'Awaiting BD review', action: 'Review' };
  return { label: 'Onboarding in progress', action: 'View' };
}

type InviteInfo = { type: string; by: string };

export default function StaffExporters() {
  const [rows, setRows] = useState<E[]>([]);
  const [invites, setInvites] = useState<Record<string, InviteInfo>>({});
  const [q, setQ] = useState('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [inviteFilter, setInviteFilter] = useState<'all' | 'kyb' | 'platform' | 'none'>('all');
  const { roles } = useAuth();
  const navigate = useNavigate();
  const canCreate = roles.includes('originator') || roles.includes('super_admin');
  // Activation is driven by the Stage 1 review chain (Credit approval), not a
  // manual shortcut. Only suspend / reinstate remains as an admin control.
  const canSuspend = roles.includes('super_admin') || roles.includes('credit_officer');

  const load = async () => {
    const { data } = await supabase.from('v2_exporters').select('*').order('created_at', { ascending: false });
    const list = (data ?? []) as any[];
    setRows(list);
    const [{ data: kyb }, { data: reg }] = await Promise.all([
      supabase.from('kyb_invites').select('id, exporter_id, created_by'),
      supabase.from('registration_invites').select('email, invited_by'),
    ]);
    const actorIds = Array.from(new Set([...(kyb ?? []).map((k: any) => k.created_by), ...(reg ?? []).map((r: any) => r.invited_by)].filter(Boolean)));
    const { data: profs } = actorIds.length
      ? await supabase.from('profiles').select('user_id, name, email').in('user_id', actorIds)
      : { data: [] as any[] };
    const nameOf = (uid?: string | null) => { const p = (profs ?? []).find((x: any) => x.user_id === uid); return p?.name || p?.email || '—'; };
    const map: Record<string, InviteInfo> = {};
    for (const e of list) {
      const k = (kyb ?? []).find((x: any) => x.id === e.invite_id || x.exporter_id === e.id);
      if (k) { map[e.id] = { type: 'KYB Onboarding Invite', by: nameOf(k.created_by) }; continue; }
      const r = (reg ?? []).find((x: any) => e.email && x.email?.toLowerCase() === e.email.toLowerCase());
      if (r) map[e.id] = { type: 'Platform Invite', by: nameOf(r.invited_by) };
    }
    setInvites(map);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, s: string) => {
    await supabase.from('v2_exporters').update({ onboarding_status: s as any }).eq('id', id);
    load();
  };

  const term = q.trim().toLowerCase();
  const shown = rows.filter((r: any) => {
    if (term && !`${r.company_name ?? ''} ${r.rc_number ?? ''} ${r.company_registration_number ?? ''}`.toLowerCase().includes(term)) return false;
    if (accessFilter === 'yes' && r.banks_with_access !== true) return false;
    if (accessFilter === 'no' && r.banks_with_access !== false) return false;
    const it = invites[r.id]?.type;
    if (inviteFilter === 'kyb' && it !== 'KYB Onboarding Invite') return false;
    if (inviteFilter === 'platform' && it !== 'Platform Invite') return false;
    if (inviteFilter === 'none' && it) return false;
    return true;
  });
  const sel = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl">Exporters</h1><p className="text-sm text-muted-foreground">{shown.length} of {rows.length}</p></div>
        <div className="flex items-center gap-2">
        {canCreate && <InviteExporterDialog />}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search company name or RC number" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
        <select aria-label="Access Bank customer" className={sel} value={accessFilter} onChange={(e) => setAccessFilter(e.target.value as any)}>
          <option value="all">Access Bank: all</option><option value="yes">Access Bank: Yes</option><option value="no">Access Bank: No</option>
        </select>
        <select aria-label="Invite type" className={sel} value={inviteFilter} onChange={(e) => setInviteFilter(e.target.value as any)}>
          <option value="all">Invite: all</option><option value="kyb">KYB Onboarding Invite</option><option value="platform">Platform Invite</option><option value="none">No invite</option>
        </select>
      </div>
      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">RC</th>
              <th className="text-left px-4 py-3">Access Bank</th>
              <th className="text-left px-4 py-3">Invite</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r: any) => (
              <tr
                key={r.id}
                onClick={() => navigate(`/app/exporters/${r.id}`)}
                className="border-t border-border hover:bg-muted/20 cursor-pointer"
              >
                <td className="px-4 py-3 text-accent">{r.company_name}</td>
                <td className="px-4 py-3">{r.company_registration_number ?? r.rc_number ?? '—'}</td>
                <td className="px-4 py-3">{r.banks_with_access == null ? '—' : r.banks_with_access ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  {invites[r.id] ? <><div>{invites[r.id].type}</div><div className="text-xs text-muted-foreground">by {invites[r.id].by}</div></> : '—'}
                </td>
                <td className="px-4 py-3">{r.email ?? '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${r.onboarding_status === 'active' ? 'bg-success/20 text-success' : r.onboarding_status === 'suspended' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>{stageOf(r).label}</span></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {r.onboarding_status !== 'active' && r.onboarding_status !== 'suspended' && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/app/exporters/${r.id}`)}>{stageOf(r).action}</Button>
                  )}
                  {canSuspend && r.onboarding_status === 'active' && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'suspended')}>Suspend</Button>}
                  {canSuspend && r.onboarding_status === 'suspended' && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'active')}>Reinstate</Button>}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No exporters match</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function InviteExporterDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return toast({ title: 'Please enter a valid email address.', variant: 'destructive' });
    }
    setSending(true); setLink(null);
    const { data, error } = await supabase.functions.invoke('invite-magic-link', {
      body: { email: email.trim(), name: name.trim(), role: 'exporter' },
    });
    setSending(false);
    if (error) {
      let description = error.message;
      if ('context' in error && error.context instanceof Response) {
        const response = error.context.clone();
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        description = payload?.error ?? description;
      }
      return toast({ title: 'Invite failed', description, variant: 'destructive' });
    }
    setLink((data as any)?.action_link ?? null);
    toast({ title: 'Magic link created', description: `Copy the link below and send it to ${email.trim()}.` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEmail(''); setName(''); setLink(null); } }}>
      <DialogTrigger asChild><Button variant="outline">Invite exporter</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite exporter by magic link</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exporter@company.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <p className="text-xs text-muted-foreground">The invitee is assigned the Exporter role, sets a password, then completes KYB/KYC onboarding.</p>
          {link && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
              <div className="text-muted-foreground">Magic link — send this to the exporter (email delivery is not active yet):</div>
              <div className="break-all font-mono">{link}</div>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(link)}>Copy</Button>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={send} disabled={sending}>{sending ? 'Sending…' : 'Send invite'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
