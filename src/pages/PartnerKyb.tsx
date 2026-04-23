import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CountrySelect } from '@/components/ui/country-select';
import { Progress } from '@/components/ui/progress';
import { Loader2, ShieldCheck, FileUp, AlertCircle, CheckCircle2, LogOut, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { sanitiseFilename } from '@/lib/sanitiseFilename';

type KybDocType = 'certificate_of_incorporation' | 'proof_of_registered_address' | 'director_id';

const REQUIRED_DOCS: { type: KybDocType; label: string; helper: string }[] = [
  { type: 'certificate_of_incorporation', label: 'Certificate of Incorporation', helper: 'Issued by your registrar (Companies House, CAC, etc.)' },
  { type: 'proof_of_registered_address', label: 'Proof of Registered Address', helper: 'Utility bill or bank statement, dated within the last 3 months' },
  { type: 'director_id', label: 'Director ID', helper: 'Government-issued photo ID for an authorised director' },
];

type UploadState = {
  status: 'idle' | 'uploading' | 'saving' | 'success' | 'error';
  progress: number; // 0-100
  fileName?: string;
  errorMessage?: string;
  lastFile?: File;
  attempts: number;
};

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

export default function PartnerKyb() {
  const { user, role, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [uploadStates, setUploadStates] = useState<Record<KybDocType, UploadState>>({
    certificate_of_incorporation: { status: 'idle', progress: 0, attempts: 0 },
    proof_of_registered_address: { status: 'idle', progress: 0, attempts: 0 },
    director_id: { status: 'idle', progress: 0, attempts: 0 },
  });
  const [form, setForm] = useState({
    company_registration_number: '',
    country_of_incorporation: '',
    registered_address_line1: '',
    registered_address_line2: '',
    registered_city: '',
    registered_postcode: '',
    registered_country: '',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
  });

  const { data: orgRow, isLoading: roleLoading } = useQuery({
    queryKey: ['kyb_user_role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('user_roles').select('partner_organisation_id').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const orgId = orgRow?.partner_organisation_id ?? null;

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ['kyb_partner_org', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase.from('partner_organisations').select('*').eq('id', orgId).maybeSingle();
      return data;
    },
    enabled: !!orgId,
  });

  const { data: docs = [], refetch: refetchDocs } = useQuery({
    queryKey: ['kyb_partner_docs', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('partner_documents')
        .select('id, document_type, file_name, file_path, uploaded_at, document_status, is_superseded')
        .eq('partner_organisation_id', orgId)
        .eq('is_superseded', false)
        .order('uploaded_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: docRequests = [] } = useQuery({
    queryKey: ['kyb_partner_doc_requests', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('partner_document_requests')
        .select('id, document_title, description, status, created_at')
        .eq('partner_organisation_id', orgId)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (org) {
      setForm({
        company_registration_number: org.company_registration_number ?? '',
        country_of_incorporation: org.country_of_incorporation ?? '',
        registered_address_line1: org.registered_address_line1 ?? '',
        registered_address_line2: org.registered_address_line2 ?? '',
        registered_city: org.registered_city ?? '',
        registered_postcode: org.registered_postcode ?? '',
        registered_country: org.registered_country ?? '',
        primary_contact_name: org.primary_contact_name ?? '',
        primary_contact_email: org.primary_contact_email ?? '',
        primary_contact_phone: org.primary_contact_phone ?? '',
      });
    }
  }, [org]);

  if (roleLoading || orgLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-96 max-w-4xl mx-auto" />
      </div>
    );
  }

  if (role !== 'partner_admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>KYB submission restricted</AlertTitle>
          <AlertDescription>
            Only your Partner Admin can submit KYB documents. Please ask them to complete this step before accessing the dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No partner organisation linked to your account. Contact Veloxis support.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isSubmitted = !!org.kyb_submitted_at;
  const isVerified = !!org.kyb_verified_at;
  const wasRejected = !!org.kyb_rejected_at && !isVerified;
  const pendingDocRequests = docRequests.filter((r: any) => r.status === 'pending');
  const docsByType = new Map(docs.map((d: any) => [d.document_type, d]));

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const setUploadState = (docType: KybDocType, partial: Partial<UploadState>) => {
    setUploadStates((prev) => ({ ...prev, [docType]: { ...prev[docType], ...partial } }));
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME.includes(file.type) && !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      return 'Unsupported file type. Upload PDF, JPG, or PNG.';
    }
    if (file.size > MAX_FILE_BYTES) {
      return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 15 MB.`;
    }
    if (file.size === 0) {
      return 'File appears to be empty.';
    }
    return null;
  };

  const handleUpload = async (file: File, docType: KybDocType) => {
    if (!orgId || !user?.id) return;

    const validationError = validateFile(file);
    if (validationError) {
      setUploadState(docType, {
        status: 'error',
        progress: 0,
        fileName: file.name,
        errorMessage: validationError,
        lastFile: file,
        attempts: (uploadStates[docType]?.attempts ?? 0) + 1,
      });
      toast.error(validationError);
      return;
    }

    const attempts = (uploadStates[docType]?.attempts ?? 0) + 1;
    setUploadState(docType, {
      status: 'uploading',
      progress: 8,
      fileName: file.name,
      errorMessage: undefined,
      lastFile: file,
      attempts,
    });

    // Simulated indeterminate progress while the network call is in flight.
    let progress = 8;
    const ticker = window.setInterval(() => {
      progress = Math.min(progress + 7, 85);
      setUploadState(docType, { progress });
    }, 250);

    try {
      const cleanName = sanitiseFilename(file.name);
      const path = `partner-kyb/${orgId}/${docType}/${Date.now()}-${cleanName}`;
      const { error: uploadErr } = await supabase.storage
        .from('veloxis-documents')
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      window.clearInterval(ticker);
      setUploadState(docType, { status: 'saving', progress: 92 });

      const { error: insertErr } = await supabase.from('partner_documents').insert({
        partner_organisation_id: orgId,
        document_type: docType as any,
        file_name: file.name,
        file_path: path,
        file_size_bytes: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (insertErr) throw insertErr;

      await supabase.rpc('insert_audit_log', {
        p_user_id: user.id,
        p_user_role: 'partner_admin' as any,
        p_action_type: 'partner_kyb_doc_uploaded' as any,
        p_metadata: { partner_organisation_id: orgId, document_type: docType, file_name: file.name },
      });

      setUploadState(docType, {
        status: 'success',
        progress: 100,
        errorMessage: undefined,
        lastFile: undefined,
      });
      toast.success(`${file.name} uploaded.`);
      refetchDocs();
    } catch (err: any) {
      window.clearInterval(ticker);
      const msg = err?.message ?? 'Upload failed. Check your connection and try again.';
      setUploadState(docType, {
        status: 'error',
        progress: 0,
        errorMessage: msg,
        lastFile: file,
      });
      toast.error(msg);
    }
  };

  const handleRetry = (docType: KybDocType) => {
    const state = uploadStates[docType];
    if (state?.lastFile) handleUpload(state.lastFile, docType);
  };

  const dismissUploadError = (docType: KybDocType) => {
    setUploadState(docType, { status: 'idle', progress: 0, errorMessage: undefined, lastFile: undefined });
  };

  const requiredDocsUploaded = REQUIRED_DOCS.every((d) => docsByType.has(d.type));

  const handleSubmit = async () => {
    if (!orgId || !user?.id) return;
    if (!form.company_registration_number.trim()) { toast.error('Registration number is required.'); return; }
    if (!form.country_of_incorporation.trim()) { toast.error('Country of incorporation is required.'); return; }
    if (!form.registered_address_line1.trim() || !form.registered_city.trim() || !form.registered_country.trim()) {
      toast.error('Registered address is required.'); return;
    }
    if (!form.primary_contact_name.trim() || !form.primary_contact_email.trim()) {
      toast.error('Primary contact is required.'); return;
    }
    if (!requiredDocsUploaded) { toast.error('Upload all 3 required documents before submitting.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('partner_organisations').update({
        company_registration_number: form.company_registration_number.trim(),
        country_of_incorporation: form.country_of_incorporation.trim(),
        registered_address_line1: form.registered_address_line1.trim(),
        registered_address_line2: form.registered_address_line2.trim() || null,
        registered_city: form.registered_city.trim(),
        registered_postcode: form.registered_postcode.trim() || null,
        registered_country: form.registered_country.trim(),
        primary_contact_name: form.primary_contact_name.trim(),
        primary_contact_email: form.primary_contact_email.trim(),
        primary_contact_phone: form.primary_contact_phone.trim() || null,
        kyb_status: 'submitted' as any,
        kyb_submitted_at: new Date().toISOString(),
        kyb_rejected_at: null,
        kyb_rejection_reason: null,
      }).eq('id', orgId);
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_user_id: user.id,
        p_user_role: 'partner_admin' as any,
        p_action_type: 'partner_kyb_submitted' as any,
        p_metadata: { partner_organisation_id: orgId },
      });

      toast.success('KYB submitted. Veloxis will review and notify you.');
      queryClient.invalidateQueries({ queryKey: ['kyb_partner_org', orgId] });
    } catch (err: any) {
      toast.error(err.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // If verified, show success and route to dashboard
  if (isVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <CardTitle>KYB Verified</CardTitle>
            <CardDescription>Your organisation has been approved.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/greystar')}>Go to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Helmet><title>Partner KYB · Veloxis</title></Helmet>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Partner KYB Verification
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete your Know Your Business verification to access the partner dashboard.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate('/login'); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>

        {isSubmitted && !wasRejected && (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>KYB submitted — awaiting Veloxis review</AlertTitle>
            <AlertDescription>
              We received your submission on {new Date(org.kyb_submitted_at!).toLocaleDateString()}. You'll receive a notification when the review is complete. You may upload additional documents if requested.
            </AlertDescription>
          </Alert>
        )}

        {wasRejected && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>KYB rejected — please resubmit</AlertTitle>
            <AlertDescription>
              Reason: {org.kyb_rejection_reason ?? 'Not specified.'} Update your details and documents, then resubmit.
            </AlertDescription>
          </Alert>
        )}

        {pendingDocRequests.length > 0 && (
          <Alert className="border-warning/50 bg-warning/5">
            <FileUp className="h-4 w-4 text-warning" />
            <AlertTitle>Additional documents requested</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm">
                {pendingDocRequests.map((r: any) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.document_title}</span>
                    {r.description ? <span className="text-muted-foreground"> — {r.description}</span> : null}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>Information about your registered legal entity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Registration number *" value={form.company_registration_number} onChange={(v) => update('company_registration_number', v)} />
              <div className="space-y-2">
                <Label>Country of incorporation *</Label>
                <CountrySelect value={form.country_of_incorporation} onChange={(v) => update('country_of_incorporation', v)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Registered address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Address line 1 *" value={form.registered_address_line1} onChange={(v) => update('registered_address_line1', v)} />
              <Field label="Address line 2" value={form.registered_address_line2} onChange={(v) => update('registered_address_line2', v)} />
              <Field label="City *" value={form.registered_city} onChange={(v) => update('registered_city', v)} />
              <Field label="Postcode" value={form.registered_postcode} onChange={(v) => update('registered_postcode', v)} />
              <div className="space-y-2 md:col-span-2">
                <Label>Country *</Label>
                <CountrySelect value={form.registered_country} onChange={(v) => update('registered_country', v)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Primary contact</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Contact name *" value={form.primary_contact_name} onChange={(v) => update('primary_contact_name', v)} />
              <Field label="Contact email *" type="email" value={form.primary_contact_email} onChange={(v) => update('primary_contact_email', v)} />
              <Field label="Contact phone" value={form.primary_contact_phone} onChange={(v) => update('primary_contact_phone', v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Required documents</CardTitle>
            <CardDescription>Upload all 3 documents to complete KYB. PDF, JPG, or PNG accepted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REQUIRED_DOCS.map((d) => {
              const uploaded = docsByType.get(d.type) as any;
              const upload = uploadStates[d.type];
              const isBusy = upload.status === 'uploading' || upload.status === 'saving';
              const hasError = upload.status === 'error';
              return (
                <div key={d.type} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{d.label}</span>
                        {uploaded ? (
                          <Badge variant="secondary" className="bg-success/10 text-success text-xs">Uploaded</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">Required</Badge>
                        )}
                        {hasError && (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                            Upload failed
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{d.helper}</p>
                      {uploaded && !isBusy && !hasError && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">📄 {uploaded.file_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id={`upload-${d.type}`}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(f, d.type);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant={uploaded ? 'outline' : 'default'}
                        size="sm"
                        disabled={isBusy}
                        onClick={() => document.getElementById(`upload-${d.type}`)?.click()}
                      >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
                        {isBusy
                          ? upload.status === 'uploading' ? 'Uploading…' : 'Saving…'
                          : uploaded ? 'Replace' : 'Upload'}
                      </Button>
                    </div>
                  </div>

                  {isBusy && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{upload.fileName ?? 'Uploading file'}</span>
                        <span>{Math.round(upload.progress)}%</span>
                      </div>
                      <Progress value={upload.progress} className="h-1.5" />
                    </div>
                  )}

                  {hasError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-start justify-between gap-3">
                        <div className="text-xs">
                          <div className="font-medium">{upload.fileName ?? 'File'} didn't upload</div>
                          <div className="opacity-90 mt-0.5">{upload.errorMessage}</div>
                          {upload.attempts > 1 && (
                            <div className="opacity-75 mt-0.5">Attempts: {upload.attempts}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {upload.lastFile && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleRetry(d.type)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Retry
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => dismissUploadError(d.type)}
                            aria-label="Dismiss error"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting} size="lg">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isSubmitted ? 'Resubmit KYB' : 'Submit KYB for review'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} type={type} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
