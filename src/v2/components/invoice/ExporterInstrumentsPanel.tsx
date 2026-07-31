import { useInstruments, SIGNER_ROLE_LABEL, TEST_MODE_LABEL, useEsignatureMode } from '@/v2/lib/instruments';
import { cn } from '@/lib/utils';
import { ExternalLink, FileSignature } from 'lucide-react';

const STATE_LABEL = {
  preparing: 'Preparing',
  awaiting_signature: 'Awaiting your signature',
  signed: 'Signed',
  declined: 'Declined',
} as const;

const STATE_CLASS = {
  preparing: 'bg-muted text-muted-foreground border-border',
  awaiting_signature: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  signed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  declined: 'bg-destructive/15 text-destructive border-destructive/30',
} as const;

export default function ExporterInstrumentsPanel({ invoiceId }: { invoiceId: string | undefined }) {
  const { rows, loading } = useInstruments(invoiceId);
  const { isTest } = useEsignatureMode();

  return (
    <div className="space-y-2">
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows.map((r) => {
        const mine = r.requests.find((q) => q.signer_role === 'exporter_signatory' && q.status !== 'expired');
        const awaitingMe = r.state === 'awaiting_signature' && mine && ['sent', 'viewed'].includes(mine.status);
        const state = r.document ? r.state : 'preparing';
        return (
          <div key={r.code} className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-muted-foreground" /> {r.label}
              </div>
              {isTest && (
                <div className="mt-1 mb-1 text-xs px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 inline-block">
                  {TEST_MODE_LABEL}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {state === 'signed' && r.signedAt
                  ? `Signed on ${new Date(r.signedAt).toLocaleDateString('en-GB')}`
                  : state === 'awaiting_signature' && mine
                    ? `${SIGNER_ROLE_LABEL[mine.signer_role]} · sent ${mine.sent_at ? new Date(mine.sent_at).toLocaleDateString('en-GB') : ''}`
                    : state === 'declined'
                      ? 'This document was declined. We will be in touch.'
                      : 'We are preparing this document for you.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs px-2 py-0.5 rounded border whitespace-nowrap', STATE_CLASS[state])}>
                {STATE_LABEL[state]}
              </span>
              {awaitingMe && (
                <a
                  href="https://app.hellosign.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                >
                  Sign now <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
