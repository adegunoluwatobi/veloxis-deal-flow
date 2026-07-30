import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

type Holiday = {
  id: string;
  holiday_date: string;
  name: string;
  jurisdiction: string;
  active: boolean;
};

const empty = { id: '', holiday_date: '', name: '', jurisdiction: 'NG', active: true };

export default function PublicHolidaysTab() {
  const [rows, setRows] = useState<Holiday[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .order('holiday_date');
    if (error) return toast({ title: 'Could not load public holidays', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as Holiday[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.holiday_date || !form.name.trim()) {
      return toast({ title: 'Date and name are required', variant: 'destructive' });
    }
    setSaving(true);
    const payload = {
      holiday_date: form.holiday_date,
      name: form.name.trim(),
      jurisdiction: form.jurisdiction.trim() || 'NG',
      active: form.active,
    };
    const { error } = form.id
      ? await supabase.from('public_holidays').update(payload).eq('id', form.id)
      : await supabase.from('public_holidays').insert(payload);
    setSaving(false);
    if (error) return toast({ title: 'Could not save the holiday', description: error.message, variant: 'destructive' });
    toast({ title: form.id ? 'Holiday updated' : 'Holiday added' });
    setOpen(false);
    setForm(empty);
    load();
  };

  const toggle = async (h: Holiday) => {
    const { error } = await supabase.from('public_holidays').update({ active: !h.active }).eq('id', h.id);
    if (error) return toast({ title: 'Could not update the holiday', description: error.message, variant: 'destructive' });
    load();
  };

  const byYear = rows.reduce<Record<string, Holiday[]>>((acc, h) => {
    const y = h.holiday_date.slice(0, 4);
    (acc[y] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Working day calculations skip Saturdays, Sundays and any active holiday below. Deactivate rather than delete so past decisions stay reproducible.
        </p>
        <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add holiday</Button>
      </div>

      {Object.keys(byYear).sort().map((year) => (
        <div key={year} className="card-elevated overflow-x-auto">
          <div className="border-b px-4 py-3 text-sm font-medium">{year}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byYear[year].map((h) => (
                <TableRow key={h.id} className={h.active ? undefined : 'opacity-60'}>
                  <TableCell className="font-mono text-sm">
                    {new Date(h.holiday_date + 'T00:00:00Z').toLocaleDateString('en-GB', {
                      weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC',
                    })}
                  </TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.jurisdiction}</TableCell>
                  <TableCell>
                    <Badge variant={h.active ? 'default' : 'secondary'}>{h.active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setForm({ ...h }); setOpen(true); }}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(h)}>{h.active ? 'Deactivate' : 'Reactivate'}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      {rows.length === 0 && (
        <div className="card-elevated p-6 text-sm text-muted-foreground">No public holidays recorded yet.</div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{form.id ? 'Edit holiday' : 'Add holiday'}</SheetTitle>
            <SheetDescription>Active holidays are skipped when a working day deadline is calculated.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.holiday_date} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Independence Day" />
            </div>
            <div className="space-y-2">
              <Label>Jurisdiction</Label>
              <Input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} placeholder="NG" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive holidays count as normal working days.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
