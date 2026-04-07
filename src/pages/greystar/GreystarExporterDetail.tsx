import { useEffect, useState } from 'react';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle2, XCircle, Clock, Eye, Download, Send } from 'lucide-react';
import { type KycStatus, type ExporterDocumentType } from '@/types';
import { cn } from '@/lib/utils';
import { DOC_TYPE_LABELS, buildDocTypeOptions } from '@/lib/docTypeOptions';
import { computeKycStatus } from '@/lib/computeKycStatus';
import DocumentRequestSection from '@/components/DocumentRequestSection';

const DOC_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-warning/10 text-warning',
  verified: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

const KYC_COLORS: Record<KycStatus, string> = {
  pending_documents: 'bg-muted text-muted-foreground',
  documents_uploaded: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  verified: 'bg-success/10 text-success',
  kyc_document_expired: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function GreystarExporterDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [exporter, setExporter] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    document_type: '' as ExporterDocumentType | '',
    expiry_date: '',
    file: null as File | null,
  });

  const isPartner = role === 'partner_admin' || role === 'partner_staff';
  const isReadOnly = role === 'super_admin' || role === 'deal_manager';

  const load = async () => {
    if (!id) return;
    const [expRes, docsRes] = await Promise.all([
      supabase.from('exporters').select('*').eq('id', id).single(),
      supabase.from('exporter_documents').select('*').eq('exporter_id', id).order('uploaded_at', { ascending: false }),
    ]);
    setExporter(expRes.data);
    setDocuments(docsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const activeDocs = documents.filter((d) => !d.is_superseded);
  const supersededDocs = documents.filter((d) => d.is_superseded);
  const docTypeOptions = buildDocTypeOptions(activeDocs);

  const handleUpload = async () => {
    if (!user || !id || !uploadForm.file || !uploadForm.document_type) return;
    if (!uploadForm.expiry_date) {
      toast({ title: 'Expiry date required', description: 'Please set an expiry date for this document.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const file = uploadForm.file;
      const filePath = `exporters/${id}/${Date.now()}_${sanitiseFilename(file.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file);
      if (storageErr) throw storageErr;

      const { error: docErr } = await supabase.from('exporter_documents').insert({
        exporter_id: id,
        document_type: uploadForm.document_type as ExporterDocumentType,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        expiry_date: uploadForm.expiry_date,
        uploaded_by_user_id: user.id,
        uploaded_by_role: 'partner_staff',
        document_status: 'pending_review',
      });
      if (docErr) throw docErr;

      await supabase.rpc('insert_audit_log', {
        p_exporter_id: id,
        p_user_id: user.id,
        p_user_role: 'partner_staff' as any,
        p_action_type: 'exporter_document_uploaded' as any,
        p_metadata: { document_type: uploadForm.document_type, file_name: file.name },
      });

      setUploadForm({ document_type: '', expiry_date: '', file: null });
      toast({ title: 'Document uploaded', description: 'Added to review queue.' });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async (docId: string) => {
    if (!user) return;
    await supabase.from('exporter_documents').update({
      document_status: 'verified',
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    }).eq('id', docId);
    await supabase.rpc('insert_audit_log', {
      p_exporter_id: id,
      p_user_id: user.id,
      p_user_role: 'partner_staff' as any,
      p_action_type: 'exporter_document_verified' as any,
      p_metadata: { document_id: docId },
    });
    toast({ title: 'Document verified' });
    load();
  };

  const handleReject = async (docId: string) => {
    if (!user) return;
    await supabase.from('exporter_documents').update({ document_status: 'rejected' }).eq('id', docId);
    await supabase.rpc('insert_audit_log', {
      p_exporter_id: id,
      p_user_id: user.id,
      p_user_role: 'partner_staff' as any,
      p_action_type: 'kyc_rejected' as any,
      p_metadata: { document_id: docId },
    });
    toast({ title: 'Document rejected' });
    load();
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from('veloxis-documents').createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Download failed', description: 'Could not generate download link.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleResendInvite = async () => {
    if (!id || !exporter?.contact_email) return;
    setResendingInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-exporter', {
        body: {
          email: exporter.contact_email,
          full_name: exporter.director_name,
          organisation: exporter.company_name,
          exporter_id: exporter.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Invite resent', description: `A fresh invitation was sent to ${exporter.contact_email}.` });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend invite';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setResendingInvite(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  if (!exporter) return <div className="py-20 text-center text-muted-foreground">Exporter not found.</div>;

  const enabledOptions = docTypeOptions.filter((o) => !o.disabled);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate('/greystar/exporters')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Exporters
      </Button>

      {/* Read-only banner for super_admin / deal_manager */}
      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" /> You are viewing this exporter in read-only mode. Document verification is managed by the partner organisation.
        </div>
      )}

      {/* KYC Banner — derived from documents */}
      {(() => {
        const kyc = computeKycStatus(activeDocs);
        return (
          <div className={cn('rounded-lg border p-4', kyc.borderColor)}>
            <div className="flex items-center gap-2">
              {kyc.status === 'verified' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              <span className="font-semibold">KYC Status: {kyc.label}</span>
            </div>
            <p className="mt-1 text-sm">{kyc.description}</p>
          </div>
        );
      })()}

      {/* Onboarding Approval Banner — partner only */}
      {isPartner && exporter.onboarding_status === 'onboarding_submitted' && (
        <Card className="border-warning">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <p className="font-semibold text-foreground">Onboarding Pending Approval</p>
                <p className="text-xs text-muted-foreground">This exporter has submitted their onboarding details and is awaiting your approval.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-destructive" onClick={async () => {
                if (!user || !id) return;
                await supabase.from('exporters').update({ onboarding_status: 'onboarding_rejected' as any }).eq('id', id);
                await supabase.rpc('insert_audit_log', {
                  p_exporter_id: id, p_user_id: user.id, p_user_role: 'partner_staff' as any,
                  p_action_type: 'onboarding_rejected' as any, p_metadata: {},
                });
                toast({ title: 'Onboarding rejected' });
                load();
              }}>
                <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" onClick={async () => {
                if (!user || !id) return;
                await supabase.from('exporters').update({ onboarding_status: 'onboarding_approved' as any }).eq('id', id);
                await supabase.rpc('insert_audit_log', {
                  p_exporter_id: id, p_user_id: user.id, p_user_role: 'partner_staff' as any,
                  p_action_type: 'onboarding_approved' as any, p_metadata: {},
                });
                toast({ title: 'Onboarding approved' });
                load();
              }}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve Onboarding
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Identity */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{exporter.company_name}</CardTitle>
            <CardDescription>Review onboarding progress and resend access when the invite is still pending.</CardDescription>
          </div>
          {isPartner && exporter.onboarding_status === 'invited' && exporter.contact_email && (
            <Button variant="outline" size="sm" onClick={handleResendInvite} disabled={resendingInvite}>
              {resendingInvite ? 'Resending…' : 'Resend Invite'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted-foreground">RC Number</dt><dd className="font-medium">{exporter.rc_number}</dd></div>
            <div><dt className="text-muted-foreground">Entity Type</dt><dd className="font-medium">{exporter.entity_type}</dd></div>
            <div><dt className="text-muted-foreground">Director</dt><dd className="font-medium">{exporter.director_name}</dd></div>
            <div><dt className="text-muted-foreground">Contact Email</dt><dd className="font-medium">{exporter.contact_email ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Onboarding</dt><dd className="font-medium capitalize">{(exporter.onboarding_status || 'invited').replace(/_/g, ' ')}</dd></div>
            <div><dt className="text-muted-foreground">Forwarded to Veloxis</dt><dd className="font-medium">{exporter.forwarded_to_veloxis_at ? new Date(exporter.forwarded_to_veloxis_at).toLocaleDateString() : 'Not yet'}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {/* Upload on behalf — partner only */}
      {isPartner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Upload on Behalf of Exporter</CardTitle>
            <CardDescription>Upload KYC documents for this exporter. Documents will go to the review queue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {enabledOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">All mandatory document types have been uploaded or are pending review.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select value={uploadForm.document_type} onValueChange={(v) => setUploadForm({ ...uploadForm, document_type: v as ExporterDocumentType })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {docTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={uploadForm.expiry_date} onChange={(e) => setUploadForm({ ...uploadForm, expiry_date: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] ?? null })} />
                </div>
                <Button onClick={handleUpload} disabled={!uploadForm.document_type || !uploadForm.file || !uploadForm.expiry_date || uploading}>
                  {uploading ? 'Uploading…' : 'Upload Document'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Documents */}
      <Card>
        <CardHeader><CardTitle>Documents ({activeDocs.length})</CardTitle></CardHeader>
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
                    <th className="pb-2 font-medium">Uploaded By</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">{isPartner ? 'Actions' : 'View'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-3">{DOC_TYPE_LABELS[doc.document_type as ExporterDocumentType] ?? doc.document_type}</td>
                      <td className="py-3 max-w-[200px] truncate">{doc.file_name}</td>
                      <td className="py-3">{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : '—'}</td>
                      <td className="py-3">
                        <Badge variant="outline" className="text-xs">
                          {doc.uploaded_by_role === 'partner_staff' || doc.uploaded_by_role === 'greystar_originator' ? 'Partner' : doc.uploaded_by_role === 'exporter' ? 'Exporter' : 'Token'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary" className={cn('text-xs', DOC_STATUS_COLORS[doc.document_status] ?? '')}>
                          {doc.document_status === 'pending_review' ? 'Pending' : doc.document_status === 'verified' ? 'Verified' : 'Rejected'}
                        </Badge>
                      </td>
                      {isPartner && (
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDownload(doc.file_path, doc.file_name)}>
                              <Download className="mr-1 h-3 w-3" /> View
                            </Button>
                            {doc.document_status === 'pending_review' && (
                              <>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => handleVerify(doc.id)}>
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Verify
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleReject(doc.id)}>
                                  <XCircle className="mr-1 h-3 w-3" /> Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                      {isReadOnly && (
                        <td className="py-3">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDownload(doc.file_path, doc.file_name)}>
                            <Download className="mr-1 h-3 w-3" /> View
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requested Documents */}
      <DocumentRequestSection exporterId={id!} mode={isPartner ? 'admin' : 'admin'} />

      {/* Superseded Documents */}
      {supersededDocs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Superseded Documents ({supersededDocs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-muted-foreground">
                <thead>
                   <tr className="border-b text-left">
                     <th className="pb-2 font-medium">Type</th>
                     <th className="pb-2 font-medium">File</th>
                     <th className="pb-2 font-medium">Expiry</th>
                     <th className="pb-2 font-medium">Uploaded</th>
                     <th className="pb-2 font-medium">Status</th>
                     <th className="pb-2 font-medium">View</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {supersededDocs.map((doc) => (
                     <tr key={doc.id}>
                       <td className="py-2">{DOC_TYPE_LABELS[doc.document_type as ExporterDocumentType] ?? doc.document_type}</td>
                       <td className="py-2 max-w-[200px] truncate">{doc.file_name}</td>
                       <td className="py-2">{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : '—'}</td>
                       <td className="py-2">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                       <td className="py-2"><Badge variant="outline" className="text-xs">Superseded</Badge></td>
                       <td className="py-2">
                         <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDownload(doc.file_path, doc.file_name)}>
                           <Download className="mr-1 h-3 w-3" /> View
                         </Button>
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
