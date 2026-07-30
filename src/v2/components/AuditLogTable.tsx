import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download } from 'lucide-react';

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  uploaded: 'Uploaded',
  replaced: 'Replaced',
  verified: 'Verified',
  rejected: 'Rejected',
  requested: 'Requested',
  documents_requested: 'Documents requested',
  fulfilled: 'Fulfilled',
  withdrawn: 'Withdrawn',
  request_withdrawn: 'Request withdrawn',
  expired: 'Expired',
  override_applied: 'Override applied',
  viewed: 'Viewed',
  created: 'Created',
  updated: 'Updated',
  superseded: 'Superseded',
  reference_data_changed: 'Reference data changed',
  escalation_advanced: 'Escalation advanced',
  maturity_date_changed: 'Expected payment date changed',
  limit_breach_blocked: 'Limit breach blocked',
  duplicate_blocked: 'Duplicate blocked',
  signatory_mismatch_flagged: 'Signatory mismatch flagged',
  resolution_created: 'Resolution created',
  resolution_replaced: 'Resolution replaced',
  status_changed: 'Status changed',
  sla_paused: 'Decision clock paused',
  sla_resumed: 'Decision clock resumed',
  retention_set: 'Retention date set',
  notification_sent: 'Notification sent',
};

export interface AuditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  invoice_id: string | null;
  exporter_id: string | null;
  action: string;
  actor_id: string | null;
  actor_role: string | null;
  reason: string | null;
  metadata: any;
  created_at: string;
}

function describeTarget(r: AuditRow, labels: Record<string, string>) {
  const field = r.metadata?.field;
  if (field) return String(field).replace(/_/g, ' ');
  return labels[r.entity_id] ?? r.entity_type.replace(/_/g, ' ');
}

function toCsv(rows: AuditRow[], names: Record<string, string>, labels: Record<string, string>) {
  const head = ['Timestamp', 'Actor', 'Role', 'Action', 'Target', 'Reason', 'Before', 'After'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toISOString(),
      names[r.actor_id ?? ''] ?? r.actor_id ?? 'system',
      r.actor_role ?? '',
      AUDIT_ACTION_LABEL[r.action] ?? r.action,
      describeTarget(r, labels),
      r.reason ?? '',
      JSON.stringify(r.metadata?.before ?? {}),
      JSON.stringify(r.metadata?.after ?? {}),
    ].map(esc).join(',')
  );
  return [head.join(','), ...lines].join('\n');
}

interface Props {
  invoiceId?: string;
  exporterId?: string;
  entityTypes?: string[];
  title?: string;
  csvName?: string;
}

export default function AuditLogTable({ invoiceId, exporterId, entityTypes, title, csvName }: Props) {
  const { roles } = useAuth();
  const isSuper = roles.includes('super_admin');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [action, setAction] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let query = supabase
      .from('document_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (invoiceId) query = query.eq('invoice_id', invoiceId);
    if (exporterId) query = query.eq('exporter_id', exporterId);
    if (entityTypes?.length) query = query.in('entity_type', entityTypes);
    const { data } = await query;
    const list = (data ?? []) as AuditRow[];
    setRows(list);

    const actorIds = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean))) as string[];
    if (actorIds.length) {
      const { data: p } = await supabase.from('profiles').select('user_id, name, email').in('user_id', actorIds);
      setNames(Object.fromEntries((p ?? []).map((x: any) => [x.user_id, x.name || x.email])));
    }
    const docIds = Array.from(new Set(list.filter((r) => r.entity_type.endsWith('_document')).map((r) => r.entity_id)));
    if (docIds.length) {
      const [{ data: inv }, { data: co }] = await Promise.all([
        supabase.from('invoice_documents').select('id, original_filename, document_types(label)').in('id', docIds),
        supabase.from('company_documents').select('id, original_filename, document_types(label)').in('id', docIds),
      ]);
      const map: Record<string, string> = {};
      [...(inv ?? []), ...(co ?? [])].forEach((d: any) => {
        map[d.id] = d.document_types?.label ?? d.original_filename ?? 'Document';
      });
      setLabels(map);
    }
    setLoading(false);
  }, [invoiceId, exporterId, entityTypes]);

  useEffect(() => { load(); }, [load]);

  const actions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (action !== 'all' && r.action !== action) return false;
        if (!q.trim()) return true;
        const hay = [
          names[r.actor_id ?? ''] ?? '',
          r.actor_role ?? '',
          r.reason ?? '',
          describeTarget(r, labels),
        ].join(' ').toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      }),
    [rows, action, q, names, labels]
  );

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered, names, labels)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${csvName ?? 'audit-log'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card-elevated p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground">{title ?? 'Audit log'}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor or reason"
            className="h-9 w-52"
          />
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{AUDIT_ACTION_LABEL[a] ?? a}</option>
            ))}
          </select>
          {isSuper && (
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Actor</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Document or field</th>
              <th className="text-left px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-6 text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-muted-foreground">No audit events recorded yet.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">{names[r.actor_id ?? ''] ?? (r.actor_id ? r.actor_id.slice(0, 8) : 'System')}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.actor_role ?? 'system'}</td>
                <td className="px-3 py-2">{AUDIT_ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="px-3 py-2 text-xs">{describeTarget(r, labels)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-sm">
                  {r.reason ?? ''}
                  {(r.metadata?.before || r.metadata?.after) && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px]">Before and after</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-all text-[11px]">
{JSON.stringify({ before: r.metadata?.before ?? {}, after: r.metadata?.after ?? {} }, null, 1)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
