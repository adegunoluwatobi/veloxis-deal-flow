import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

interface Template {
  id: string;
  key: string;
  channel: 'email' | 'in_app';
  audience: 'exporter' | 'staff';
  subject: string;
  body: string;
  description: string | null;
  active: boolean;
}

export default function StaffNotifications() {
  const [rows, setRows] = useState<Template[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Partial<Template>>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notification_templates')
      .select('*')
      .order('audience')
      .order('key')
      .order('channel');
    setRows((data ?? []) as Template[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (t: Template) => {
    const patch = draft[t.id];
    if (!patch) return;
    setBusy(true);
    const { error } = await supabase.from('notification_templates').update(patch).eq('id', t.id);
    setBusy(false);
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    toast({ title: 'Template saved' });
    setDraft((d) => { const n = { ...d }; delete n[t.id]; return n; });
    load();
  };

  const toggle = async (t: Template, active: boolean) => {
    const { error } = await supabase.from('notification_templates').update({ active }).eq('id', t.id);
    if (error) return toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
    load();
  };

  const grouped = rows.reduce<Record<string, Template[]>>((acc, r) => {
    (acc[r.key] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Helmet><title>Notification templates · Veloxis</title></Helmet>
      <div>
        <h1 className="text-2xl">Notification templates</h1>
        <p className="text-sm text-muted-foreground">
          Every email and in app message is rendered from these templates. Placeholders use double curly braces.
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([key, items]) => (
          <div key={key} className="card-elevated overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenKey(openKey === key ? null : key)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-accent/30"
            >
              <div>
                <div className="font-medium">{items[0].description ?? key}</div>
                <div className="text-xs text-muted-foreground font-mono">{key}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded border border-border px-2 py-0.5">{items[0].audience}</span>
                {items.map((i) => (
                  <span key={i.id} className={`rounded px-2 py-0.5 border ${i.active ? 'border-accent text-accent' : 'border-border'}`}>
                    {i.channel === 'in_app' ? 'in app' : 'email'}
                  </span>
                ))}
              </div>
            </button>

            {openKey === key && (
              <div className="border-t border-border divide-y divide-border">
                {items.map((t) => (
                  <div key={t.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{t.channel === 'in_app' ? 'In app message' : 'Email'}</div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Active
                        <Switch checked={t.active} onCheckedChange={(v) => toggle(t, v)} />
                      </label>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Subject or title</label>
                      <Input
                        defaultValue={t.subject}
                        onChange={(e) => setDraft((d) => ({ ...d, [t.id]: { ...d[t.id], subject: e.target.value } }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Body</label>
                      <Textarea
                        rows={t.channel === 'email' ? 8 : 4}
                        defaultValue={t.body}
                        onChange={(e) => setDraft((d) => ({ ...d, [t.id]: { ...d[t.id], body: e.target.value } }))}
                      />
                    </div>
                    <Button size="sm" disabled={busy || !draft[t.id]} onClick={() => save(t)}>Save</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
