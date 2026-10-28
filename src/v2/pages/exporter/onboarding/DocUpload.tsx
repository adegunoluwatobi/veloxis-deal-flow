import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { fileError, issueDateError } from '@/v2/lib/onboardingRules';
import type { Doc } from './useOnboarding';

export default function DocUpload({
  label, hint, required, optional, multiple, needsIssueDate, photoOnly, files, locked, error, onUpload,
}: {
  label: string; hint?: string; required?: boolean; optional?: boolean; multiple?: boolean;
  needsIssueDate?: boolean; photoOnly?: boolean; files: Doc[]; locked?: boolean; error?: string | null;
  onUpload: (file: File, issueDate: string | null) => Promise<void>;
}) {
  const [issueDate, setIssueDate] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const latestDoc = files[0];
  const rejected = latestDoc?.status === 'rejected';
  const canUpload = !locked || rejected;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!list.length) return;
    setLocalErr(null);
    if (needsIssueDate) {
      const ie = issueDateError(issueDate);
      if (ie) { setLocalErr(ie); return; }
    }
    for (const file of list) {
      const fe = fileError(file, { photoOnly });
      if (fe) { setLocalErr(`${file.name}: ${fe}`); return; }
    }
    for (const file of list) {
      setBusy(file.name);
      try { await onUpload(file, needsIssueDate ? issueDate : null); toast({ title: 'Uploaded', description: file.name }); }
      catch (err: any) { setLocalErr(err?.message ?? 'Upload failed. Please try again.'); break; }
      finally { setBusy(null); }
    }
  };

  const shownErr = localErr ?? error;
  const accept = photoOnly ? '.jpg,.jpeg,.png' : '.pdf,.jpg,.jpeg,.png';

  return (
    <div className="border-t border-border pt-3 first:border-t-0 first:pt-0" data-invalid={shownErr ? 'true' : undefined}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive"> *</span>}
            {optional && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">Optional</span>}
          </div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
          <div className="mt-1.5 space-y-1">
            {(multiple ? files : files.slice(0, 1)).map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded bg-primary/15 px-2 py-1 text-accent max-w-full">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[14rem]">{d.original_filename || 'Uploaded'}</span>
                </span>
                {d.issue_date && <span className="text-muted-foreground">Issued {new Date(d.issue_date).toLocaleDateString('en-GB')}</span>}
                {d.status === 'verified' && <span className="rounded bg-primary/20 px-2 py-0.5 text-accent">Verified</span>}
                {d.status === 'pending' && <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">Awaiting review</span>}
                {d.status === 'rejected' && <span className="rounded bg-destructive/20 px-2 py-0.5 text-destructive">Rejected</span>}
              </div>
            ))}
            {rejected && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
                <div className="font-medium text-destructive">Please replace this document</div>
                <div>{latestDoc.rejection_reason || 'No reason was recorded.'}</div>
              </div>
            )}
          </div>
        </div>
        {canUpload && (
          <div className="flex flex-col gap-2 sm:items-end">
            {needsIssueDate && (
              <label className="text-xs text-muted-foreground">
                Issue date
                <Input type="date" className="mt-1 h-8 w-full sm:w-40" value={issueDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setIssueDate(e.target.value)} />
              </label>
            )}
            <label className={`inline-flex items-center justify-center gap-2 rounded border border-border px-3 py-2 text-xs ${busy ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-muted/20'}`}>
              <Upload className="h-3.5 w-3.5" />
              {busy ? `Uploading ${busy}…` : multiple && files.length ? 'Add files' : latestDoc ? 'Replace' : multiple ? 'Upload files' : 'Upload'}
              <input type="file" className="hidden" accept={accept} multiple={multiple} onChange={pick} disabled={!!busy} />
            </label>
          </div>
        )}
      </div>
      {shownErr && <p className="mt-1.5 flex items-start gap-1 text-xs text-destructive"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{shownErr}</p>}
    </div>
  );
}
