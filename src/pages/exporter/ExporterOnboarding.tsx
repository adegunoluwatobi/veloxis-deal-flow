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
import { Building2, Loader2, Clock, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
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
  });

  // Compliance document uploads
  const [sofFile, setSofFile] = useState<File | null>(null);
  const [sofUploaded, setSofUploaded] = useState(false);
  const [bankFiles, setBankFiles] = useState<File[]>([]);
  const [bankUploaded, setBankUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Per-field touched + submit-attempted tracking for inline validation
  type FieldKey = 'company_name' | 'rc_number' | 'entity_type' | 'director_name' | 'contact_email';
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    company_name: false,
    rc_number: false,
    entity_type: false,
    director_name: false,
    contact_email: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const markTouched = (k: FieldKey) => setTouched(p => ({ ...p, [k]: true }));

  const fieldError = (k: FieldKey): string | null => {
    const show = touched[k] || submitAttempted;
    if (!show) return null;
    switch (k) {
      case 'company_name':
        return form.company_name.trim() ? null : 'Company name is required';
      case 'rc_number':
        return form.rc_number.trim() ? null : 'RC number is required';
      case 'entity_type':
        return form.entity_type ? null : 'Please select an entity type';
      case 'director_name':
        return form.director_name.trim() ? null : 'Director name is required';
      case 'contact_email':
        if (!form.contact_email.trim()) return 'Contact email is required';
        if (!isValidEmail(form.contact_email)) return 'Please enter a valid email address';
        return null;
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
          rc_number: data.rc_number || '',
          entity_type: data.entity_type || '',
          director_name: data.director_name || '',
          contact_email: data.contact_email || user.email || '',
          source_of_funds_statement: (data as any).source_of_funds_statement || '',
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

  const fieldsValid = form.company_name.trim() && form.rc_number.trim() && form.entity_type && form.director_name.trim() && form.contact_email.trim() && isValidEmail(form.contact_email);
  const docsValid = sofUploaded && bankUploaded;
  const isValid = fieldsValid && docsValid;

  const handleSubmit = async () => {
    if (!user || !exporter) return;
    setSubmitAttempted(true);
    if (!fieldsValid) {
      // Mark all fields touched so inline errors render
      setTouched({ company_name: true, rc_number: true, entity_type: true, director_name: true, contact_email: true });
      toast({ title: 'Missing details', description: 'Please fix the highlighted fields before submitting.', variant: 'destructive' });
      // Scroll to the first invalid field
      const order: FieldKey[] = ['company_name', 'rc_number', 'entity_type', 'director_name', 'contact_email'];
      const firstBad = order.find(k => !!fieldError(k) || (k === 'entity_type' ? !form.entity_type : !(form as any)[k]?.trim?.()));
      if (firstBad) document.getElementById(firstBad)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!docsValid) {
      toast({
        title: 'Required documents missing',
        description: `Please upload ${!sofUploaded ? 'Source of Funds statement' : ''}${!sofUploaded && !bankUploaded ? ' and ' : ''}${!bankUploaded ? '6 months bank statements' : ''} before submitting.`,
        variant: 'destructive',
      });
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
          onboarding_status: 'onboarding_submitted' as any,
        } as any)
        .eq('id', exporter.id);

      if (error) throw error;

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
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input id="company_name" placeholder="e.g. Adire Textiles Ltd" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rc_number">RC Number *</Label>
              <Input id="rc_number" placeholder="e.g. RC123456" value={form.rc_number} onChange={(e) => setForm({ ...form, rc_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_type">Entity Type *</Label>
              <Select value={form.entity_type} onValueChange={(v) => setForm({ ...form, entity_type: v as EntityType })}>
                <SelectTrigger><SelectValue placeholder="Select entity type" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ENTITY_TYPE_LABELS) as [EntityType, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="director_name">Director Name *</Label>
              <Input id="director_name" placeholder="Full name of primary director" value={form.director_name} onChange={(e) => setForm({ ...form, director_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email *</Label>
              <EmailInput id="contact_email" placeholder="exporter@company.ng" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* UBO Declaration */}
        {exporter && <UboDeclarationForm exporterId={exporter.id} />}

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
