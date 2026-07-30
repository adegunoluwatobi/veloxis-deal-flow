import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { OptionSelect, ID_TYPES, COUNTRIES, NIGERIAN_BANKS } from '@/v2/lib/formOptions';
import { CheckCircle2, Upload, Clock, AlertCircle, Lock } from 'lucide-react';
import AdditionalDirectors from '@/v2/components/AdditionalDirectors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';


type DocType = 'cac_certificate' | 'director_id' | 'proof_of_address' | 'bank_proof';

const REQUIRED_DOCS: { key: DocType; label: string; hint: string }[] = [
  { key: 'cac_certificate', label: 'Company registration document', hint: 'CAC certificate / Certificate of Incorporation (RC).' },
  { key: 'director_id', label: 'Director government ID', hint: 'Passport, national ID or driver’s licence.' },
  { key: 'proof_of_address', label: 'Director proof of address', hint: 'Utility bill or bank statement, dated within 3 months.' },
  { key: 'bank_proof', label: 'Bank details / statement', hint: 'Recent bank statement or a signed bank confirmation letter.' },
];

export default function ExporterOnboarding() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [exp, setExp] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [submittedOpen, setSubmittedOpen] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploadingName, setUploadingName] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<Record<string, { file: File; message: string }>>({});


  const load = useCallback(async () => {
    const { data: rows } = await supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).order('created_at', { ascending: true }).limit(1);
    const e = rows?.[0] ?? null;
    setExp(e);
    setF(e ?? {
      company_name: '', company_registration_number: '', country_of_incorporation: '', incorporation_date: '',
      tax_id: '', industry: '', commodity: '', phone: '', email: profile?.email ?? '', address: '',
      director_name: '', director_email: '', director_phone: '', director_dob: '', director_nationality: '',
      director_id_type: '', director_id_number: '', director_address: '',
      bank_details: { bank_name: '', account_name: '', account_number: '', swift: '' },
    });
    if (e?.id) {
      const { data: d } = await supabase.from('v2_exporter_documents').select('*').eq('exporter_id', e.id).order('uploaded_at', { ascending: false });
      setDocs(d ?? []);
    }
  }, [user, profile]);

  useEffect(() => { load(); }, [load]);

  if (!f) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const setBank = (k: string, v: string) => setF((x: any) => ({ ...x, bank_details: { ...(x.bank_details ?? {}), [k]: v } }));

  const latestDoc = (t: DocType) => docs.find((d) => d.doc_type === t);
  const missingDocs = REQUIRED_DOCS.filter((r) => !latestDoc(r.key));

  const requiredFieldsOk =
    f.company_name && f.company_registration_number && f.country_of_incorporation &&
    f.director_name && f.director_id_type && f.director_id_number &&
    f.bank_details?.bank_name && f.bank_details?.account_number;

  const saveProfile = async (): Promise<string | null> => {
    const payload: any = {
      company_name: f.company_name, rc_number: f.company_registration_number || null,
      company_registration_number: f.company_registration_number || null,
      country_of_incorporation: f.country_of_incorporation || null,
      incorporation_date: f.incorporation_date || null,
      tax_id: f.tax_id || null, industry: f.industry || null,
      commodity: f.commodity || null, phone: f.phone || null, email: f.email || null,
      address: f.address || null,
      director_name: f.director_name || null, director_email: f.director_email || null,
      director_phone: f.director_phone || null, director_dob: f.director_dob || null,
      director_nationality: f.director_nationality || null,
      director_id_type: f.director_id_type || null, director_id_number: f.director_id_number || null,
      director_address: f.director_address || null,
      bank_details: { ...(f.bank_details ?? {}), account_name: f.company_name ?? '' },
    };
    if (exp?.id) {
      const { error } = await supabase.from('v2_exporters').update(payload).eq('id', exp.id);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return null; }
      return exp.id;
    }
    const { data, error } = await supabase.from('v2_exporters').insert({
      owner_user_id: user!.id, ...payload,
      onboarding_status: 'pending', kyb_status: 'pending', kyc_status: 'pending',
    }).select('id').single();
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return null; }
    setExp((prev: any) => prev ?? { id: data.id });
    return data.id;
  };

  const uploadWithProgress = (path: string, file: File, token: string, onProgress: (pct: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/veloxis-documents/${path}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.message ?? msg; } catch { /* ignore */ }
        reject(new Error(msg));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });

  const runUpload = async (file: File, doc_type: DocType) => {
    setBusy(true);
    setUploadError((x) => { const n = { ...x }; delete n[doc_type]; return n; });
    setProgress((p) => ({ ...p, [doc_type]: 0 }));
    setUploadingName((n) => ({ ...n, [doc_type]: file.name }));
    try {
      const expId = await saveProfile();
      if (!expId) throw new Error('Could not save your company details. Check the required fields and try again.');

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Session expired — please sign in again.');
      const path = `v2/exporters/${expId}/onboarding/${doc_type}-${Date.now()}-${file.name.replace(/[^a-z0-9._-]+/gi, '_')}`;
      await uploadWithProgress(path, file, token, (pct) => setProgress((p) => ({ ...p, [doc_type]: pct })));
      const { error: insErr } = await supabase.from('v2_exporter_documents').insert({
        exporter_id: expId, doc_type, file_url: path, file_name: file.name, uploaded_by: user!.id,
      });
      if (insErr) throw new Error(insErr.message);
      await load();
      toast({ title: 'Uploaded', description: file.name });
    } catch (err: any) {
      setUploadError((x) => ({ ...x, [doc_type]: { file, message: err?.message ?? 'Upload failed. Please try again.' } }));
      toast({ title: 'Upload failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      setProgress((p) => { const n = { ...p }; delete n[doc_type]; return n; });
      setUploadingName((n) => { const x = { ...n }; delete x[doc_type]; return x; });
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>, doc_type: DocType) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    await runUpload(file, doc_type);
  };


  const submitForReview = async () => {
    if (!requiredFieldsOk) { toast({ title: 'Complete required company & director fields', variant: 'destructive' }); return; }
    if (missingDocs.length) { toast({ title: 'Upload all required documents first', variant: 'destructive' }); return; }
    setBusy(true);
    const expId = await saveProfile();
    if (!expId) { setBusy(false); return; }
    const { error } = await supabase.from('v2_exporters').update({
      onboarding_status: 'pending', kyb_status: 'pending', kyc_status: 'pending',
      onboarding_submitted_at: new Date().toISOString(),
    }).eq('id', expId);
    setBusy(false);
    if (error) return toast({ title: 'Submit failed', description: error.message, variant: 'destructive' });
    setSubmittedOpen(true);
    load();
  };


  const status = exp?.onboarding_status ?? 'pending';
  const submitted = !!exp?.onboarding_submitted_at;
  const bdApproved = !!exp?.bd_approved_at;
  const bdRejected = !!exp?.bd_rejected_at;
  const isActive = status === 'active';

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card">
        <div className="max-w-4xl mx-auto h-full flex items-center px-6">
          <span className="wordmark text-accent">VELOXIS</span>
          <span className="ml-auto text-xs text-muted-foreground">{profile?.email}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl">Complete your onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Before you can raise invoices, we need to verify your company (KYB) and director (KYC). Your Business Developer reviews first, then Credit &amp; Compliance gives final approval.
          </p>
        </div>

        {isActive && (
          <div className="card-elevated p-4 border-primary/40 bg-primary/10 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-accent">You’re approved</div>
              <div className="text-muted-foreground">You can now use the exporter portal.</div>
              <Button size="sm" className="mt-3" onClick={() => nav('/portal', { replace: true })}>Go to dashboard</Button>
            </div>
          </div>
        )}

        {!isActive && submitted && !bdRejected && (
          <div className="card-elevated p-4 border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-400">
                {bdApproved ? 'Awaiting Credit & Compliance approval' : 'Awaiting Business Developer review'}
              </div>
              <div className="text-muted-foreground">You’ll be able to access the portal once approved. You can still update your details below.</div>
            </div>
          </div>
        )}

        {bdRejected && (
          <div className="card-elevated p-4 border-destructive/60 bg-destructive/10 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-destructive">Additional information required</div>
              <div className="mt-1">{exp?.bd_rejection_reason || 'Your Business Developer requested changes.'}</div>
              <div className="text-muted-foreground mt-1">Update your details and re-submit.</div>
            </div>
          </div>
        )}

        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">1 · Company (KYB)</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company name *"><Input value={f.company_name ?? ''} onChange={(e) => set('company_name', e.target.value)} /></Field>
            <Field label="Registration number (RC / CAC) *"><Input value={f.company_registration_number ?? ''} onChange={(e) => set('company_registration_number', e.target.value)} /></Field>
            <Field label="Country of incorporation *"><OptionSelect value={f.country_of_incorporation} onChange={(v) => set('country_of_incorporation', v)} options={COUNTRIES} placeholder="Select country" /></Field>
            <Field label="Incorporation date"><Input type="date" value={f.incorporation_date ?? ''} onChange={(e) => set('incorporation_date', e.target.value)} /></Field>
            <Field label="Tax ID / TIN"><Input value={f.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} /></Field>
            <Field label="Industry / commodity"><Input value={f.commodity ?? ''} onChange={(e) => set('commodity', e.target.value)} /></Field>
            <Field label="Company phone"><Input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Company email"><Input value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Registered address"><Input value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field></div>
          </div>
        </section>

        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">2 · Director (KYC)</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Director full name *"><Input value={f.director_name ?? ''} onChange={(e) => set('director_name', e.target.value)} /></Field>
            <Field label="Director email"><Input type="email" value={f.director_email ?? ''} onChange={(e) => set('director_email', e.target.value)} /></Field>
            <Field label="Director phone"><Input value={f.director_phone ?? ''} onChange={(e) => set('director_phone', e.target.value)} /></Field>
            <Field label="Date of birth"><Input type="date" value={f.director_dob ?? ''} onChange={(e) => set('director_dob', e.target.value)} /></Field>
            <Field label="Nationality"><Input value={f.director_nationality ?? ''} onChange={(e) => set('director_nationality', e.target.value)} /></Field>
            <Field label="ID type *"><OptionSelect value={f.director_id_type} onChange={(v) => set('director_id_type', v)} options={ID_TYPES} placeholder="Select ID type" /></Field>
            <Field label="ID number *"><Input value={f.director_id_number ?? ''} onChange={(e) => set('director_id_number', e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Director residential address"><Input value={f.director_address ?? ''} onChange={(e) => set('director_address', e.target.value)} /></Field></div>
          </div>
        </section>

        <AdditionalDirectors exporterId={exp?.id} />


        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">3 · Bank details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank name *"><OptionSelect value={f.bank_details?.bank_name} onChange={(v) => setBank('bank_name', v)} options={NIGERIAN_BANKS} placeholder="Select bank" /></Field>
            <Field label="Account name (must match company name)">
              <Input value={f.company_name ?? ''} readOnly disabled className="opacity-70 cursor-not-allowed" />
            </Field>

            <Field label="Account number / IBAN *"><Input value={f.bank_details?.account_number ?? ''} onChange={(e) => setBank('account_number', e.target.value)} /></Field>
            <Field label="SWIFT / BIC"><Input value={f.bank_details?.swift ?? ''} onChange={(e) => setBank('swift', e.target.value)} /></Field>
          </div>
        </section>

        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">4 · Upload documents</h2>
          <p className="text-xs text-muted-foreground">PDF, JPG or PNG. Uploading a new file replaces the previous version for that document.</p>
          <div className="space-y-3">
            {REQUIRED_DOCS.map((r) => {
              const d = latestDoc(r.key);
              const pct = progress[r.key];
              const uploading = pct !== undefined;
              const err = uploadError[r.key];
              return (
                <div key={r.key} className="flex items-start justify-between gap-4 border-t border-border pt-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.hint}</div>
                    {d && !uploading && !err && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded bg-primary/15 text-accent">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[16rem]" title={d.file_name || 'Uploaded'}>{d.file_name || 'Uploaded'}</span>
                        </span>
                        {d.uploaded_at && (
                          <span className="text-muted-foreground">
                            Uploaded {new Date(d.uploaded_at).toLocaleDateString()}
                          </span>
                        )}
                        {d.verified && <span className="px-2 py-0.5 rounded bg-primary/20 text-accent">Verified</span>}
                      </div>
                    )}
                    {uploading && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-muted-foreground truncate" title={uploadingName[r.key]}>
                          Uploading {uploadingName[r.key]}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden">
                            <div className="h-full bg-accent transition-all duration-200" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
                        </div>
                      </div>
                    )}
                    {err && !uploading && (
                      <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 space-y-2">
                        <div className="flex items-start gap-2 text-xs">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-medium truncate" title={err.file.name}>{err.file.name}</div>
                            <div className="text-muted-foreground">Upload failed — {err.message}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => runUpload(err.file, r.key)}>
                            Retry upload
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy}
                            onClick={() => setUploadError((x) => { const n = { ...x }; delete n[r.key]; return n; })}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className={`text-xs px-3 py-2 border border-border rounded inline-flex items-center gap-2 ${busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-muted/20'}`}>
                    <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : d ? 'Replace' : 'Upload'}
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => upload(e, r.key)} disabled={busy} />
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={async () => { const id = await saveProfile(); if (id) toast({ title: 'Saved' }); }} disabled={busy}>
            Save progress
          </Button>
          <Button onClick={submitForReview} disabled={busy || isActive || (submitted && !bdRejected)}>
            {submitted && !bdRejected ? 'Submitted' : 'Submit for review'}
          </Button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
