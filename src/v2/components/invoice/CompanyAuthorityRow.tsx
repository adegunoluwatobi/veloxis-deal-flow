import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { openDocument } from './DocumentUploadRow';

export type Headroom = null;

export type AuthorityState = {
  loading: boolean;
  resolutionId: string | null;
  companyDocumentId: string | null;
  filename: string | null;
  verifiedAt: string | null;
  validUntil: string | null;
  headroom: Headroom;
  /** Null when the authority row is satisfied, otherwise the blocking message. */
  blockMessage: string | null;
};

/**
 * Loads the active verified board resolution. Resolutions carry no monetary
 * limit — only validity (verified, in date, not superseded) is enforced.
 */
export function useCompanyAuthority(exporterId: string | null, invoiceExposure: number): AuthorityState {
  const [state, setState] = useState<AuthorityState>({
    loading: true, resolutionId: null, companyDocumentId: null, filename: null,
    verifiedAt: null, validUntil: null, headroom: null, blockMessage: null,
  });

  const load = useCallback(async () => {
    if (!exporterId) return;
    const { data: res } = await supabase
      .from('board_resolutions')
      .select('id, company_document_id, verified_at, valid_until, verification_status, superseded_by')
      .eq('exporter_id', exporterId)
      .eq('verification_status', 'verified')
      .is('superseded_by', null)
      .maybeSingle();

    if (!res) {
      setState((s) => ({
        ...s, loading: false, resolutionId: null, headroom: null,
        blockMessage: 'Your board resolution has not been uploaded or verified yet',
      }));
      return;
    }

    const { data: cd } = await supabase
      .from('company_documents')
      .select('id, original_filename')
      .eq('id', res.company_document_id)
      .maybeSingle();

    let block: string | null = null;
    if (res.valid_until && new Date(res.valid_until) < new Date(new Date().toDateString())) {
      block = `Your board resolution expired on ${new Date(res.valid_until).toLocaleDateString()}. Please upload a current one`;
    }

    setState({
      loading: false,
      resolutionId: res.id,
      companyDocumentId: res.company_document_id,
      filename: cd?.original_filename ?? 'Board resolution',
      verifiedAt: res.verified_at,
      validUntil: res.valid_until,
      headroom: null,
      blockMessage: block,
    });
  }, [exporterId]);

  useEffect(() => { load(); }, [load]);
  return state;
}

export default function CompanyAuthorityRow({
  state,
  onBeforeLeave,
}: {
  state: AuthorityState;
  /** Autosaves the draft before we send the exporter off to My Company. */
  onBeforeLeave?: () => Promise<void> | void;
}) {
  const { loading, blockMessage, filename, verifiedAt, validUntil, companyDocumentId, resolutionId } = state;
  const ok = !loading && !blockMessage && !!resolutionId;
  const missingOrExpired = !loading && !!blockMessage;

  const openMyCompany = async () => {
    try { await onBeforeLeave?.(); } catch { /* the draft save is best effort */ }
    window.open('/portal/profile', '_blank', 'noopener');
  };


  return (
    <div className={cn(
      'rounded-md border p-4',
      ok ? 'border-emerald-500/40' : !loading ? 'border-destructive/50 bg-destructive/5' : '',
    )}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            Company authority<span className="text-destructive">*</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The verified board resolution that authorises this facility.
          </p>
        </div>
        {ok
          ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Satisfied</Badge>
          : !loading && <Badge variant="destructive">Blocking</Badge>}
      </div>

      {loading && <p className="mt-3 text-xs text-muted-foreground">Checking your board resolution…</p>}

      {!loading && resolutionId && (
        <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
          {companyDocumentId && (
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <button type="button" className="text-accent hover:underline" onClick={() => openDocument(companyDocumentId, 'company')}>
                {filename}
              </button>
            </div>
          )}
          <div className="text-muted-foreground">
            Verified {verifiedAt ? new Date(verifiedAt).toLocaleDateString() : '—'}
          </div>
          <div className="text-muted-foreground sm:col-span-2">
            Valid until {validUntil ? new Date(validUntil).toLocaleDateString() : '—'} — a new resolution is required once it expires or your directors change.
          </div>
        </div>
      )}

      {!loading && blockMessage && (
        <div className="mt-3 space-y-2">
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {blockMessage}
          </p>
          {(missingOrExpired || blockMessage.includes('expired')) && (
            <button type="button" onClick={openMyCompany} className="text-xs text-accent hover:underline">
              Upload board resolution
            </button>
          )}
        </div>
      )}

    </div>
  );
}
