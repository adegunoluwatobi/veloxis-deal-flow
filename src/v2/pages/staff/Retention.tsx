import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Row {
  id: string;
  kind: string;
  filename: string | null;
  label: string;
  owner: string;
  retention_expires_at: string;
}

export default function StaffRetention() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const [inv, co] = await Promise.all([
        supabase
          .from('invoice_documents')
          .select('id, original_filename, retention_expires_at, document_types(label), v2_invoices(reference, invoice_number)')
          .not('retention_expires_at', 'is', null)
          .lte('retention_expires_at', nowIso)
          .order('retention_expires_at', { ascending: true }),
        supabase
          .from('company_documents')
          .select('id, original_filename, retention_expires_at, document_types(label), v2_exporters(company_name)')
          .not('retention_expires_at', 'is', null)
          .lte('retention_expires_at', nowIso)
          .order('retention_expires_at', { ascending: true }),
      ]);
      const list: Row[] = [
        ...((inv.data ?? []) as any[]).map((d) => ({
          id: d.id,
          kind: 'Application document',
          filename: d.original_filename,
          label: d.document_types?.label ?? '—',
          owner: d.v2_invoices?.reference ?? d.v2_invoices?.invoice_number ?? '—',
          retention_expires_at: d.retention_expires_at,
        })),
        ...((co.data ?? []) as any[]).map((d) => ({
          id: d.id,
          kind: 'Company document',
          filename: d.original_filename,
          label: d.document_types?.label ?? '—',
          owner: d.v2_exporters?.company_name ?? '—',
          retention_expires_at: d.retention_expires_at,
        })),
      ].sort((a, b) => a.retention_expires_at.localeCompare(b.retention_expires_at));
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Retention expired', 'Kind', 'Document type', 'Filename', 'Belongs to', 'Record id'].join(','),
      ...rows.map((r) => [r.retention_expires_at, r.kind, r.label, r.filename, r.owner, r.id].map(esc).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `retention-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Helmet><title>Retention report · Veloxis</title></Helmet>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Retention report</h1>
          <p className="text-sm text-muted-foreground">
            Records whose retention period has passed. Retention runs to settlement date plus seven years. Nothing is deleted automatically.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Retention expired</th>
              <th className="text-left px-3 py-2">Kind</th>
              <th className="text-left px-3 py-2">Document type</th>
              <th className="text-left px-3 py-2">Filename</th>
              <th className="text-left px-3 py-2">Belongs to</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-muted-foreground">No records are past their retention date.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(r.retention_expires_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-xs">{r.kind}</td>
                <td className="px-3 py-2 text-xs">{r.label}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.filename ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{r.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
