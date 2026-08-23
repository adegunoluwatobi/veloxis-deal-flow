import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { openDocument, companyDocPath } from '@/v2/lib/documents';
import { useAuth } from '@/v2/useAuth';
import { FileText, Upload } from 'lucide-react';
import { sniffFileType, contentTypeFor, MISMATCH_MESSAGE } from '@/v2/lib/fileSniff';


type Resolution = {
  id: string;
  valid_from: string;
  valid_until: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  rejection_reason: string | null;
  company_document_id: string | null;
  renewal_required: boolean;
  renewal_reason: string | null;
};

type Doc = { id: string; original_filename: string | null; status: string; uploaded_at: string };
type Signatory = { id: string; full_name: string; position: string | null; email: string | null; phone: string | null };

const PILL: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  verified: 'bg-primary/20 text-accent',
  rejected: 'bg-destructive/20 text-destructive',
  expired: 'bg-destructive/20 text-destructive',
};



export default function BoardResolutionCard({ exporterId }: { exporterId?: string }) {
  const { user } = useAuth();
  const [res, setRes] = useState<Resolution | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [sigs, setSigs] = useState<Signatory[]>([]);
  const [committed, setCommitted] = useState<number | null>(0);
  const [headroomError, setHeadroomError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!exporterId) { setLoading(false); return; }
    setLoading(true);

    const { data: r } = await supabase
      .from('board_resolutions')
      .select('id, valid_from, valid_until, verification_status, rejection_reason, company_document_id, renewal_required, renewal_reason')
      .eq('exporter_id', exporterId)
      .is('superseded_by', null)
      .maybeSingle();
    setRes((r as Resolution) ?? null);


    if (r?.company_document_id) {
      const { data: d } = await supabase
        .from('company_documents')
        .select('id, original_filename, status, uploaded_at')
        .eq('id', r.company_document_id)
        .maybeSingle();
      setDoc((d as Doc) ?? null);
    } else {
      // No resolution record yet — surface the most recent board-resolution upload.
      const { data: dt } = await supabase.from('document_types').select('id').eq('code', 'board_resolution').maybeSingle();
      if (dt) {
        const { data: d } = await supabase
          .from('company_documents')
          .select('id, original_filename, status, uploaded_at')
          .eq('exporter_id', exporterId)
          .eq('document_type_id', dt.id)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setDoc((d as Doc) ?? null);
      }
    }

    if (r?.id) {
      const { data: s } = await supabase
        .from('authorised_signatories')
        .select('id, full_name, position, email')
        .eq('board_resolution_id', r.id)
        .order('full_name');
      setSigs((s as Signatory[]) ?? []);
    } else {
      setSigs([]);
    }

    const { data: hr, error: hrErr } = await supabase.rpc('exporter_headroom', { p_exporter_id: exporterId });
    if (hrErr) {
      setHeadroomError(hrErr.message);
      setCommitted(null);
    } else {
      setHeadroomError(null);
      const row: any = Array.isArray(hr) ? hr[0] : hr;
      setCommitted(row ? Number(row.committed_exposure ?? 0) : null);
    }


    setLoading(false);
  }, [exporterId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !exporterId) return;
    setUploading(true);
    try {
      // Type comes from the file's own leading bytes, not its extension.
      const sniffed = await sniffFileType(file);
      if (!sniffed) throw new Error(MISMATCH_MESSAGE);
      const { data: dt } = await supabase.from('document_types').select('id').eq('code', 'board_resolution').maybeSingle();
      if (!dt) throw new Error('Board resolution document type is not configured.');
      const path = companyDocPath(exporterId, 'board-resolution', file.name);
      const { error: upErr } = await supabase.storage.from('veloxis-documents')
        .upload(path, file, { contentType: contentTypeFor(sniffed) });
      if (upErr) throw upErr;
      const { data: inserted, error: insErr } = await supabase.from('company_documents').insert({
        exporter_id: exporterId,
        document_type_id: dt.id,
        storage_path: path,
        original_filename: file.name,
        file_size_bytes: file.size,
        uploaded_by: user?.id ?? null,
      }).select('id').single();
      if (insErr) throw insErr;

      const { data: scan } = await supabase.functions.invoke('scan-document', {
        body: { document_id: inserted.id, document_kind: 'company' },
      });
      if ((scan as any)?.scan_status && (scan as any).scan_status !== 'clean') {
        throw new Error((scan as any).message ?? MISMATCH_MESSAGE);
      }
      toast({ title: 'Board resolution uploaded', description: 'It will appear as verified once a reviewer signs it off.' });
      load();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };


  if (loading) {
    return (
      <section className="card-elevated p-6">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Board resolution</h2>
        <p className="text-sm text-muted-foreground mt-3">Loading…</p>
      </section>
    );
  }

  const expired = res?.verification_status === 'verified' && new Date(res.valid_until) < new Date();
  const status = expired ? 'expired' : res?.verification_status ?? doc?.status ?? null;
  const needsReplacement = !!res?.renewal_required || expired;

  const uploadControl = (
    <label className={`inline-flex items-center gap-2 text-sm px-3 py-2 rounded border border-border cursor-pointer hover:bg-muted/20 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
      <Upload className="h-4 w-4" />
      {uploading ? 'Uploading…' : 'Upload board resolution'}
      <input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png" onChange={upload} />
    </label>
  );

  return (
    <section className="card-elevated p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Board resolution</h2>
        {status && <span className={`text-xs px-2 py-0.5 rounded ${PILL[status] ?? PILL.pending}`}>{status}</span>}
      </div>

      {doc ? (
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <button onClick={() => openDocument(doc.id, 'company')} className="text-accent hover:underline truncate">
            {doc.original_filename ?? 'Board resolution'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No board resolution on file.</p>
      )}

      {res?.verification_status === 'rejected' && res.rejection_reason && (
        <div className="rounded border border-destructive/60 bg-destructive/10 p-3 text-sm">
          <div className="font-medium text-destructive">Rejected by reviewer</div>
          <p className="mt-1">{res.rejection_reason}</p>
        </div>
      )}

      {res?.renewal_required && (
        <div className="rounded border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-400">
          {res.renewal_reason ?? 'A replacement board resolution is required.'}
        </div>
      )}

      {res?.verification_status === 'verified' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row label="Passed on">{res.valid_from}</Row>
            <Row label="Expires">{res.valid_until}</Row>
          </div>
          <p className="text-xs text-muted-foreground">
            A board resolution stays valid for one year from the date it was passed. We will ask for a
            replacement when it expires, or whenever your board of directors changes.
          </p>



          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Named signatories</div>
            {sigs.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {sigs.map((s) => (
                  <li key={s.id}>
                    {s.full_name}
                    {s.position && <span className="text-muted-foreground"> · {s.position}</span>}
                    {s.email && <span className="text-muted-foreground"> · {s.email}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {expired && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">This resolution expired on {res.valid_until}. Upload a replacement for review.</p>
              {uploadControl}
            </div>
          )}
        </div>
      )}

      {!res && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We cannot review an invoice until your board resolution is verified.
          </p>
          {uploadControl}
        </div>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
