import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { usePeople } from '@/v2/components/ReviewChain';
import { Download, ShieldAlert } from 'lucide-react';

type Line = {
  kind: 'Exporter' | 'Application';
  id: string;
  label: string;
  href: string;
  reason: string | null;
  by: string | null;
  at: string | null;
};

export default function SingleReviewerReport() {
  const [lines, setLines] = useState<Line[]>([]);
  const people = usePeople();

  useEffect(() => {
    (async () => {
      const [{ data: exps }, { data: invs }] = await Promise.all([
        supabase.from('v2_exporters')
          .select('id, company_name, single_reviewer_reason, single_reviewer_by, single_reviewer_at')
          .eq('single_reviewer_approved', true)
          .order('single_reviewer_at', { ascending: false }),
        supabase.from('v2_invoices')
          .select('id, invoice_number, reference, single_reviewer_reason, single_reviewer_by, single_reviewer_at')
          .eq('single_reviewer_approved', true)
          .order('single_reviewer_at', { ascending: false }),
      ]);
      const rows: Line[] = [
        ...(exps ?? []).map((e: any) => ({
          kind: 'Exporter' as const, id: e.id, label: e.company_name,
          href: `/app/exporters/${e.id}`, reason: e.single_reviewer_reason,
          by: e.single_reviewer_by, at: e.single_reviewer_at,
        })),
        ...(invs ?? []).map((i: any) => ({
          kind: 'Application' as const, id: i.id, label: i.reference || i.invoice_number,
          href: `/app/invoices/${i.id}`, reason: i.single_reviewer_reason,
          by: i.single_reviewer_by, at: i.single_reviewer_at,
        })),
      ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
      setLines(rows);
    })();
  }, []);

  const csv = () => {
    const head = 'Type,Record,Approved by,Date,Reason\n';
    const body = lines.map((l) =>
      [l.kind, l.label, people[l.by ?? ''] ?? '', l.at ?? '', (l.reason ?? '').replace(/"/g, '""')]
        .map((v) => `"${v}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([head + body], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'single-reviewer-approvals.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">Single reviewer approvals</h1>
          <p className="text-sm text-muted-foreground">
            Every exporter and application approved without a second reviewer, with the recorded reason and date.
          </p>
        </div>
        <Button variant="outline" onClick={csv} disabled={lines.length === 0}>
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      <section className="card-elevated p-5">
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No single reviewer overrides have been applied. Every approval so far had two reviewers.
          </p>
        )}
        <div className="space-y-3">
          {lines.map((l) => (
            <div key={`${l.kind}-${l.id}`} className="border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-warning" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{l.kind}</span>
                  <Link to={l.href} className="text-accent hover:underline">{l.label}</Link>
                </span>
                <span className="text-xs text-muted-foreground">
                  {people[l.by ?? ''] ?? 'Unknown'} · {l.at ? new Date(l.at).toLocaleString('en-GB') : '—'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{l.reason || 'No reason recorded.'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
