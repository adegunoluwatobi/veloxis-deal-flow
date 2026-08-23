import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { OptionSelect, ID_TYPES } from '@/v2/lib/formOptions';
import { Plus, Trash2, Upload, CheckCircle2 } from 'lucide-react';

export type DirectorRow = {
  id: string;
  exporter_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  nationality: string | null;
  id_type: string | null;
  id_number: string | null;
  address: string | null;
  position: string | null;
  id_document_url: string | null;
  id_document_name: string | null;
};

const BLANK = {
  full_name: '', email: '', phone: '', dob: '', nationality: '',
  id_type: '', id_number: '', address: '', position: '',
  id_document_url: '', id_document_name: '',
};

export default function AdditionalDirectors({
  exporterId,
  ensureExporterId,
}: {
  exporterId?: string | null;
  /** Saves the company profile if needed and returns the exporter id. */
  ensureExporterId?: () => Promise<string | null>;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<number, string>>({});
  const savingRef = useRef(false);

  const resolveExporterId = useCallback(async () => {
    if (exporterId) return exporterId;
    return (await ensureExporterId?.()) ?? null;
  }, [exporterId, ensureExporterId]);

  const load = useCallback(async () => {
    if (!exporterId) { setRows([]); return; }
    const { data } = await supabase
      .from('v2_exporter_directors')
      .select('*')
      .eq('exporter_id', exporterId)
      .order('created_at', { ascending: true });
    setRows(data ?? []);
  }, [exporterId]);

  useEffect(() => { load(); }, [load]);

  const setField = (idx: number, k: string, v: any) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [k]: v, _dirty: true } : r)));

  const addRow = () => setRows((rs) => [...rs, { ...BLANK, _new: true, _dirty: true }]);

  const removeRow = async (idx: number) => {
    const row = rows[idx];
    if (row.id) {
      setBusy(true);
      const { error } = await supabase.from('v2_exporter_directors').delete().eq('id', row.id);
      setBusy(false);
      if (error) { toast({ title: 'Could not remove director', description: error.message, variant: 'destructive' }); return; }
    }
    setRows((rs) => rs.filter((_, i) => i !== idx));
  };

  const saveAll = useCallback(async () => {
    if (savingRef.current) return;
    const dirty = rows.filter((r) => r._dirty && r.full_name?.trim());
    if (dirty.length === 0) return;
    const expId = await resolveExporterId();
    if (!expId) return;

    savingRef.current = true;
    setBusy(true);
    try {
      for (const r of dirty) {
        const payload = {
          exporter_id: expId,
          full_name: r.full_name.trim(),
          email: r.email || null,
          phone: r.phone || null,
          dob: r.dob || null,
          nationality: r.nationality || null,
          id_type: r.id_type || null,
          id_number: r.id_number || null,
          address: r.address || null,
          position: r.position || null,
          id_document_url: r.id_document_url || null,
          id_document_name: r.id_document_name || null,
        };
        const res = r.id
          ? await supabase.from('v2_exporter_directors').update(payload).eq('id', r.id).select('id').single()
          : await supabase.from('v2_exporter_directors').insert(payload).select('id').single();
        if (res.error) {
          toast({ title: 'Could not save directors', description: res.error.message, variant: 'destructive' });
          return;
        }
        const newId = res.data?.id;
        setRows((rs) => rs.map((x) => (x === r ? { ...x, id: newId, _dirty: false, _new: false } : x)));
      }
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }, [rows, resolveExporterId]);

  /* Autosave dirty rows a moment after the exporter stops typing. */
  useEffect(() => {
    if (!rows.some((r) => r._dirty && r.full_name?.trim())) return;
    const t = setTimeout(() => { saveAll(); }, 1200);
    return () => clearTimeout(t);
  }, [rows, saveAll]);

  const uploadId = async (idx: number, file: File) => {
    const expId = await resolveExporterId();
    if (!expId) { toast({ title: 'Add your company details first', variant: 'destructive' }); return; }
    setUploading((u) => ({ ...u, [idx]: file.name }));
    try {
      const safe = file.name.replace(/[^a-z0-9._-]+/gi, '_');
      const path = `${expId}/company/directors/id-${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from('veloxis-documents').upload(path, file, { upsert: true });
      if (error) throw error;
      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, id_document_url: path, id_document_name: file.name, _dirty: true } : r)));
      toast({ title: 'ID uploaded', description: file.name });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading((u) => { const n = { ...u }; delete n[idx]; return n; });
    }
  };

  return (
    <section className="card-elevated p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Additional directors</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Add every other director or beneficial owner. Each one is screened as part of KYC.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-muted-foreground">Saved {savedAt}</span>}
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add director
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No additional directors added.</p>
      ) : (
        <div className="space-y-5">
          {rows.map((r, idx) => (
            <div key={r.id ?? `new-${idx}`} className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Director {idx + 2}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(idx)} disabled={busy}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full name *"><Input value={r.full_name ?? ''} onChange={(e) => setField(idx, 'full_name', e.target.value)} /></Field>
                <Field label="Position / role"><Input value={r.position ?? ''} onChange={(e) => setField(idx, 'position', e.target.value)} /></Field>
                <Field label="Email"><Input type="email" value={r.email ?? ''} onChange={(e) => setField(idx, 'email', e.target.value)} /></Field>
                <Field label="Phone"><Input value={r.phone ?? ''} onChange={(e) => setField(idx, 'phone', e.target.value)} /></Field>
                <Field label="Date of birth"><Input type="date" value={r.dob ?? ''} onChange={(e) => setField(idx, 'dob', e.target.value)} /></Field>
                <Field label="Nationality"><Input value={r.nationality ?? ''} onChange={(e) => setField(idx, 'nationality', e.target.value)} /></Field>
                <Field label="ID type"><OptionSelect value={r.id_type} onChange={(v) => setField(idx, 'id_type', v)} options={ID_TYPES} placeholder="Select ID type" /></Field>
                <Field label="ID number"><Input value={r.id_number ?? ''} onChange={(e) => setField(idx, 'id_number', e.target.value)} /></Field>
                <div className="col-span-2">
                  <Field label="Residential address"><Input value={r.address ?? ''} onChange={(e) => setField(idx, 'address', e.target.value)} /></Field>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Government ID document</Label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded border border-border cursor-pointer hover:bg-muted/40">
                      <Upload className="h-3.5 w-3.5" />
                      {r.id_document_name ? 'Replace file' : 'Upload ID'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        disabled={!!uploading[idx]}
                        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadId(idx, file); }}
                      />
                    </label>
                    {uploading[idx] && <span className="text-xs text-muted-foreground">Uploading {uploading[idx]}…</span>}
                    {!uploading[idx] && r.id_document_name && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-accent">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {r.id_document_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">Changes to directors save automatically.</p>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
