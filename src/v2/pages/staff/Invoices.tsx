import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Row = {
  id: string; invoice_number: string; invoice_amount: number; invoice_currency: string;
  status: string; maturity_date: string | null; created_at: string; decision_due_at: string | null;
  inspection_required: boolean | null; days_past_maturity: number | null; escalation_stage: string | null;
  exporter_id: string; buyer_id: string | null;
  v2_exporters?: { company_name: string } | null;
  v2_buyers?: { company_name: string } | null;
};

type DocSummary = { s1Done: number; s1Total: number; s2Done: number; s2Total: number; outstanding: number; rejected: boolean };

const WORKING_HOURS_MS = 4 * 60 * 60 * 1000;

const ESCALATION_LABEL: Record<string, string> = {
  reminder_sent: 'Reminder sent',
  ap_contacted: 'Accounts payable contacted',
  demand_issued: 'Demand issued',
  counsel_instructed: 'Counsel instructed',
};

function Chip({ label, done, total, tone }: { label: string; done: number; total: number; tone: 'green' | 'amber' | 'red' | 'muted' }) {
  const cls = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    red: 'border-destructive/30 bg-destructive/10 text-destructive',
    muted: 'border-border bg-muted/20 text-muted-foreground',
  }[tone];
  return <span className={cn('text-[11px] px-1.5 py-0.5 rounded border whitespace-nowrap mr-1', cls)}>{label} {done} of {total}</span>;
}

export default function StaffInvoices() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Record<string, DocSummary>>({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [flag, setFlag] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v2_invoices_with_ageing')
        .select('id, invoice_number, invoice_amount, invoice_currency, status, maturity_date, created_at, decision_due_at, inspection_required, days_past_maturity, escalation_stage, exporter_id, buyer_id, v2_exporters(company_name), v2_buyers(company_name)')
        .order('created_at', { ascending: false });
      const list = (data ?? []) as any as Row[];
      setRows(list);

      const ids = list.map((r) => r.id);
      if (ids.length === 0) return;
      const [{ data: types }, { data: docs }, { data: reqs }] = await Promise.all([
        supabase.from('document_types').select('id, stage, requirement, level, code').eq('active', true),
        supabase.from('invoice_documents').select('id, invoice_id, document_type_id, status, version, superseded_by').in('invoice_id', ids),
        supabase.from('invoice_document_requests').select('id, invoice_id, status').in('invoice_id', ids),
      ]);

      const inv1 = (types ?? []).filter((t: any) => t.level === 'invoice' && t.stage === 1 && t.requirement === 'mandatory');
      const insp = (types ?? []).find((t: any) => t.code === 'inspection_certificate');
      const inv2 = (types ?? []).filter((t: any) => t.level === 'invoice' && t.stage === 2 && t.requirement === 'mandatory');

      const map: Record<string, DocSummary> = {};
      list.forEach((r) => {
        const mine = (docs ?? []).filter((d: any) => d.invoice_id === r.id);
        const current = (typeId: string) => {
          const rowsForType = mine.filter((d: any) => d.document_type_id === typeId && !d.superseded_by);
          return rowsForType.sort((a: any, b: any) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null;
        };
        const s1 = r.inspection_required && insp ? [...inv1, insp] : inv1;
        map[r.id] = {
          s1Total: s1.length,
          s1Done: s1.filter((t: any) => current(t.id)?.status === 'verified').length,
          s2Total: inv2.length,
          s2Done: inv2.filter((t: any) => current(t.id)?.status === 'verified').length,
          outstanding: (reqs ?? []).filter((x: any) => x.invoice_id === r.id && x.status === 'outstanding').length,
          rejected: mine.some((d: any) => !d.superseded_by && d.status === 'rejected'),
        };
      });
      setSummary(map);
    })();
  }, []);

  const slaAtRisk = (r: Row) =>
    !!r.decision_due_at && ['submitted', 'verified'].includes(r.status)
    && new Date(r.decision_due_at).getTime() - Date.now() < WORKING_HOURS_MS;

  const filtered = useMemo(() => rows.filter((r) => {
    const s = summary[r.id];
    if (status !== 'all' && r.status !== status) return false;
    if (flag === 'outstanding' && !(s && s.outstanding > 0)) return false;
    if (flag === 'rejected' && !(s && s.rejected)) return false;
    if (flag === 'information_requested' && r.status !== 'information_requested') return false;
    if (flag === 'sla_at_risk' && !slaAtRisk(r)) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    return r.invoice_number?.toLowerCase().includes(t)
      || r.v2_exporters?.company_name?.toLowerCase().includes(t)
      || r.v2_buyers?.company_name?.toLowerCase().includes(t);
  }), [rows, q, status, flag, summary]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl">Applications</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length}</p>
        </div>
        <Button asChild><Link to="/app/invoices/new">New application</Link></Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search invoice, exporter, buyer" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(INVOICE_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={flag} onValueChange={setFlag}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">No document filter</SelectItem>
            <SelectItem value="outstanding">Documents outstanding</SelectItem>
            <SelectItem value="rejected">Documents rejected</SelectItem>
            <SelectItem value="information_requested">Information requested</SelectItem>
            <SelectItem value="sla_at_risk">SLA at risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Invoice</th>
              <th className="text-left px-4 py-3">Exporter</th>
              <th className="text-left px-4 py-3">Buyer</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Documents</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Maturity</th>
              <th className="text-left px-4 py-3">Ageing</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const s = summary[r.id];
              const tone = (done: number, total: number): 'green' | 'amber' | 'red' | 'muted' => {
                if (!s) return 'muted';
                if (s.rejected) return 'red';
                if (s.outstanding > 0) return 'amber';
                if (total > 0 && done === total) return 'green';
                return 'muted';
              };
              return (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/app/invoices/${r.id}`)}
                  className="border-t border-border hover:bg-muted/20 cursor-pointer"
                >
                  <td className="px-4 py-3 text-accent">{r.invoice_number}</td>
                  <td className="px-4 py-3">{r.v2_exporters?.company_name ?? '—'}</td>
                  <td className="px-4 py-3">{r.v2_buyers?.company_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.invoice_currency} {Number(r.invoice_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s ? (
                      <>
                        <Chip label="S1" done={s.s1Done} total={s.s1Total} tone={tone(s.s1Done, s.s1Total)} />
                        <Chip label="S2" done={s.s2Done} total={s.s2Total} tone={tone(s.s2Done, s.s2Total)} />
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {INVOICE_STATUS_LABEL[r.status] ?? r.status}
                    {slaAtRisk(r) && <span className="ml-2 text-[11px] text-amber-400">SLA at risk</span>}
                  </td>
                  <td className="px-4 py-3">{r.maturity_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    {Number(r.days_past_maturity ?? 0) > 0
                      ? <span className="text-destructive">{r.days_past_maturity} days past{r.escalation_stage ? ` · ${ESCALATION_LABEL[r.escalation_stage] ?? r.escalation_stage}` : ''}</span>
                      : <span className="text-muted-foreground">Current</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No applications</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
