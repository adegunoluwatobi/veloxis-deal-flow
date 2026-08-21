import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

type Country = { code: string; name: string; active: boolean };

export default function CountriesTab() {
  const [rows, setRows] = useState<Country[]>([]);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({ code: '', name: '' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('countries').select('code, name, active').order('name');
    setRows((data ?? []) as Country[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (code: string, active: boolean) => {
    const { error } = await supabase.from('countries').update({ active }).eq('code', code);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    load();
  };

  const add = async () => {
    const code = draft.code.trim().toUpperCase();
    if (code.length !== 2 || !draft.name.trim()) {
      return toast({ title: 'Enter a two letter code and a name', variant: 'destructive' });
    }
    const { error } = await supabase.from('countries').insert({ code, name: draft.name.trim() });
    if (error) return toast({ title: 'Could not add', description: error.message, variant: 'destructive' });
    setDraft({ code: '', name: '' });
    load();
  };

  const filtered = rows.filter((r) =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder="Search countries" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="ml-auto flex items-end gap-2">
          <Input placeholder="Code" maxLength={2} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className="w-24" />
          <Input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-56" />
          <Button onClick={add}>Add country</Button>
        </div>
      </div>

      <div className="card-elevated divide-y divide-border">
        {filtered.map((r) => (
          <div key={r.code} className="flex items-center justify-between px-4 py-2 text-sm">
            <div><span className="text-muted-foreground w-10 inline-block">{r.code}</span> {r.name}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{r.active ? 'Active' : 'Hidden'}</span>
              <Switch checked={r.active} onCheckedChange={(v) => toggle(r.code, v)} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing found.</p>}
      </div>
    </div>
  );
}
