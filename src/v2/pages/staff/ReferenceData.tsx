import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';
import { ArrowDown, ArrowUp, Plus, Search } from 'lucide-react';

const CATEGORIES = [
  { value: 'agricultural', label: 'Agricultural' },
  { value: 'solid_minerals', label: 'Solid minerals' },
  { value: 'metals', label: 'Metals' },
  { value: 'timber', label: 'Timber' },
  { value: 'seafood', label: 'Seafood' },
  { value: 'textiles', label: 'Textiles' },
  { value: 'manufactured', label: 'Manufactured' },
  { value: 'other', label: 'Other' },
];
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

type DocType = {
  id: string; code: string; label: string; description: string | null;
  stage: number | null; requirement: string; level: string; sort_order: number; active: boolean;
};
type Commodity = { id: string; name: string; category: string; active: boolean };
type Regulated = Commodity & { requires_inspection: boolean };
type ConfigRow = { key: string; value: any; description: string | null; updated_by: string | null; updated_at: string };

const ActivePill = ({ active }: { active: boolean }) => (
  <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Active' : 'Inactive'}</Badge>
);

/* ------------------------------------------------------------------ */
/* Document types                                                      */
/* ------------------------------------------------------------------ */
function DocumentTypesTab() {
  const [rows, setRows] = useState<DocType[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<DocType> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('document_types').select('*').order('sort_order');
    if (error) return toast({ title: 'Could not load document types', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as DocType[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (!editing.code?.trim() || !editing.label?.trim()) {
      return toast({ title: 'Code and label are required', variant: 'destructive' });
    }
    setSaving(true);
    const payload = {
      label: editing.label!.trim(),
      description: editing.description?.trim() || null,
      stage: editing.stage ?? null,
      requirement: editing.requirement ?? 'optional',
      level: editing.level ?? 'invoice',
      sort_order: Number(editing.sort_order ?? 0),
      active: editing.active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from('document_types').update(payload).eq('id', editing.id)
      : await supabase.from('document_types').insert({ ...payload, code: editing.code!.trim() });
    setSaving(false);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: editing.id ? 'Document type updated' : 'Document type created' });
    setOpen(false); setEditing(null); load();
  };

  const toggleActive = async (row: DocType) => {
    const { error } = await supabase.from('document_types').update({ active: !row.active }).eq('id', row.id);
    if (error) return toast({ title: 'Cannot change status', description: error.message, variant: 'destructive' });
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = rows[index]; const b = rows[index + dir];
    if (!a || !b) return;
    await supabase.from('document_types').update({ sort_order: b.sort_order }).eq('id', a.id);
    await supabase.from('document_types').update({ sort_order: a.sort_order }).eq('id', b.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Every document the platform can request. Codes cannot change once created.</p>
        <Button size="sm" onClick={() => { setEditing({ requirement: 'optional', level: 'invoice', sort_order: (rows.at(-1)?.sort_order ?? 0) + 10, active: true }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New document type
        </Button>
      </div>
      <div className="card-elevated overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead><TableHead>Label</TableHead><TableHead>Stage</TableHead>
              <TableHead>Requirement</TableHead><TableHead>Level</TableHead><TableHead>Order</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.label}</TableCell>
                <TableCell>{r.stage ?? 'Optional library'}</TableCell>
                <TableCell className="capitalize">{r.requirement}</TableCell>
                <TableCell className="capitalize">{r.level}</TableCell>
                <TableCell>{r.sort_order}</TableCell>
                <TableCell><ActivePill active={r.active} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>{r.active ? 'Deactivate' : 'Reactivate'}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?.id ? 'Edit document type' : 'New document type'}</SheetTitle>
            <SheetDescription>Helper text should be one sentence in plain language.</SheetDescription>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Code</Label>
                <Input value={editing.code ?? ''} disabled={!!editing.id}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
                {editing.id && <p className="text-xs text-muted-foreground mt-1">The code is fixed once the type exists.</p>}
              </div>
              <div><Label>Label</Label><Input value={editing.label ?? ''} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></div>
              <div><Label>Helper text</Label><Textarea rows={3} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div>
                <Label>Stage</Label>
                <Select value={editing.stage ? String(editing.stage) : 'none'} onValueChange={(v) => setEditing({ ...editing, stage: v === 'none' ? null : Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Stage 1</SelectItem>
                    <SelectItem value="2">Stage 2</SelectItem>
                    <SelectItem value="none">Optional library</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Requirement</Label>
                <Select value={editing.requirement ?? 'optional'} onValueChange={(v) => setEditing({ ...editing, requirement: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mandatory">Mandatory</SelectItem>
                    <SelectItem value="conditional">Conditional</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Level</Label>
                <Select value={editing.level ?? 'invoice'} onValueChange={(v) => setEditing({ ...editing, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sort order</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-3">
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <SheetFooter>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Commodities                                                         */
/* ------------------------------------------------------------------ */
function CommoditiesTab({ regulated }: { regulated: boolean }) {
  const table = regulated ? 'regulated_commodities' : 'commodities';
  const [rows, setRows] = useState<Regulated[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Regulated> | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(table as any).select('*').order('name');
    if (error) return toast({ title: 'Could not load list', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as unknown as Regulated[]);
  }, [table]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) || catLabel(r.category).toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  const persist = async () => {
    if (!editing?.name?.trim()) return toast({ title: 'Name is required', variant: 'destructive' });
    const payload: Record<string, unknown> = {
      name: editing.name.trim(),
      category: editing.category ?? 'other',
      active: editing.active ?? true,
    };
    if (regulated) payload.requires_inspection = editing.requires_inspection ?? true;
    const { error } = editing.id
      ? await supabase.from(table as any).update(payload).eq('id', editing.id)
      : await supabase.from(table as any).insert(payload as any);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: editing.id ? 'Entry updated' : 'Entry created' });
    setOpen(false); setEditing(null); setConfirmSave(false); load();
  };

  const onSave = () => { if (regulated) setConfirmSave(true); else persist(); };

  const toggleActive = async (row: Regulated) => {
    const { error } = await supabase.from(table as any).update({ active: !row.active }).eq('id', row.id);
    if (error) return toast({ title: 'Cannot change status', description: error.message, variant: 'destructive' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="relative w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => { setEditing({ category: 'agricultural', active: true, requires_inspection: true }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New entry
        </Button>
      </div>
      <div className="card-elevated overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Category</TableHead>
              {regulated && <TableHead>Inspection</TableHead>}
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{catLabel(r.category)}</TableCell>
                {regulated && <TableCell>{r.requires_inspection ? 'Required' : 'Not required'}</TableCell>}
                <TableCell><ActivePill active={r.active} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>{r.active ? 'Deactivate' : 'Reactivate'}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing?.id ? 'Edit entry' : 'New entry'}</SheetTitle>
            <SheetDescription>Entries are never deleted because past invoices refer to them.</SheetDescription>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 py-4">
              <div><Label>Name</Label><Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <Select value={editing.category ?? 'other'} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {regulated && (
                <div className="flex items-center gap-3">
                  <Switch checked={editing.requires_inspection ?? true} onCheckedChange={(v) => setEditing({ ...editing, requires_inspection: v })} />
                  <Label>Requires inspection</Label>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <SheetFooter><Button onClick={onSave}>Save</Button></SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this change</AlertDialogTitle>
            <AlertDialogDescription>
              This applies to new invoices only and does not change invoices already submitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={persist}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* System config                                                       */
/* ------------------------------------------------------------------ */
function SystemConfigTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ key: string; value: string; current: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('v2_system_config').select('*').order('key');
    if (error) return toast({ title: 'Could not load configuration', description: error.message, variant: 'destructive' });
    const list = (data ?? []) as ConfigRow[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.updated_by).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, name, email').in('user_id', ids);
      setNames(Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.name || p.email])));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const persist = async () => {
    if (!editing) return;
    let parsed: any;
    try { parsed = JSON.parse(editing.value); } catch { parsed = editing.value; }
    const { error } = await supabase.from('v2_system_config')
      .update({ value: parsed, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('key', editing.key);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Configuration updated' });
    setEditing(null); setConfirm(false); load();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Only the value can change. Keys are fixed because the platform reads them by name.</p>
      <div className="card-elevated overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead><TableHead>Value</TableHead><TableHead>Description</TableHead>
              <TableHead>Last updated</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const current = typeof r.value === 'string' ? r.value : JSON.stringify(r.value);
              const isEditing = editing?.key === r.key;
              return (
                <TableRow key={r.key}>
                  <TableCell className="font-mono text-xs">{r.key}</TableCell>
                  <TableCell className="w-48">
                    {isEditing
                      ? <Input value={editing!.value} onChange={(e) => setEditing({ ...editing!, value: e.target.value })} />
                      : current}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.description}</TableCell>
                  <TableCell className="text-sm">
                    {r.updated_at ? new Date(r.updated_at).toLocaleString() : 'Never'}
                    {r.updated_by && <div className="text-xs text-muted-foreground">{names[r.updated_by] ?? 'Staff user'}</div>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button size="sm" onClick={() => (r.key === 'advance_rate' ? setConfirm(true) : persist())}>Save</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ key: r.key, value: current, current })}>Edit</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the advance rate</AlertDialogTitle>
            <AlertDialogDescription>
              The advance rate moves from {editing?.current} to {editing?.value} and applies to every new funding calculation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={persist}>Confirm change</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export default function ReferenceData() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('super_admin' as any);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Reference data</h1>
        <p className="text-sm text-muted-foreground">Document types, commodities, exchange rates and system configuration used across the platform.</p>
      </div>
      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Document types</TabsTrigger>
          <TabsTrigger value="commodities">Commodities</TabsTrigger>
          <TabsTrigger value="regulated">Regulated commodities</TabsTrigger>
          <TabsTrigger value="config">System config</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="fx">Exchange rates</TabsTrigger>}
        </TabsList>
        <TabsContent value="documents" className="mt-6"><DocumentTypesTab /></TabsContent>
        <TabsContent value="commodities" className="mt-6"><CommoditiesTab regulated={false} /></TabsContent>
        <TabsContent value="regulated" className="mt-6"><CommoditiesTab regulated /></TabsContent>
        <TabsContent value="config" className="mt-6"><SystemConfigTab /></TabsContent>
        {isSuperAdmin && <TabsContent value="fx" className="mt-6"><FxRatesTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

