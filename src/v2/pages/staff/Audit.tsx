import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function StaffAudit() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('v2_audit_log').select('*').order('created_at', { ascending: false }).limit(500);
      setRows(data ?? []);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl">Audit log</h1><p className="text-sm text-muted-foreground">Last 500 events</p></div>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-4 py-3">When</th><th className="text-left px-4 py-3">Action</th><th className="text-left px-4 py-3">Transition</th><th className="text-left px-4 py-3">Invoice</th><th className="text-left px-4 py-3">Actor</th><th className="text-left px-4 py-3">Note</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">{r.action} {r.metadata?.override && <span className="ml-1 text-warning text-xs">[override]</span>}</td>
                <td className="px-4 py-2 text-xs">{r.from_status ? `${r.from_status} → ${r.to_status}` : '—'}</td>
                <td className="px-4 py-2 text-xs font-mono">{r.invoice_id?.slice(0, 8) ?? '—'}</td>
                <td className="px-4 py-2 text-xs font-mono">{r.actor_user_id?.slice(0, 8) ?? '—'}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{r.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
