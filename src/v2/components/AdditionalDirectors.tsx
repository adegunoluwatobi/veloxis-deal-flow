import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { OptionSelect, ID_TYPES } from '@/v2/lib/formOptions';
import { Plus, Trash2 } from 'lucide-react';

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
};

const BLANK = {
  full_name: '', email: '', phone: '', dob: '', nationality: '',
  id_type: '', id_number: '', address: '', position: '',
};

export default function AdditionalDirectors({ exporterId }: { exporterId?: string | null }) {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

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

  const saveAll = async () => {
    if (!exporterId) { toast({ title: 'Save your company profile first', variant: 'destructive' }); return; }
    const dirty = rows.filter((r) => r._dirty);
    if (dirty.length === 0) { toast({ title: 'Nothing to save' }); return; }
    if (dirty.some((r) => !r.full_name?.trim())) {
      toast({ title: 'Every director needs a full name', variant: 'destructive' });
      return;
    }
    setBusy(true);
    for (const r of dirty) {
      const payload = {
        exporter_id: exporterId,
        full_name: r.full_name.trim(),
        email: r.email || null,
        phone: r.phone || null,
        dob: r.dob || null,
        nationality: r.nationality || null,
        id_type: r.id_type || null,
        id_number: r.id_number || null,
        address: r.address || null,
        position: r.position || null,
      };
      const { error } = r.id
        ? await supabase.from('v2_exporter_directors').update(payload).eq('id', r.id)
        : await supabase.from('v2_exporter_directors').insert(payload);
      if (error) {
        setBusy(false);
        toast({ title: 'Could not save directors', description: error.message, variant: 'destructive' });
        return;
      }
    }
    setBusy(false);
    toast({ title: 'Directors saved' });
    load();
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
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={busy}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add director
        </Button>
      </div>

      {!exporterId && (
        <p className="text-xs text-amber-400">Save your company details first, then you can add more directors.</p>
      )}

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
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div><Button type="button" variant="outline" onClick={saveAll} disabled={busy || !exporterId}>Save directors</Button></div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
