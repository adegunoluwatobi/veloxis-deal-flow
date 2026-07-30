import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openDocument } from '@/v2/lib/documents';
import { AlertTriangle, FileText } from 'lucide-react';

type Headroom = {
  authorised_limit: number; limit_currency: string; limit_basis: string;
  committed_exposure: number; headroom: number;
};

const money = (n: number, ccy = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: ccy || 'GBP', maximumFractionDigits: 2 }).format(Number(n || 0));

const basisLine = (b: string) =>
  b === 'advance_outstanding' ? 'Limit applies to funds advanced' : 'Limit applies to invoice face value';

export type AuthorityFlags = {
  amberHeadroom: boolean;
  expiringSoon: boolean;
  signatoryMismatch: boolean;
  resolutionVerified: boolean;
  inDate: boolean;
  withinHeadroom: boolean;
};

export default function CompanyAuthorityPanel({
  exporterId, signatoryId, invoiceExposure, onFlags,
}: {
  exporterId: string; signatoryId: string | null; invoiceExposure: number;
  onFlags?: (f: AuthorityFlags) => void;
}) {
  const [res, setRes] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [signatories, setSignatories] = useState<any[]>([]);
  const [hr, setHr] = useState<Headroom | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: r } = await supabase
      .from('board_resolutions')
      .select('*')
      .eq('exporter_id', exporterId)
      .is('superseded_by', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRes(r ?? null);
    if (r) {
      const [{ data: cd }, { data: sg }, { data: h }] = await Promise.all([
        supabase.from('company_documents').select('id, original_filename').eq('id', r.company_document_id).maybeSingle(),
        supabase.from('authorised_signatories').select('*').eq('board_resolution_id', r.id),
        supabase.rpc('exporter_headroom', { p_exporter_id: exporterId }),
      ]);
      setDoc(cd ?? null);
      setSignatories(sg ?? []);
      setHr((Array.isArray(h) ? h[0] : h) as Headroom);
    }
    setLoading(false);
  }, [exporterId]);

  useEffect(() => { load(); }, [load]);

  const verified = res?.verification_status === 'verified';
  const validUntil = res?.valid_until ? new Date(res.valid_until) : null;
  const today = new Date(new Date().toDateString());
  const inDate = !!validUntil && validUntil >= today;
  const daysLeft = validUntil ? Math.round((validUntil.getTime() - today.getTime()) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 30;
  const limit = Number(res?.authorised_limit ?? 0);
  const headroom = Number(hr?.headroom ?? 0);
  const amberHeadroom = !!hr && limit > 0 && headroom < limit * 0.2;
  const signatoryMismatch = !!signatoryId && signatories.length > 0 && !signatories.some((s) => s.id === signatoryId);
  const withinHeadroom = !hr || invoiceExposure <= headroom;

  useEffect(() => {
    onFlags?.({ amberHeadroom, expiringSoon, signatoryMismatch, resolutionVerified: verified, inDate, withinHeadroom });
  }, [amberHeadroom, expiringSoon, signatoryMismatch, verified, inDate, withinHeadroom, onFlags]);

  if (loading) return <section className="card-elevated p-5 text-sm text-muted-foreground">Loading company authority…</section>;

  if (!res) {
    return (
      <section className="card-elevated p-5 border-destructive/50">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Company authority</h3>
        <p className="text-sm text-destructive">No board resolution on file. The exporter must upload one to company documents and a reviewer must verify it before a resolution record can be created.</p>
      </section>
    );
  }

  return (
    <section className={cn('card-elevated p-5 space-y-3',
      (!verified || !inDate || signatoryMismatch || !withinHeadroom) ? 'border-destructive/50'
        : amberHeadroom || expiringSoon ? 'border-amber-500/50' : '')}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Company authority</h3>
        <span className={cn('text-xs px-2 py-0.5 rounded border',
          verified ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-destructive/30 text-destructive bg-destructive/10')}>
          {verified ? 'Verified' : (res.verification_status ?? 'Pending')}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <Line label="Authorised limit">{money(limit, res.limit_currency)} {res.limit_currency}</Line>
        <Line label="Limit basis">{basisLine(res.limit_basis)}</Line>
        <Line label="Valid from">{res.valid_from ?? '—'}</Line>
        <Line label="Valid until">{res.valid_until ?? '—'}</Line>
        <Line label="Committed exposure">{hr ? `${money(Number(hr.committed_exposure), hr.limit_currency)}` : '—'}</Line>
        <Line label="Headroom remaining">{hr ? money(headroom, hr.limit_currency) : '—'}</Line>
      </div>

      <div className="text-sm">
        <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Named signatories</div>
        {signatories.length === 0
          ? <p className="text-muted-foreground">None recorded.</p>
          : <ul className="space-y-0.5">{signatories.map((s) => <li key={s.id}>{s.full_name}{s.position ? ` · ${s.position}` : ''}</li>)}</ul>}
      </div>

      {doc && (
        <Button size="sm" variant="outline" onClick={() => openDocument(doc.id, 'company')}>
          <FileText className="h-4 w-4 mr-2" /> {doc.original_filename ?? 'Source resolution'}
        </Button>
      )}

      {res.notes && <p className="text-xs text-muted-foreground">Reviewer notes: {res.notes}</p>}

      {expiringSoon && inDate && <Flag tone="red">This resolution expires in {daysLeft} days.</Flag>}
      {!inDate && <Flag tone="red">This resolution has expired.</Flag>}
      {amberHeadroom && <Flag tone="amber">Headroom is under twenty percent of the authorised limit.</Flag>}
      {!withinHeadroom && <Flag tone="red">This application exceeds the headroom remaining.</Flag>}
      {signatoryMismatch && <Flag tone="red">Submitted by a person not named in the board resolution</Flag>}

      <p className="text-xs text-muted-foreground">
        Limits are recorded in GBP. Where the resolution is denominated in another currency, the reviewer converts at the rate in force on the resolution date and records the original wording and rate in notes. A replacement resolution is recorded through the supersede action, never as a second active record.
      </p>
    </section>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right">{children}</span></div>;
}

function Flag({ tone, children }: { tone: 'red' | 'amber'; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-start gap-2 text-sm rounded border p-2',
      tone === 'red' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-amber-500/40 bg-amber-500/10 text-amber-400')}>
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
