import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmailInput, isValidEmail } from '@/components/ui/email-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ENTITY_TYPE_LABELS, type EntityType, type ExporterDocumentType } from '@/types';
import { Building2, Loader2, Clock, Upload, FileText, CheckCircle2, Lock } from 'lucide-react';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { sendOnboardingEmail, resolvePartnerAdminRecipient, appUrl } from '@/lib/sendOnboardingEmail';
import UboDeclarationForm from '@/components/UboDeclarationForm';

export default function ExporterOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporter, setExporter] = useState<any>(null);
  const [form, setForm] = useState({
    company_name: '',
    rc_number: '',
    entity_type: '' as EntityType | '',
    director_name: '',
    contact_email: '',
    source_of_funds_statement: '',
    registered_address_line1: '',
    registered_address_line2: '',
    registered_city: '',
    registered_postcode: '',
    registered_country: 'Nigeria',
  });

  // Compliance document uploads
  const [sofFile, setSofFile] = useState<File | null>(null);
  const [sofUploaded, setSofUploaded] = useState(false);
  const [bankFiles, setBankFiles] = useState<File[]>([]);
  const [bankUploaded, setBankUploaded] = useState(false);
  // KYB document uploads
  const [cacFile, setCacFile] = useState<File | null>(null);
  const [cacUploaded, setCacUploaded] = useState(false);
  const [dirIdFile, setDirIdFile] = useState<File | null>(null);
  const [dirIdUploaded, setDirIdUploaded] = useState(false);
  const [nepcFile, setNepcFile] = useState<File | null>(null);
  const [nepcUploaded, setNepcUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Per-field touched + submit-attempted tracking for inline validation
  type FieldKey = 'director_name' | 'contact_email' | 'rc_number' | 'registered_address_line1' | 'registered_city' | 'registered_country';
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    director_name: false,
    contact_email: false,
    rc_number: false,
    registered_address_line1: false,
    registered_city: false,
    registered_country: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const markTouched = (k: FieldKey) => setTouched(p => ({ ...p, [k]: true }));

  const fieldError = (k: FieldKey): string | null => {
    const show = touched[k] || submitAttempted;
    if (!show) return null;
    switch (k) {
      case 'director_name':
        return form.director_name.trim() ? null : 'Director name is required';
      case 'contact_email':
        if (!form.contact_email.trim()) return 'Contact email is required';
        if (!isValidEmail(form.contact_email)) return 'Please enter a valid email address';
        return null;
      case 'rc_number':
        return form.rc_number.trim() ? null : 'RC Number is required';
      case 'registered_address_line1':
        return form.registered_address_line1.trim() ? null : 'Registered address is required';
      case 'registered_city':
        return form.registered_city.trim() ? null : 'City is required';
      case 'registered_country':
        return form.registered_country.trim() ? null : 'Country is required';
    }
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('exporters')
        .select('*')
        .eq('exporter_user_id', user.id)
        .maybeSingle();
      if (data) {
        setExporter(data);
        setForm({
          company_name: data.company_name || '',
          rc_number: data.rc_number && data.rc_number !== 'PENDING' ? data.rc_number : '',
          entity_type: data.entity_type || '',
          director_name: data.director_name || '',
          contact_email: data.contact_email || user.email || '',
          source_of_funds_statement: (data as any).source_of_funds_statement || '',
          registered_address_line1: (data as any).registered_address_line1 || '',
          registered_address_line2: (data as any).registered_address_line2 || '',
          registered_city: (data as any).registered_city || '',
          registered_postcode: (data as any).registered_postcode || '',
          registered_country: (data as any).registered_country || 'Nigeria',
        });

        // Check if compliance docs already uploaded
        const { data: docs } = await supabase
          .from('exporter_documents')
          .select('document_type')
          .eq('exporter_id', data.id)
          .eq('is_superseded', false);
        if (docs) {
          setSofUploaded(docs.some(d => d.document_type === 'source_of_funds_doc'));
          setBankUploaded(docs.some(d => d.document_type === 'bank_statements'));
          setCacUploaded(docs.some(d => d.document_type === 'cac_certificate'));
          setDirIdUploaded(docs.some(d => d.document_type === 'director_id'));
          setNepcUploaded(docs.some(d => d.document_type === 'nepc_certificate'));
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const uploadComplianceDoc = async (file: File, docType: ExporterDocumentType) => {
    if (!user || !exporter) return;
    const filePath = `exporters/${exporter.id}/${Date.now()}_${sanitiseFilename(file.name)}`;
    const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file);
    if (storageErr) throw storageErr;

    const { error: docErr } = await supabase.from('exporter_documents').insert({
      exporter_id: exporter.id,
      document_type: docType,
      file_name: file.name,
      file_path: filePath,
      file_size_bytes: file.size,
      mime_type: file.type,
      uploaded_by_user_id: user.id,
      uploaded_by_role: 'exporter',
      document_status: 'pending_review',
    });
    if (docErr) throw docErr;
  };

  // Resolves the partner admin recipient for this exporter, used by submit emails.
  const resolveExporterPartnerRecipient = async () => {
    if (!exporter?.originator_id) return null;
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('partner_organisation_id')
      .eq('user_id', exporter.originator_id)
      .in('role', ['partner_admin', 'partner_staff'])
      .maybeSingle();
    return resolvePartnerAdminRecipient(roleRow?.partner_organisation_id ?? null);
  };

  const handleUploadSof = async () => {
    if (!sofFile) return;
    setUploading(true);
    try {
      await uploadComplianceDoc(sofFile, 'source_of_funds_doc');
      setSofFile(null);
      setSofUploaded(true);
      toast({ title: 'Source of Funds document uploaded' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleUploadBank = async () => {
    if (bankFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of bankFiles) {
        await uploadComplianceDoc(file, 'bank_statements');
      }
      setBankFiles([]);
      setBankUploaded(true);
      toast({ title: `${bankFiles.length} bank statement(s) uploaded` });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (exporter?.onboarding_status === 'onboarding_submitted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <Clock className="mb-4 h-12 w-12 text-warning" />
            <h2 className="text-xl font-bold text-foreground">Onboarding Pending Approval</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your onboarding details have been submitted and are awaiting review by your partner organisation. You'll be notified once approved.
            </p>
            <Button variant="outline" className="mt-6" onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (exporter?.onboarding_status === 'onboarding_approved') {
    navigate('/exporter');
    return null;
  }

  const fieldsValid =
    form.director_name.trim() &&
    form.contact_email.trim() &&
    isValidEmail(form.contact_email) &&
    form.rc_number.trim() &&
    form.registered_address_line1.trim() &&
    form.registered_city.trim() &&
    form.registered_country.trim();
  const docsValid = sofUploaded && bankUploaded && cacUploaded && dirIdUploaded && nepcUploaded;
  const isValid = fieldsValid && docsValid;

  const missingDocLabels = () => {
    const m: string[] = [];
    if (!cacUploaded) m.push('CAC Certificate');
    if (!dirIdUploaded) m.push('Director ID');
    if (!nepcUploaded) m.push('Export Licence');
    if (!sofUploaded) m.push('Source of Funds statement');
    if (!bankUploaded) m.push('6 months bank statements');
    return m;
  };

  const handleSubmit = async () => {
    if (!user || !exporter) return;
    setSubmitAttempted(true);
    if (!fieldsValid) {
      setTouched({
        director_name: true, contact_email: true, rc_number: true,
        registered_address_line1: true, registered_city: true, registered_country: true,
      });
      toast({ title: 'Missing details', description: 'Please fix the highlighted fields before submitting.', variant: 'destructive' });
      const order: FieldKey[] = ['rc_number', 'director_name', 'contact_email', 'registered_address_line1', 'registered_city', 'registered_country'];
      const firstBad = order.find(k => !!fieldError(k) || !(form as any)[k]?.trim?.());
      if (firstBad) document.getElementById(firstBad)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!docsValid) {
      toast({ title: 'Required documents missing', description: `Please upload: ${missingDocLabels().join(', ')}.`, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('exporters')
        .update({
          company_name: form.company_name.trim(),
          rc_number: form.rc_number.trim(),
          entity_type: form.entity_type as EntityType,
          director_name: form.director_name.trim(),
          contact_email: form.contact_email.trim(),
          source_of_funds_statement: form.source_of_funds_statement.trim() || null,
          registered_address_line1: form.registered_address_line1.trim(),
          registered_address_line2: form.registered_address_line2.trim() || null,
          registered_city: form.registered_city.trim(),
          registered_postcode: form.registered_postcode.trim() || null,
          registered_country: form.registered_country.trim(),
          onboarding_status: 'onboarding_submitted' as any,
        } as any)
        .eq('id', exporter.id);

      if (error) throw error;

      // Emails #3 (form submitted) and #4 (KYC docs uploaded). In the
      // Veloxis flow the exporter must have all docs uploaded before submit
      // is allowed, so both partner-facing notifications fire here.
      try {
        const recipient = await resolveExporterPartnerRecipient();
        if (recipient?.email) {
          void sendOnboardingEmail({
            templateName: 'onboarding-form-submitted',
            recipientEmail: recipient.email,
            idempotencyKey: `onboarding-submitted-${exporter.id}`,
            templateData: {
              partnerAdminName: recipient.fullName,
              exporterCompanyName: form.company_name.trim(),
              applicationUrl: appUrl(`/greystar/exporters/${exporter.id}`),
            },
          });
          void sendOnboardingEmail({
            templateName: 'kyc-documents-uploaded',
            recipientEmail: recipient.email,
            idempotencyKey: `kyc-docs-${exporter.id}`,
            templateData: {
              partnerAdminName: recipient.fullName,
              exporterCompanyName: form.company_name.trim(),
              applicationUrl: appUrl(`/greystar/exporters/${exporter.id}`),
            },
          });
        }
      } catch (e) {
        console.warn('partner submit notifications failed', e);
      }

      await supabase.rpc('insert_audit_log', {
        p_exporter_id: exporter.id,
        p_user_id: user.id,
        p_user_role: 'exporter' as any,
        p_action_type: 'onboarding_submitted' as any,
        p_metadata: { company_name: form.company_name.trim() },
      });

      toast({ title: 'Onboarding submitted', description: 'Your details are under review.' });
      setExporter({ ...exporter, onboarding_status: 'onboarding_submitted' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const isRejected = exporter?.onboarding_status === 'onboarding_rejected';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Complete Your Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            {isRejected
              ? 'Your previous submission was returned for changes. Please update and resubmit.'
              : 'Fill in your company details to complete account setup.'}
          </p>
        </div>

        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>All fields are required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Set by your Veloxis administrator
              </div>
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Company Name</Label>
                  <p className="mt-1 text-sm font-medium text-foreground">{form.company_name || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">RC Number</Label>
                  <p className="mt-1 text-sm font-medium text-foreground">{form.rc_number || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Entity Type</Label>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {form.entity_type ? ENTITY_TYPE_LABELS[form.entity_type as EntityType] : '—'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                These details were set by your Veloxis administrator. If any information is incorrect, contact{' '}
                <a href="mailto:support@veloxis.co.uk" className="underline">support@veloxis.co.uk</a>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="director_name">Director Name *</Label>
              <Input
                id="director_name"
                required
                aria-invalid={!!fieldError('director_name')}
                placeholder="Full name of primary director"
                value={form.director_name}
                onChange={(e) => setForm({ ...form, director_name: e.target.value })}
                onBlur={() => markTouched('director_name')}
                className={fieldError('director_name') ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldError('director_name') && <p className="text-xs text-destructive">{fieldError('director_name')}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email *</Label>
              <EmailInput
                id="contact_email"
                required
                placeholder="exporter@company.ng"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                onBlur={() => markTouched('contact_email')}
                error={fieldError('contact_email') ?? undefined}
              />
            </div>

            {/* UBO Declaration — sits under Directors */}
            {exporter && (
              <div className="pt-2">
                <UboDeclarationForm exporterId={exporter.id} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance & Due Diligence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Compliance & Due Diligence
            </CardTitle>
            <CardDescription>All documents below are required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Source of Funds */}
            <div className="space-y-2">
              <Label>Source of Funds / Source of Wealth Statement *</Label>
              <Textarea
                placeholder="Describe your primary business revenue sources…"
                value={form.source_of_funds_statement}
                onChange={e => setForm({ ...form, source_of_funds_statement: e.target.value })}
                rows={3}
              />
              <div className="flex items-center gap-2">
                {sofUploaded ? (
                  <div className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Document uploaded
                  </div>
                ) : (
                  <>
                    <Input type="file" accept=".pdf" onChange={e => setSofFile(e.target.files?.[0] ?? null)} className="flex-1" />
                    <Button size="sm" onClick={handleUploadSof} disabled={!sofFile || uploading}>
                      <Upload className="mr-1 h-3 w-3" /> Upload
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Bank Statements */}
            <div className="space-y-2">
              <Label>6 Months Bank Statements *</Label>
              <p className="text-xs text-muted-foreground">Upload PDF bank statements (multiple files accepted).</p>
              {bankUploaded ? (
                <div className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Bank statements uploaded
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={e => setBankFiles(Array.from(e.target.files ?? []))}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleUploadBank} disabled={bankFiles.length === 0 || uploading}>
                    <Upload className="mr-1 h-3 w-3" /> Upload {bankFiles.length > 0 ? `(${bankFiles.length})` : ''}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!docsValid && (
          <p className="text-center text-xs text-destructive">
            Please upload all required documents marked with * before submitting.
          </p>
        )}
        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          {submitting ? 'Submitting…' : 'Submit Onboarding'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">Trade Finance Platform</p>
      </div>
    </div>
  );
}
