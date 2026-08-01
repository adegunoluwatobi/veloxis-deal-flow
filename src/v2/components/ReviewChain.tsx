import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert } from 'lucide-react';

const STAGE_LABEL: Record<string, string> = {
  bd: 'Business Developer',
  compliance: 'Credit & Compliance',
};
const DECISION_LABEL: Record<string, string> = {
  approved: 'Approved',
  returned: 'Returned to exporter',
  rejected: 'Rejected',
};

export type ReviewRow = {
  id: string;
  stage: string;
  decision: string;
  note: string | null;
  reviewer_id: string | null;
  single_reviewer_override: boolean;
  override_reason: string | null;
  created_at: string;
};

export function usePeople() {
  const [people, setPeople] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from('profiles').select('user_id, name, email').then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { m[p.user_id] = p.name || p.email; });
      setPeople(m);
    });
  }, []);
  return people;
}

export default function ReviewChain({ exporterId }: { exporterId: string }) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const people = usePeople();

  useEffect(() => {
    supabase.from('onboarding_reviews').select('*').eq('exporter_id', exporterId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setRows((data ?? []) as ReviewRow[]));
  }, [exporterId]);

  return (
    <section className="card-elevated p-5">
      <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Review chain</h3>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No review decisions recorded yet.</p>}
      <ol className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="border-t border-border pt-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {STAGE_LABEL[r.stage] ?? r.stage} · {DECISION_LABEL[r.decision] ?? r.decision}
              </span>
              <span className="text-xs text-muted-foreground">
                {people[r.reviewer_id ?? ''] ?? 'Unknown reviewer'} · {new Date(r.created_at).toLocaleString('en-GB')}
              </span>
            </div>
            {r.note && <p className="text-xs text-muted-foreground mt-1">{r.note}</p>}
            {r.single_reviewer_override && (
              <p className="mt-2 inline-flex items-start gap-2 rounded border border-warning/50 bg-warning/10 px-2 py-1 text-xs text-warning">
                <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Single reviewer override applied. {r.override_reason}</span>
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SingleReviewerBanner({ reason, at }: { reason?: string | null; at?: string | null }) {
  return (
    <div className="card-elevated p-4 border-warning/50 bg-warning/10 text-sm flex items-start gap-2">
      <ShieldAlert className="h-4 w-4 mt-0.5 text-warning shrink-0" />
      <div>
        <div className="font-medium text-warning">Approved by a single reviewer</div>
        <div className="text-xs text-muted-foreground mt-1">
          {reason || 'No reason recorded.'}{at ? ` · ${new Date(at).toLocaleString('en-GB')}` : ''}
        </div>
      </div>
    </div>
  );
}
