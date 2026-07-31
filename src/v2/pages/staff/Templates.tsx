import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

type Template = {
  id: string; code: string; label: string; description: string | null;
  body: string; version: number; active: boolean; created_at: string; created_by: string | null;
  counsel_approved: boolean; counsel_approved_at: string | null; counsel_reference: string | null;
};

const TOKENS = [
  'invoice_reference', 'invoice_number', 'gross_invoice_value', 'currency', 'agreed_deductions',
  'advance_amount', 'holdback_amount', 'maturity_date', 'incoterm', 'commodity', 'bl_number',
  'bl_date', 'port_of_loading', 'port_of_discharge', 'exporter_legal_name', 'exporter_rc_number',
  'exporter_registered_address', 'signatory_name', 'signatory_position', 'buyer_legal_name',
  'buyer_registered_address', 'buyer_company_number', 'domiciliary_account_details', 'today_date',
];

export default function StaffTemplates() {
  const { roles } = useAuth();
  const isSuperAdmin = (roles as any[]).includes('super_admin');
  const [rows, setRows] = useState<Template[]>([]);
  const [draft, setDraft] = useState<Record<string, { label: string; body: string }>>({});
  const [busy, setBusy] = useState(false);
  const [approveFor, setApproveFor] = useState<Template | null>(null);
  const [reference, setReference] = useState('');
  const [mode, setMode] = useState<'test' | 'production'>('test');
  const [testEmail, setTestEmail] = useState('');

  const load = useCallback(async () => {
    const [{ data }, { data: cfg }] = await Promise.all([
      supabase.from('document_templates').select('*').order('code').order('version', { ascending: false }),
      supabase.from('v2_system_config').select('key, value').in('key', ['esignature_mode', 'esignature_test_email']),
    ]);
    const list = (data ?? []) as unknown as Template[];
    setRows(list);
    const d: Record<string, { label: string; body: string }> = {};
    list.filter((t) => t.active).forEach((t) => { d[t.code] = { label: t.label, body: t.body }; });
    setDraft(d);
    const map: Record<string, string> = {};
    (cfg ?? []).forEach((c: any) => { map[c.key] = String(c.value).replace(/^"|"$/g, ''); });
    setMode(map.esignature_mode === 'production' ? 'production' : 'test');
    setTestEmail(map.esignature_test_email ?? '');
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = rows.filter((t) => t.active);
  const pendingCounsel = active.filter((t) => !t.counsel_approved);

  const save = async (code: string) => {
    const d = draft[code];
    if (!d) return;
    setBusy(true);
    const { error } = await supabase.rpc('create_template_version', {
      p_code: code, p_body: d.body, p_label: d.label,
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'New version created', description: 'The new version must be approved by counsel before it can be used.' });
    load();
  };

  const approve = async () => {
    if (!approveFor) return;
    if (reference.trim().length < 3) {
      toast({ title: 'A counsel reference is required', variant: 'destructive' }); return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('approve_template_counsel' as any, {
      p_template_id: approveFor.id, p_counsel_reference: reference.trim(),
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not record approval', description: error.message, variant: 'destructive' }); return; }
    setApproveFor(null); setReference('');
    toast({ title: 'Counsel approval recorded' });
    load();
  };

  const saveTestEmail = async () => {
    setBusy(true);
    const { error } = await supabase.from('v2_system_config')
      .upsert({ key: 'esignature_test_email', value: testEmail.trim() as any }, { onConflict: 'key' });
    setBusy(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Test address saved' });
    load();
  };

  const switchMode = async (next: 'test' | 'production') => {
    setBusy(true);
    const { error } = await supabase.rpc('set_esignature_mode' as any, { p_mode: next });
    setBusy(false);
    if (error) { toast({ title: 'Could not change mode', description: error.message, variant: 'destructive' }); return; }
    toast({ title: next === 'production' ? 'Production signing enabled' : 'Test mode enabled' });
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

      {pendingCounsel.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300 flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Awaiting counsel approval</div>
            <p className="mt-1">
              These templates cannot be generated or sent for signature until counsel has approved them:{' '}
              {pendingCounsel.map((t) => t.label).join(', ')}.
            </p>
          </div>
        </div>
      )}

      <section className="card-elevated p-5 space-y-3">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Electronic signature mode</h3>
        <p className="text-xs text-muted-foreground">
          In test mode every signature request is routed to the internal test address only, whoever the signatory is,
          and every instrument is labelled as non-binding.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px]">
            <Label>Internal test email address</Label>
            <Input value={testEmail} disabled={!isSuperAdmin} onChange={(e) => setTestEmail(e.target.value)} placeholder="signing-test@veloxis.co.uk" />
          </div>
          {isSuperAdmin && <Button variant="outline" disabled={busy} onClick={saveTestEmail}>Save address</Button>}
          <div className="flex-1" />
          <span className={`text-xs px-2 py-1 rounded border ${mode === 'production'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}`}>
            Currently {mode === 'production' ? 'production' : 'test mode'}
          </span>
          {isSuperAdmin && (
            mode === 'production'
              ? <Button variant="outline" disabled={busy} onClick={() => switchMode('test')}>Switch to test mode</Button>
              : <Button disabled={busy || pendingCounsel.length > 0} onClick={() => switchMode('production')}>
                  Switch to production
                </Button>
          )}
        </div>
        {pendingCounsel.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Production signing stays locked until every template has been approved by counsel.
          </p>
        )}
      </section>

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

                <div className={`rounded border p-3 text-xs flex flex-wrap items-center justify-between gap-2 ${t.counsel_approved
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
                  <span className="flex items-center gap-2">
                    {t.counsel_approved ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {t.counsel_approved
                      ? `Approved by counsel ${t.counsel_approved_at ? new Date(t.counsel_approved_at).toLocaleDateString('en-GB') : ''} · reference ${t.counsel_reference}`
                      : 'Not yet approved by counsel. This document cannot be generated or sent for signature.'}
                  </span>
                  {isSuperAdmin && !t.counsel_approved && (
                    <Button size="sm" variant="outline" onClick={() => { setApproveFor(t); setReference(''); }}>
                      Record counsel approval
                    </Button>
                  )}
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
                      <span>
                        Version {h.version} {h.active && <span className="text-accent">· active</span>}
                        {h.counsel_approved && <span className="text-emerald-400"> · counsel approved</span>}
                      </span>
                      <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString('en-GB')}</span>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={!!approveFor} onOpenChange={(o) => !o && setApproveFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record counsel approval</DialogTitle>
            <DialogDescription>
              Confirms that {approveFor?.label} version {approveFor?.version} has been reviewed and approved by counsel.
              A counsel reference is required and is kept on the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Counsel reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Advice note reference or file number" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveFor(null)}>Cancel</Button>
            <Button disabled={busy} onClick={approve}>Record approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
