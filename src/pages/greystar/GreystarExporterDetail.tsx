import { useEffect, useState } from 'react';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, Copy, ExternalLink, FileText, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { KYC_STATUS_LABELS, type KycStatus, type ExporterDocumentType } from '@/types';
import { cn } from '@/lib/utils';

const DOC_TYPE_LABELS: Record<ExporterDocumentType, string> = {
  cac_certificate: 'CAC Certificate',
  director_id: 'Director ID',
  nepc_certificate: 'NEPC Certificate',
  other: 'Other',
};

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exporter, setExporter] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadTokenUrl, setUploadTokenUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    document_type: '' as ExporterDocumentType | '',
    expiry_date: '',
    file: null as File | null,
  });

  const load = async () => {
    if (!id) return;
    const [expRes, docsRes, tokenRes] = await Promise.all([
      supabase.from('exporters').select('*').eq('id', id).single(),
      supabase.from('exporter_documents').select('*').eq('exporter_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('exporter_upload_tokens').select('token, expires_at, is_active').eq('exporter_id', id).eq('is_active', true).order('created_at', { ascending: false }).limit(1),
    ]);
    setExporter(expRes.data);
    setDocuments(docsRes.data ?? []);
    if (tokenRes.data?.[0]) {
      const token = tokenRes.data[0];
      const isValid = token.is_active && new Date(token.expires_at) > new Date();
      setUploadTokenUrl(isValid ? `${window.location.origin}/upload/${token.token}` : '');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleUpload = async () => {
    if (!user || !id || !uploadForm.file || !uploadForm.document_type) return;
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
        expiry_date: uploadForm.expiry_date || null,
        uploaded_by_user_id: user.id,
        uploaded_by_role: 'greystar_originator',
        document_status: 'pending_review',
      });
      if (docErr) throw docErr;

      await supabase.rpc('insert_audit_log', {
        p_exporter_id: id,
        p_user_id: user.id,
        p_user_role: 'greystar_originator' as any,
        p_action_type: 'exporter_document_uploaded' as any,
        p_metadata: { document_type: uploadForm.document_type, file_name: file.name, uploaded_by: 'greystar' },
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
      p_user_role: 'greystar_originator' as any,
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
      p_user_role: 'greystar_originator' as any,
      p_action_type: 'kyc_rejected' as any,
      p_metadata: { document_id: docId },
    });
    toast({ title: 'Document rejected' });
    load();
  };

  const generateNewToken = async () => {
    if (!user || !id) return;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('exporter_upload_tokens').insert({
      exporter_id: id,
      created_by: user.id,
      expires_at: expiresAt,
    }).select('token').single();
    if (data) {
      setUploadTokenUrl(`${window.location.origin}/upload/${data.token}`);
      toast({ title: 'New upload link generated' });
    }
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

      toast({
        title: 'Invite resent',
        description: `A fresh invitation was sent to ${exporter.contact_email}.`,
      });

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

  const activeDocs = documents.filter((d) => !d.is_superseded);
  const supersededDocs = documents.filter((d) => d.is_superseded);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate('/greystar/exporters')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Exporters
      </Button>

      {/* KYC Banner */}
      <div className={cn('rounded-lg border p-4', KYC_COLORS[exporter.kyc_status as KycStatus])}>
        <div className="flex items-center gap-2">
          {exporter.kyc_status === 'verified' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          <span className="font-semibold">KYC Status: {KYC_STATUS_LABELS[exporter.kyc_status as KycStatus]}</span>
        </div>
      </div>

      {/* Onboarding Approval Banner */}
      {exporter.onboarding_status === 'onboarding_submitted' && (
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
                toast({ title: 'Onboarding rejected', description: 'Exporter can revise and resubmit.' });
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
                toast({ title: 'Onboarding approved', description: 'Exporter now has full platform access.' });
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
          {exporter.onboarding_status === 'invited' && exporter.contact_email && (
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

      {/* Upload on behalf */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Upload on Behalf of Exporter</CardTitle>
          <CardDescription>Upload KYC documents for this exporter. Documents will go to the review queue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={uploadForm.document_type} onValueChange={(v) => setUploadForm({ ...uploadForm, document_type: v as ExporterDocumentType })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(DOC_TYPE_LABELS) as [ExporterDocumentType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiry Date (if applicable)</Label>
              <Input type="date" value={uploadForm.expiry_date} onChange={(e) => setUploadForm({ ...uploadForm, expiry_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] ?? null })} />
          </div>
          <Button onClick={handleUpload} disabled={!uploadForm.document_type || !uploadForm.file || uploading}>
            {uploading ? 'Uploading…' : 'Upload Document'}
          </Button>
        </CardContent>
      </Card>

      {/* Secure upload link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Secure Upload Link for Exporter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {uploadTokenUrl ? (
            <div className="flex gap-2">
              <Input value={uploadTokenUrl} readOnly className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(uploadTokenUrl); toast({ title: 'Copied' }); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active upload link.</p>
          )}
          <Button variant="outline" size="sm" onClick={generateNewToken}>Generate New Link</Button>
        </CardContent>
      </Card>

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
                    <th className="pb-2 font-medium">Actions</th>
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
                          {doc.uploaded_by_role === 'greystar_originator' ? 'Greystar' : doc.uploaded_by_role === 'exporter' ? 'Exporter' : 'Token'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary" className={cn('text-xs', DOC_STATUS_COLORS[doc.document_status] ?? '')}>
                          {doc.document_status === 'pending_review' ? 'Pending' : doc.document_status === 'verified' ? 'Verified' : 'Rejected'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {doc.document_status === 'pending_review' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => handleVerify(doc.id)}>
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Verify
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleReject(doc.id)}>
                              <XCircle className="mr-1 h-3 w-3" /> Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <th className="pb-2 font-medium">Uploaded</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {supersededDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-2">{DOC_TYPE_LABELS[doc.document_type as ExporterDocumentType] ?? doc.document_type}</td>
                      <td className="py-2 max-w-[200px] truncate">{doc.file_name}</td>
                      <td className="py-2">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                      <td className="py-2"><Badge variant="outline" className="text-xs">Superseded</Badge></td>
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
