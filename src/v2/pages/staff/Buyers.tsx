import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';

export default function StaffBuyers() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const { roles, user } = useAuth();
  const canVerify = roles.includes('credit_officer') || roles.includes('super_admin');

  const load = async () => {
    const { data } = await supabase.from('v2_buyers').select('*').order('created_at', { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const verify = async (id: string, field: 'credit_status' | 'sanctions_status', value: 'clear' | 'flagged') => {
    const patch: any = { [field]: value, verified_by: user?.id, verified_at: new Date().toISOString() };
    await supabase.from('v2_buyers').update(patch).eq('id', id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl">Buyers</h1><p className="text-sm text-muted-foreground">{rows.length} total</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Add buyer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New buyer</DialogTitle></DialogHeader>
            <NewBuyerForm onDone={() => { setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-4 py-3">Company</th><th className="text-left px-4 py-3">Country</th><th className="text-left px-4 py-3">Credit</th><th className="text-left px-4 py-3">Sanctions</th><th className="text-right px-4 py-3">Limit</th>{canVerify && <th className="text-right px-4 py-3">Verify</th>}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3"><Link to={`/app/buyers/${r.id}`} className="text-accent hover:underline">{r.company_name}</Link></td>
                <td className="px-4 py-3">{r.country ?? '—'}</td>
                <td className="px-4 py-3"><Pill s={r.credit_status} /></td>
                <td className="px-4 py-3"><Pill s={r.sanctions_status} /></td>
                <td className="px-4 py-3 text-right">{r.credit_limit ? `£${Number(r.credit_limit).toLocaleString()}` : '—'}</td>
                {canVerify && (
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => verify(r.id, 'credit_status', 'clear')}>Credit ✓</Button>
                    <Button size="sm" variant="ghost" onClick={() => verify(r.id, 'sanctions_status', 'clear')}>Sanc ✓</Button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No buyers</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ s }: { s: string }) {
  const map: Record<string, string> = { clear: 'bg-success/20 text-success', flagged: 'bg-destructive/20 text-destructive', pending: 'bg-muted text-muted-foreground' };
  return <span className={`text-xs px-2 py-0.5 rounded ${map[s] ?? ''}`}>{s}</span>;
}
function NewBuyerForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ company_name: '', country: '', companies_house_id: '', credit_limit: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.from('v2_buyers').insert({ company_name: f.company_name, country: f.country || null, companies_house_id: f.companies_house_id || null, credit_limit: f.credit_limit ? Number(f.credit_limit) : null });
    setBusy(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1"><Label className="text-xs">Company *</Label><Input required value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></div>
      <div className="space-y-1"><Label className="text-xs">Country</Label><Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></div>
      <div className="space-y-1"><Label className="text-xs">Companies House ID</Label><Input value={f.companies_house_id} onChange={(e) => setF({ ...f, companies_house_id: e.target.value })} /></div>
      <div className="space-y-1"><Label className="text-xs">Credit limit</Label><Input type="number" value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: e.target.value })} /></div>
      <Button type="submit" disabled={busy}>Create</Button>
    </form>
  );
}
