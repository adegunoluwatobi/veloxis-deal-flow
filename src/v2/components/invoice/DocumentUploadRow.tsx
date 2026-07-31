import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UploadCloud, FileText, RefreshCw, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import { sniffFileType, contentTypeFor, MISMATCH_MESSAGE, SCAN_PENDING_MESSAGE } from '@/v2/lib/fileSniff';

export const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp';
export const MAX_BYTES = 20 * 1024 * 1024;
const BUCKET = 'veloxis-documents';


export type UploadedDoc = {
  id: string;
  document_type_id: string;
  original_filename: string;
  file_size_bytes: number | null;
  status: string;
  uploaded_at: string;
  storage_path: string;
  scan_status?: string | null;
};


export const humanSize = (b?: number | null) =>
  !b ? '' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const sanitize = (name: string) =>
  name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

/** Upload with real progress via XHR against the Storage REST endpoint. */
async function uploadWithProgress(path: string, file: File, onProgress: (pct: number) => void) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error('Your session has expired. Please sign in again.');
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'false');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`Upload failed (${xhr.status}). ${xhr.responseText?.slice(0, 200) ?? ''}`)));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(file);
  });
}

export async function openDocument(documentId: string, kind: 'invoice' | 'company') {
  const { data, error } = await supabase.functions.invoke('get-document-url', {
    body: { document_id: documentId, document_kind: kind },
  });
  if (error || !(data as any)?.url) {
    toast({ title: 'Could not open the document', description: error?.message ?? 'Please try again.', variant: 'destructive' });
    return;
  }
  window.open((data as any).url, '_blank', 'noopener');
}

type Props = {
  label: string;
  description?: string | null;
  note?: string | null;
  documentTypeId: string;
  invoiceId: string | null;
  exporterId: string;
  docs: UploadedDoc[];
  required?: boolean;
  accent?: 'amber' | 'default';
  readOnly?: boolean;
  disabledReason?: string | null;
  onUploaded: () => void;
};

export default function DocumentUploadRow({
  label, description, note, documentTypeId, invoiceId, exporterId, docs,
  required, accent = 'default', readOnly, disabledReason, onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const doUpload = useCallback(async (file: File) => {
    setError(null);
    setLastFile(file);
    if (!invoiceId) { setError('Save your invoice details first, then upload.'); return; }
    if (!ACCEPTED.includes(file.type)) { setError('That file type is not accepted. Use PDF, JPG, PNG or WEBP.'); return; }
    if (file.size > MAX_BYTES) { setError('That file is larger than 20 MB. Please upload a smaller file.'); return; }

    setProgress(1);
    const path = `${exporterId}/invoices/${invoiceId}/${Date.now()}_${sanitize(file.name)}`;
    try {
      await uploadWithProgress(path, file, setProgress);
      const { error: insErr } = await supabase.from('invoice_documents').insert({
        invoice_id: invoiceId,
        document_type_id: documentTypeId,
        storage_path: path,
        original_filename: file.name,
        file_size_bytes: file.size,
      });
      if (insErr) throw new Error(insErr.message);
      setProgress(null);
      setLastFile(null);
      toast({ title: 'Uploaded', description: `${file.name} added to ${label}.` });
      onUploaded();
    } catch (e: any) {
      setProgress(null);
      setError(e?.message ?? 'Upload failed. Please try again.');
    }
  }, [invoiceId, exporterId, documentTypeId, label, onUploaded]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (readOnly || disabledReason) return;
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const satisfied = docs.length > 0;

  return (
    <div className={cn(
      'rounded-md border p-4',
      accent === 'amber' && 'border-amber-500/50 bg-amber-500/5',
      satisfied && accent !== 'amber' && 'border-emerald-500/40',
    )}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {label}{required && <span className="text-destructive"> *</span>}
          </div>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          {note && <p className="mt-1 text-xs text-amber-600">{note}</p>}
        </div>
        {satisfied && <Badge variant="secondary">{docs.length} file{docs.length === 1 ? '' : 's'}</Badge>}
      </div>

      {docs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <button type="button" className="text-accent hover:underline" onClick={() => openDocument(d.id, 'invoice')}>
                {d.original_filename}
              </button>
              <span className="text-muted-foreground">{humanSize(d.file_size_bytes)}</span>
              <Badge variant={d.status === 'verified' ? 'default' : d.status === 'rejected' ? 'destructive' : 'secondary'}>
                {d.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !disabledReason && inputRef.current?.click()}
            className={cn(
              'mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground transition-colors',
              dragging && 'border-primary bg-primary/5',
              disabledReason && 'cursor-not-allowed opacity-60',
            )}
          >
            <UploadCloud className="h-4 w-4" />
            {disabledReason
              ? disabledReason
              : docs.length > 0
                ? 'Drag and drop to add or replace · PDF, JPG, PNG, WEBP · 20 MB max'
                : 'Drag and drop, or click to browse · PDF, JPG, PNG, WEBP · 20 MB max'}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) doUpload(f); }}
          />
        </>
      )}

      {progress !== null && (
        <div className="mt-3 space-y-1">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
        </div>
      )}

      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <span>{error}</span>
          {lastFile && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => doUpload(lastFile)}>
              <RefreshCw className="mr-1 h-3 w-3" />Try again
            </Button>
          )}
        </div>
      )}

      {!readOnly && docs.length > 0 && !disabledReason && (
        <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" onClick={() => inputRef.current?.click()}>
          Replace
        </Button>
      )}
    </div>
  );
}
