import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Template = {
  id: string; code: string; label: string; description: string | null;
  body: string; version: number; active: boolean; created_at: string; created_by: string | null;
};

const TOKENS = [
  'invoice_reference', 'invoice_number', 'gross_invoice_value', 'currency', 'agreed_deductions',
  'advance_amount', 'holdback_amount', 'maturity_date', 'incoterm', 'commodity', 'bl_number',
  'bl_date', 'port_of_loading', 'port_of_discharge', 'exporter_legal_name', 'exporter_rc_number',
  'exporter_registered_address', 'signatory_name', 'signatory_position', 'buyer_legal_name',
  'buyer_registered_address', 'buyer_company_number', 'domiciliary_account_details', 'today_date',
];

export default function StaffTemplates() {
  const [rows, setRows] = useState<Template[]>([]);
  const [draft, setDraft] = useState<Record<string, { label: string; body: string }>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('document_templates').select('*').order('code').order('version', { ascending: false });
    const list = (data ?? []) as Template[];
    setRows(list);
    const d: Record<string, { label: string; body: string }> = {};
    list.filter((t) => t.active).forEach((t) => { d[t.code] = { label: t.label, body: t.body }; });
    setDraft(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = rows.filter((t) => t.active);

  const save = async (code: string) => {
    const d = draft[code];
    if (!d) return;
    setBusy(true);
    const { error } = await supabase.rpc('create_template_version', {
      p_code: code, p_body: d.body, p_label: d.label,
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'New version created', description: 'The previous version has been kept for the record.' });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Document templates</h1>
        <p className="text-sm text-muted-foreground">
          Wording used to generate the assignment instruments. Editing creates a new version. Nothing is overwritten,
          and every generated document records the version it came from.
        </p>
      </div>

      <section className="card-elevated p-4">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Merge tokens</h3>
        <div className="flex flex-wrap gap-1">
          {TOKENS.map((t) => (
            <code key={t} className="text-xs px-2 py-0.5 rounded border border-border bg-muted/20">{`{{${t}}}`}</code>
          ))}
        </div>
      </section>

      {active.length === 0 && <p className="text-sm text-muted-foreground">No templates found.</p>}

      <Tabs defaultValue={active[0]?.code}>
        <TabsList>
          {active.map((t) => <TabsTrigger key={t.code} value={t.code}>{t.label}</TabsTrigger>)}
        </TabsList>

        {active.map((t) => {
          const history = rows.filter((r) => r.code === t.code).sort((a, b) => b.version - a.version);
          const d = draft[t.code] ?? { label: t.label, body: t.body };
          const dirty = d.body !== t.body || d.label !== t.label;
          return (
            <TabsContent key={t.code} value={t.code} className="space-y-4 mt-4">
              <section className="card-elevated p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Active version {t.version} · created {new Date(t.created_at).toLocaleString('en-GB')}
                  </span>
                  <Button disabled={busy || !dirty} onClick={() => save(t.code)}>Save as new version</Button>
                </div>
                <div>
                  <Label>Label</Label>
                  <Input value={d.label} onChange={(e) => setDraft((s) => ({ ...s, [t.code]: { ...d, label: e.target.value } }))} />
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea
                    className="font-mono text-xs min-h-[420px]"
                    value={d.body}
                    onChange={(e) => setDraft((s) => ({ ...s, [t.code]: { ...d, body: e.target.value } }))}
                  />
                </div>
              </section>

              <section className="card-elevated p-5">
                <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Version history</h3>
                <div className="space-y-1 text-xs">
                  {history.map((h) => (
                    <div key={h.id} className="flex justify-between border-t border-border pt-2">
                      <span>Version {h.version} {h.active && <span className="text-accent">· active</span>}</span>
                      <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString('en-GB')}</span>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
