import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const INSTRUMENT_CODES = ['notice_of_assignment', 'deed_of_assignment', 'domiciliation_instruction'] as const;
export type InstrumentCode = typeof INSTRUMENT_CODES[number];

export const INSTRUMENT_LABEL: Record<string, string> = {
  notice_of_assignment: 'Notice of assignment',
  deed_of_assignment: 'Deed of assignment',
  domiciliation_instruction: 'Domiciliation instruction',
};

export const SIGNER_ROLE_LABEL: Record<string, string> = {
  exporter_signatory: 'Your authorised signatory',
  veloxis_countersignatory: 'Veloxis countersignature',
  veloxis_approver: 'Veloxis approver',
};

export type SignatureRequest = {
  id: string; invoice_id: string; document_id: string | null; provider_request_id: string | null;
  signer_role: string; signer_name: string | null; signer_email: string | null; status: string;
  sent_at: string | null; completed_at: string | null; certificate_path: string | null;
};

export type InstrumentRow = {
  code: InstrumentCode;
  label: string;
  typeId: string | null;
  document: any | null;
  requests: SignatureRequest[];
  state: 'preparing' | 'awaiting_signature' | 'signed' | 'declined';
  signedAt: string | null;
};

export function useInstruments(invoiceId: string | undefined) {
  const [types, setTypes] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!invoiceId) return;
    const [{ data: t }, { data: d }, { data: r }] = await Promise.all([
      supabase.from('document_types').select('id, code, label').in('code', INSTRUMENT_CODES as unknown as string[]).eq('level', 'invoice'),
      supabase.from('invoice_documents').select('*').eq('invoice_id', invoiceId).eq('source', 'veloxis_generated').order('version', { ascending: false }),
      supabase.from('invoice_signature_requests').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    ]);
    setTypes(t ?? []); setDocs(d ?? []); setRequests((r ?? []) as SignatureRequest[]);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { reload(); }, [reload]);

  const rows = useMemo<InstrumentRow[]>(() => INSTRUMENT_CODES.map((code) => {
    const type = types.find((t) => t.code === code) ?? null;
    const versions = docs.filter((d) => d.document_type_id === type?.id);
    const document = versions.find((d) => !d.superseded_by) ?? versions[0] ?? null;
    const docIds = new Set(versions.map((v) => v.id));
    const reqs = requests.filter((r) => r.document_id && docIds.has(r.document_id));
    const live = reqs.filter((r) => r.status !== 'expired');
    const state: InstrumentRow['state'] =
      live.some((r) => r.status === 'declined') ? 'declined'
        : live.length > 0 && live.every((r) => r.status === 'signed') ? 'signed'
          : live.length > 0 ? 'awaiting_signature'
            : 'preparing';
    const signedAt = state === 'signed'
      ? live.map((r) => r.completed_at).filter(Boolean).sort().slice(-1)[0] ?? null
      : null;
    return { code, label: INSTRUMENT_LABEL[code], typeId: type?.id ?? null, document, requests: reqs, state, signedAt };
  }), [types, docs, requests]);

  const allSigned = rows.length === 3 && rows.every((r) => r.state === 'signed' && r.requests.some((q) => q.certificate_path));

  return { loading, rows, reload, allSigned };
}
