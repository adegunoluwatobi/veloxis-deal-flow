import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExporterDocumentType } from '@/types';
import { DOC_TYPE_LABELS, buildDocTypeOptions } from '@/lib/docTypeOptions';
import DocumentRequestSection from '@/components/DocumentRequestSection';

export default function ExporterDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const uploadCardRef = useRef<HTMLDivElement>(null);
  const [exporter, setExporter] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [form, setForm] = useState({
    document_type: '' as ExporterDocumentType | '',
    expiry_date: '',
    file: null as File | null,
    export_licence_number: '',
  });
  const [addressForm, setAddressForm] = useState({
    registered_address_line1: '',
    registered_address_line2: '',
    registered_city: '',
    registered_postcode: '',
    registered_country: '',
  });

  // Pre-select doc type from ?type=... and scroll to upload card
  useEffect(() => {
    const type = searchParams.get('type') as ExporterDocumentType | null;
    if (type) {
      setForm((prev) => ({ ...prev, document_type: type }));
      // Wait for layout
      setTimeout(() => {
        uploadCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [searchParams]);

  const load = async () => {
    if (!user) return;
    const { data: exp } = await supabase
      .from('exporters')
      .select('id, company_name, export_licence_number, registered_address_line1, registered_address_line2, registered_city, registered_postcode, registered_country')
      .eq('exporter_user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (exp) {
      setExporter(exp);
      setAddressForm({
        registered_address_line1: exp.registered_address_line1 ?? '',
        registered_address_line2: exp.registered_address_line2 ?? '',
        registered_city: exp.registered_city ?? '',
        registered_postcode: exp.registered_postcode ?? '',
        registered_country: exp.registered_country ?? '',
      });
      const { data: docs } = await supabase
        .from('exporter_documents')
        .select('*')
        .eq('exporter_id', exp.id)
        .order('uploaded_at', { ascending: false });
      setDocuments(docs ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const activeDocs = documents.filter((d) => !d.is_superseded);
  const supersededDocs = documents.filter((d) => d.is_superseded);
  const docTypeOptions = buildDocTypeOptions(activeDocs);
  const enabledOptions = docTypeOptions.filter((o) => !o.disabled);
  const isAddressType = form.document_type === 'registered_address_proof';
  const addressComplete = !!(exporter?.registered_address_line1 && exporter?.registered_city);

  const handleSaveAddress = async () => {
    if (!user || !exporter) return;
    if (!addressForm.registered_address_line1.trim() || !addressForm.registered_city.trim()) {
      toast({ title: 'Missing fields', description: 'Address line 1 and City are required.', variant: 'destructive' });
      return;
    }
    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from('exporters')
        .update({
          registered_address_line1: addressForm.registered_address_line1.trim(),
          registered_address_line2: addressForm.registered_address_line2.trim() || null,
          registered_city: addressForm.registered_city.trim(),
          registered_postcode: addressForm.registered_postcode.trim() || null,
          registered_country: addressForm.registered_country.trim() || null,
        })
        .eq('id', exporter.id);
      if (error) throw error;
      toast({ title: 'Address saved', description: 'Your registered address has been updated and is reflected on your Company Profile.' });
      setForm({ document_type: '', expiry_date: '', file: null, export_licence_number: '' });
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSavingAddress(false);
    }
  };

  const handleUpload = async () => {
    if (!user || !exporter || !form.file || !form.document_type) return;
    if (!form.expiry_date) {
      toast({ title: 'Expiry date required', description: 'Please set an expiry date for this document.', variant: 'destructive' });
      return;
    }
    if (form.document_type === 'nepc_certificate' && !form.export_licence_number.trim()) {
      toast({ title: 'Export licence number required', description: 'Please enter the export licence number.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const file = form.file;
      const filePath = `exporters/${exporter.id}/${Date.now()}_${sanitiseFilename(file.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file);
      if (storageErr) throw storageErr;

      const { error: docErr } = await supabase.from('exporter_documents').insert({
        exporter_id: exporter.id,
        document_type: form.document_type as ExporterDocumentType,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        expiry_date: form.expiry_date,
        uploaded_by_user_id: user.id,
        uploaded_by_role: 'exporter',
        document_status: 'pending_review',
      });
      if (docErr) throw docErr;

      // Persist export licence number on exporter profile when uploading the licence
      if (form.document_type === 'nepc_certificate') {
        const { error: expErr } = await supabase
          .from('exporters')
          .update({ export_licence_number: form.export_licence_number.trim() })
          .eq('id', exporter.id);
        if (expErr) throw expErr;
      }

      await supabase.rpc('insert_audit_log', {
        p_exporter_id: exporter.id,
        p_user_id: user.id,
        p_user_role: 'exporter' as any,
        p_action_type: 'exporter_document_uploaded' as any,
        p_metadata: { document_type: form.document_type, file_name: file.name, uploaded_by: 'exporter' },
      });

      setForm({ document_type: '', expiry_date: '', file: null, export_licence_number: '' });
      toast({ title: 'Document uploaded', description: 'Your document has been submitted for review.' });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string) => {
    const { data, error } = await supabase.storage.from('veloxis-documents').createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Download failed', description: 'Could not generate download link.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  if (!exporter) return <div className="py-20 text-center"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-muted-foreground">No exporter profile linked.</p></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">Upload and manage KYC documents for {exporter.company_name}</p>
      </div>

      {/* Upload Form */}
      <Card ref={uploadCardRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> {isAddressType ? 'Registered Address' : 'Upload Document'}</CardTitle>
          <CardDescription>
            {isAddressType
              ? 'Enter your registered company address. This saves directly to your Company Profile — no document upload required.'
              : 'Accepted: CAC Certificate, Director ID, Export Licence. All uploads go to your partner for review.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {enabledOptions.length === 0 && !isAddressType ? (
            <p className="text-sm text-muted-foreground">All mandatory document types have been uploaded or are pending review.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v as ExporterDocumentType })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {docTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled && opt.value !== 'registered_address_proof'}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!isAddressType && (
                  <div className="space-y-2">
                    <Label>Expiry Date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} required />
                  </div>
                )}
              </div>

              {isAddressType ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address line 1 <span className="text-destructive">*</span></Label>
                      <Input
                        value={addressForm.registered_address_line1}
                        onChange={(e) => setAddressForm({ ...addressForm, registered_address_line1: e.target.value })}
                        placeholder="Street and number"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address line 2</Label>
                      <Input
                        value={addressForm.registered_address_line2}
                        onChange={(e) => setAddressForm({ ...addressForm, registered_address_line2: e.target.value })}
                        placeholder="Apartment, suite, building (optional)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City <span className="text-destructive">*</span></Label>
                      <Input
                        value={addressForm.registered_city}
                        onChange={(e) => setAddressForm({ ...addressForm, registered_city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Postcode</Label>
                      <Input
                        value={addressForm.registered_postcode}
                        onChange={(e) => setAddressForm({ ...addressForm, registered_postcode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Country</Label>
                      <Input
                        value={addressForm.registered_country}
                        onChange={(e) => setAddressForm({ ...addressForm, registered_country: e.target.value })}
                        placeholder="e.g. Nigeria"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveAddress}
                    disabled={savingAddress || !addressForm.registered_address_line1.trim() || !addressForm.registered_city.trim()}
                  >
                    {savingAddress ? 'Saving…' : addressComplete ? 'Update Address' : 'Save Address'}
                  </Button>
                </>
              ) : (
                <>
                  {form.document_type === 'nepc_certificate' && (
                    <div className="space-y-2">
                      <Label>Export Licence Number <span className="text-destructive">*</span></Label>
                      <Input
                        value={form.export_licence_number}
                        onChange={(e) => setForm({ ...form, export_licence_number: e.target.value })}
                        placeholder="Enter your export licence number"
                      />
                      <p className="text-xs text-muted-foreground">This will be saved to your company profile and pre-filled on future deals.</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>File</Label>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={
                      !form.document_type ||
                      !form.file ||
                      !form.expiry_date ||
                      uploading ||
                      (form.document_type === 'nepc_certificate' && !form.export_licence_number.trim())
                    }
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Current Documents */}
      <Card>
        <CardHeader><CardTitle>Current Documents ({activeDocs.length})</CardTitle></CardHeader>
        <CardContent>
          {activeDocs.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">File</th>
                    <th className="pb-2 font-medium">Expiry</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Uploaded</th>
                    <th className="pb-2 font-medium">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-3">{DOC_TYPE_LABELS[doc.document_type as ExporterDocumentType] ?? doc.document_type}</td>
                      <td className="py-3 max-w-[200px] truncate">{doc.file_name}</td>
                      <td className="py-3">{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : '—'}</td>
                      <td className="py-3">
                        <Badge variant="secondary" className={cn('text-xs',
                          doc.document_status === 'verified' ? 'bg-success/10 text-success' :
                          doc.document_status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                          'bg-warning/10 text-warning'
                        )}>
                          {doc.document_status === 'pending_review' ? 'Pending Review' : doc.document_status === 'verified' ? 'Verified' : 'Rejected'}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDownload(doc.file_path)}>
                          <Download className="mr-1 h-3 w-3" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requested Documents */}
      {exporter && <DocumentRequestSection exporterId={exporter.id} mode="exporter" />}

      {supersededDocs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Previous Versions ({supersededDocs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {supersededDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between text-sm text-muted-foreground border-b border-border pb-2">
                  <span>{DOC_TYPE_LABELS[doc.document_type as ExporterDocumentType] ?? doc.document_type} — {doc.file_name}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDownload(doc.file_path)}>
                      <Download className="mr-1 h-3 w-3" /> View
                    </Button>
                    <Badge variant="outline" className="text-xs">Superseded</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
