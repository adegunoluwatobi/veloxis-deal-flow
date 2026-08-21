import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

type Port = { unlocode: string; name: string; country_code: string; type: string; active: boolean };

export default function PortsTab() {
  const [rows, setRows] = useState<Port[]>([]);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({ unlocode: '', name: '', country_code: '', type: 'sea' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('ports').select('unlocode, name, country_code, type, active').order('country_code').order('name');
    setRows((data ?? []) as Port[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (unlocode: string, active: boolean) => {
    const { error } = await supabase.from('ports').update({ active }).eq('unlocode', unlocode);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    load();
  };

  const add = async () => {
    const unlocode = draft.unlocode.trim().toUpperCase();
    const country = draft.country_code.trim().toUpperCase();
    if (unlocode.length < 5 || !draft.name.trim() || country.length !== 2) {
      return toast({ title: 'Enter a UN/LOCODE, a name and a two letter country code', variant: 'destructive' });
    }
    const { error } = await supabase.from('ports').insert({
      unlocode, name: draft.name.trim(), country_code: country, type: draft.type,
    });
    if (error) return toast({ title: 'Could not add', description: error.message, variant: 'destructive' });
    setDraft({ unlocode: '', name: '', country_code: '', type: 'sea' });
    load();
  };

  const filtered = rows.filter((r) =>
    !q || `${r.name} ${r.unlocode} ${r.country_code}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder="Search ports" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <Input placeholder="UN/LOCODE" value={draft.unlocode} onChange={(e) => setDraft({ ...draft, unlocode: e.target.value })} className="w-32" />
          <Input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-48" />
          <Input placeholder="Country" maxLength={2} value={draft.country_code} onChange={(e) => setDraft({ ...draft, country_code: e.target.value })} className="w-24" />
          <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{['sea', 'air', 'both'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={add}>Add port</Button>
        </div>
      </div>

      <div className="card-elevated divide-y divide-border">
        {filtered.map((r) => (
          <div key={r.unlocode} className="flex items-center justify-between px-4 py-2 text-sm">
            <div>
              {r.name}
              <span className="ml-2 text-xs text-muted-foreground">{r.country_code} · {r.unlocode} · {r.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{r.active ? 'Active' : 'Hidden'}</span>
              <Switch checked={r.active} onCheckedChange={(v) => toggle(r.unlocode, v)} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing found.</p>}
      </div>
    </div>
  );
}
