import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';

type E = { id: string; company_name: string; rc_number: string | null; commodity: string | null; onboarding_status: string; email: string | null; created_at: string };

export default function StaffExporters() {
  const [rows, setRows] = useState<E[]>([]);
  const { roles } = useAuth();
  const navigate = useNavigate();
  const canCreate = roles.includes('originator') || roles.includes('super_admin');
  const canActivate = roles.includes('originator') || roles.includes('super_admin') || roles.includes('credit_officer');

  const load = async () => {
    const { data } = await supabase.from('v2_exporters').select('*').order('created_at', { ascending: false });
    setRows((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, s: string) => {
    await supabase.from('v2_exporters').update({ onboarding_status: s as any }).eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl">Exporters</h1><p className="text-sm text-muted-foreground">{rows.length} total</p></div>
        <div className="flex items-center gap-2">
        {canCreate && <InviteExporterDialog />}
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>Add exporter</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New exporter</DialogTitle></DialogHeader>
              <NewExporterForm onDone={() => { setOpen(false); load(); }} />
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">RC</th>
              <th className="text-left px-4 py-3">Commodity</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => navigate(`/app/exporters/${r.id}`)}
                className="border-t border-border hover:bg-muted/20 cursor-pointer"
              >
                <td className="px-4 py-3 text-accent">{r.company_name}</td>
                <td className="px-4 py-3">{r.rc_number ?? '—'}</td>
                <td className="px-4 py-3">{r.commodity ?? '—'}</td>
                <td className="px-4 py-3">{r.email ?? '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${r.onboarding_status === 'active' ? 'bg-success/20 text-success' : r.onboarding_status === 'suspended' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>{r.onboarding_status}</span></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  {canActivate && r.onboarding_status !== 'active' && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'active')}>Activate</Button>}
                  {canActivate && r.onboarding_status === 'active' && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'suspended')}>Suspend</Button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No exporters yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewExporterForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ company_name: '', rc_number: '', contact_name: '', email: '', phone: '', commodity: '', address: '', nepc_status: 'none' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.from('v2_exporters').insert({ ...f, nepc_status: f.nepc_status as any, onboarding_status: 'pending' } as any);
    setBusy(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Exporter added' }); onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company *"><Input required value={f.company_name} onChange={(e) => set('company_name', e.target.value)} /></Field>
        <Field label="RC number"><Input value={f.rc_number} onChange={(e) => set('rc_number', e.target.value)} /></Field>
        <Field label="Contact name"><Input value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Commodity"><Input value={f.commodity} onChange={(e) => set('commodity', e.target.value)} /></Field>
        <Field label="NEPC status">
          <Select value={f.nepc_status} onValueChange={(v) => set('nepc_status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{['valid', 'expired', 'none'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Address"><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
      </div>
      <Button type="submit" disabled={busy}>Create</Button>
    </form>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
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
    if (error) return toast({ title: 'Invite failed', description: error.message, variant: 'destructive' });
    setLink((data as any)?.action_link ?? null);
    toast({ title: 'Magic link sent', description: `${email.trim()} has been invited.` });
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
              <div className="text-muted-foreground">Magic link (also emailed):</div>
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
