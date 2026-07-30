import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download } from 'lucide-react';

interface Row {
  id: string;
  entity_type: string;
  entity_id: string;
  exporter_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  metadata: any;
  created_at: string;
}

export default function StaffAccessLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [exporters, setExporters] = useState<Record<string, string>>({});
  const [docTypes, setDocTypes] = useState<Record<string, string>>({});
  const [actor, setActor] = useState('');
  const [exporter, setExporter] = useState('all');
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('document_audit_log')
      .select('*')
      .eq('action', 'viewed')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (from) q = q.gte('created_at', new Date(from).toISOString());
    if (to) q = q.lte('created_at', new Date(`${to}T23:59:59`).toISOString());
    const { data } = await q;
    const list = (data ?? []) as Row[];
    setRows(list);

    const actorIds = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean))) as string[];
    const expIds = Array.from(new Set(list.map((r) => r.exporter_id).filter(Boolean))) as string[];
    const docIds = Array.from(new Set(list.map((r) => r.entity_id)));
    const [p, e, inv, co] = await Promise.all([
      actorIds.length ? supabase.from('profiles').select('user_id, name, email').in('user_id', actorIds) : { data: [] as any[] },
      expIds.length ? supabase.from('v2_exporters').select('id, company_name').in('id', expIds) : { data: [] as any[] },
      docIds.length ? supabase.from('invoice_documents').select('id, document_types(label)').in('id', docIds) : { data: [] as any[] },
      docIds.length ? supabase.from('company_documents').select('id, document_types(label)').in('id', docIds) : { data: [] as any[] },
    ]);
    setNames(Object.fromEntries((p.data ?? []).map((x: any) => [x.user_id, x.name || x.email])));
    setExporters(Object.fromEntries((e.data ?? []).map((x: any) => [x.id, x.company_name])));
    setDocTypes(Object.fromEntries([...(inv.data ?? []), ...(co.data ?? [])].map((x: any) => [x.id, x.document_types?.label ?? 'Document'])));
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const typeOptions = useMemo(
    () => Array.from(new Set(Object.values(docTypes))).sort(),
    [docTypes]
  );

  const filtered = useMemo(
    () => rows.filter((r) => {
      if (exporter !== 'all' && r.exporter_id !== exporter) return false;
      if (type !== 'all' && docTypes[r.entity_id] !== type) return false;
      if (actor.trim()) {
        const n = (names[r.actor_id ?? ''] ?? '').toLowerCase();
        if (!n.includes(actor.trim().toLowerCase())) return false;
      }
      return true;
    }),
    [rows, exporter, type, actor, names, docTypes]
  );

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Timestamp', 'Actor', 'Role', 'Exporter', 'Document type', 'Document id', 'IP', 'User agent'].join(','),
      ...filtered.map((r) => [
        new Date(r.created_at).toISOString(),
        names[r.actor_id ?? ''] ?? r.actor_id,
        r.actor_role,
        exporters[r.exporter_id ?? ''] ?? r.exporter_id,
        docTypes[r.entity_id] ?? r.entity_type,
        r.entity_id,
        r.metadata?.ip ?? '',
        r.metadata?.user_agent ?? '',
      ].map(esc).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-access-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Helmet><title>Document access log · Veloxis</title></Helmet>
      <div>
        <h1 className="text-2xl">Document access log</h1>
        <p className="text-sm text-muted-foreground">Every document opened across all exporters.</p>
      </div>

      <div className="card-elevated p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Actor</label>
          <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Name or email" className="h-9 w-48" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Exporter</label>
          <select value={exporter} onChange={(e) => setExporter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="all">All exporters</option>
            {Object.entries(exporters).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Document type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="all">All types</option>
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        </div>
        <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Actor</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Exporter</th>
              <th className="text-left px-3 py-2">Document</th>
              <th className="text-left px-3 py-2">IP</th>
              <th className="text-left px-3 py-2">User agent</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-muted-foreground">No document views recorded.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs">{names[r.actor_id ?? ''] ?? r.actor_id?.slice(0, 8)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.actor_role}</td>
                <td className="px-3 py-2 text-xs">{exporters[r.exporter_id ?? ''] ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{docTypes[r.entity_id] ?? r.entity_type.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-xs font-mono">{r.metadata?.ip ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">{r.metadata?.user_agent ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
