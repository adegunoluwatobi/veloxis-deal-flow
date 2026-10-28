import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Copy, Mail, MessageCircle, Plus, RotateCw, Ban } from 'lucide-react';
import { effectiveStatus, KYB_STATUS_LABEL } from '@/v2/lib/kybInvite';

type Row = {
  id: string; type: 'kyb' | 'platform'; company: string; contact: string; email: string;
  created_by: string | null; created_at: string; expires_at: string | null; status: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function fnError(error: any, data: any) {
  try { return (await error?.context?.json())?.error ?? data?.error ?? 'Request failed'; } catch { return data?.error ?? 'Request failed'; }
}

export default function Invites() {
  const { roles } = useAuth();
  const isSuper = roles.includes('super_admin');
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'kyb' | 'platform'>('all');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ id: string; link: string; email: string; contact: string; company: string; expires: string } | null>(null);
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', internal_note: '', expiry_days: '14' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: k } = await supabase.from('kyb_invites' as any).select('*').order('created_at', { ascending: false });
    const kyb: Row[] = ((k as any[]) ?? []).map((r) => ({
      id: r.id, type: 'kyb', company: r.company_name, contact: r.contact_name, email: r.contact_email,
      created_by: r.created_by, created_at: r.created_at, expires_at: r.expires_at, status: effectiveStatus(r.status, r.expires_at),
    }));
    let platform: Row[] = [];
    if (isSuper) {
      const { data: p } = await supabase.from('registration_invites').select('*').order('created_at', { ascending: false });
      platform = (p ?? []).map((r: any) => ({
        id: r.id, type: 'platform', company: '—', contact: r.full_name ?? '—', email: r.email,
        created_by: r.invited_by, created_at: r.created_at, expires_at: null, status: 'sent',
      }));
    }
    const all = [...kyb, ...platform].sort((a, b) => b.created_at.localeCompare(a.created_at));
    setRows(all);
    const ids = [...new Set(all.map((r) => r.created_by).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: pr } = await supabase.from('profiles').select('user_id, name, email').in('user_id', ids);
      setNames(Object.fromEntries((pr ?? []).map((x: any) => [x.user_id, x.name || x.email])));
    }
  };
  useEffect(() => { void load(); }, [isSuper]);

  const shown = useMemo(() => rows.filter((r) => filter === 'all' || r.type === filter), [rows, filter]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const n: Record<string, string> = {};
    if (!form.company_name.trim()) n.company_name = 'Company name is required.';
    if (!form.contact_name.trim()) n.contact_name = 'Contact name is required.';
    if (!EMAIL_RE.test(form.contact_email.trim())) n.contact_email = 'Enter a valid email address, like name@company.com.';
    setErrs(n);
    if (Object.keys(n).length) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('kyb-invite', { body: { action: 'create', ...form, expiry_days: Number(form.expiry_days) } });
    setBusy(false);
    if (error || !data?.success) { toast({ title: 'Could not create KYB Onboarding Invite', description: await fnError(error, data), variant: 'destructive' }); return; }
    setOpen(false);
    showResult(data);
    setForm({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', internal_note: '', expiry_days: '14' });
    void load();
  };

  const showResult = (data: any) => setResult({
    id: data.invite.id, link: data.link, email: data.invite.contact_email, contact: data.invite.contact_name,
    company: data.invite.company_name, expires: new Date(data.invite.expires_at).toLocaleDateString('en-GB'),
  });

  const act = async (row: Row, action: 'resend' | 'revoke') => {
    if (action === 'revoke' && !confirm(`Revoke the KYB Onboarding Invite for ${row.email}? The link will stop working.`)) return;
    const { data, error } = await supabase.functions.invoke('kyb-invite', { body: { action, id: row.id } });
    if (error || !data?.success) { toast({ title: 'Action failed', description: await fnError(error, data), variant: 'destructive' }); return; }
    if (action === 'resend') showResult(data);
    else toast({ title: 'KYB Onboarding Invite revoked' });
    void load();
  };

  const emailLink = async () => {
    if (!result) return;
    const token = result.link.split('/onboard/')[1];
    const { data, error } = await supabase.functions.invoke('kyb-invite', { body: { action: 'email', id: result.id, token } });
    if (error || !data?.success) toast({ title: 'Email not sent', description: await fnError(error, data), variant: 'destructive' });
    else toast({ title: 'Invitation emailed', description: result.email });
  };

  const whatsapp = () => {
    if (!result) return;
    const msg = `Hello ${result.contact}, Veloxis Global Limited has invited ${result.company} to complete KYB onboarding. Create your account here (expires ${result.expires}): ${result.link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const statusVariant = (s: string) => s === 'registered' ? 'default' : s === 'revoked' || s === 'expired' ? 'destructive' : 'secondary';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invites</h1>
          <p className="text-sm text-muted-foreground">KYB Onboarding Invites and Platform Invites.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="kyb">KYB Onboarding Invite</SelectItem>
              {isSuper && <SelectItem value="platform">Platform Invite</SelectItem>}
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> New KYB Onboarding Invite</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>{['Type', 'Company', 'Contact', 'Email', 'Created by', 'Created', 'Expires', 'Status', ''].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No invites yet.</td></tr>}
            {shown.map((r) => (
              <tr key={`${r.type}-${r.id}`} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{r.type === 'kyb' ? 'KYB Onboarding Invite' : 'Platform Invite'}</td>
                <td className="px-3 py-2">{r.company}</td>
                <td className="px-3 py-2">{r.contact}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{(r.created_by && names[r.created_by]) || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.expires_at ? new Date(r.expires_at).toLocaleDateString('en-GB') : '—'}</td>
                <td className="px-3 py-2"><Badge variant={statusVariant(r.status) as any}>{r.type === 'kyb' ? KYB_STATUS_LABEL[r.status as keyof typeof KYB_STATUS_LABEL] : 'Sent'}</Badge></td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  {r.type === 'kyb' && !['registered', 'revoked'].includes(r.status) && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => act(r, 'resend')}><RotateCw className="mr-1 h-3.5 w-3.5" />Resend</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act(r, 'revoke')}><Ban className="mr-1 h-3.5 w-3.5" />Revoke</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New KYB Onboarding Invite</DialogTitle>
            <DialogDescription>The email can't be edited later. If it's wrong, revoke and create a new invite.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-3" noValidate>
            {([['company_name', 'Company name *'], ['contact_name', 'Contact name *'], ['contact_email', 'Contact email *'], ['contact_phone', 'Contact phone (optional)']] as const).map(([k, l]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={k}>{l}</Label>
                <Input id={k} type={k === 'contact_email' ? 'email' : 'text'} value={form[k]} maxLength={255} aria-invalid={!!errs[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                {errs[k] && <p className="text-xs text-destructive">{errs[k]}</p>}
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor="note">Internal note (optional)</Label>
              <Textarea id="note" value={form.internal_note} maxLength={1000} onChange={(e) => setForm({ ...form, internal_note: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Expires after</Label>
              <Select value={form.expiry_days} onValueChange={(v) => setForm({ ...form, expiry_days: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['7', '14', '30'].map((d) => <SelectItem key={d} value={d}>{d} days</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create invite'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>KYB Onboarding Invite ready</DialogTitle>
            <DialogDescription>This link is shown only once. Share it with {result?.email} now.</DialogDescription>
          </DialogHeader>
          <Input readOnly value={result?.link ?? ''} onFocus={(e) => e.currentTarget.select()} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(result!.link); toast({ title: 'Link copied' }); }}><Copy className="mr-1 h-4 w-4" />Copy link</Button>
            <Button variant="outline" onClick={emailLink}><Mail className="mr-1 h-4 w-4" />Send by email</Button>
            <Button variant="outline" onClick={whatsapp}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
