import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  KYC_STATUS_LABELS, ENTITY_TYPE_LABELS,
  type KycStatus, type EntityType, type ExporterDocumentType, type ExpiryStatus,
} from '@/types';
import { cn } from '@/lib/utils';
import { computeKycStatus } from '@/lib/computeKycStatus';
import {
  ArrowLeft, Building2, Shield, ShieldCheck, ShieldX, AlertTriangle,
  FileText, Copy, ExternalLink, CheckCircle2, XCircle, Clock, Upload, Download, Eye,
} from 'lucide-react';
import DocumentRequestSection from '@/components/DocumentRequestSection';

const KYC_COLORS: Record<KycStatus, string> = {
  pending_documents: 'bg-muted text-muted-foreground',
  documents_uploaded: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  verified: 'bg-success/10 text-success',
  kyc_document_expired: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
};

const KYC_ICONS: Record<KycStatus, React.ElementType> = {
  pending_documents: Clock,
  documents_uploaded: Upload,
  under_review: Shield,
  verified: ShieldCheck,
  kyc_document_expired: AlertTriangle,
  rejected: ShieldX,
};

const DOC_TYPE_LABELS: Record<ExporterDocumentType, string> = {
  cac_certificate: 'CAC Certificate',
  director_id: 'Director ID',
  nepc_certificate: 'NEPC Certificate',
  ubo_declaration_doc: 'UBO Declaration',
  source_of_funds_doc: 'Source of Funds',
  bank_statements: 'Bank Statements',
  other: 'Other',
};

const EXPIRY_COLORS: Record<ExpiryStatus, string> = {
  valid: 'text-success',
  expiring_soon_60: 'text-warning',
  expiring_soon_30: 'text-warning',
  expiring_soon_7: 'text-destructive',
  expired: 'text-destructive',
  no_expiry: 'text-muted-foreground',
};

const DOC_STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  pending_review: { color: 'bg-warning/10 text-warning', icon: Clock },
  verified: { color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { color: 'bg-destructive/10 text-destructive', icon: XCircle },
  expired: { color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
};

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  entity_type: EntityType;
  director_name: string;
  country: string;
  kyc_status: KycStatus;
  subscription_tier: string;
  created_at: string;
}

interface DocRow {
  id: string;
  document_type: ExporterDocumentType;
  file_name: string;
  file_path: string;
  expiry_date: string | null;
  expiry_status: ExpiryStatus;
  document_status: string;
  is_superseded: boolean;
  uploaded_at: string;
  uploaded_by_user_id: string | null;
  uploaded_by_token_id: string | null;
  verified_by: string | null;
  verified_at: string | null;
}

export default function ExporterDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exporter, setExporter] = useState<ExporterRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [tokenUrl, setTokenUrl] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [expRes, docsRes] = await Promise.all([
      supabase.from('exporters').select('*').eq('id', id).single(),
      supabase.from('exporter_documents').select('*').eq('exporter_id', id).order('uploaded_at', { ascending: false }),
    ]);
    if (expRes.data) setExporter(expRes.data as unknown as ExporterRow);
    setDocs((docsRes.data as unknown as DocRow[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (filePath: string) => {
    const { data, error } = await supabase.storage.from('veloxis-documents').createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Download failed', description: 'Could not generate download link.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleVerifyExporter = async () => {
    if (!id || !user) return;
    // Check all 3 mandatory docs are verified
    const activeDocs = docs.filter(d => !d.is_superseded);
    const mandatoryTypes: ExporterDocumentType[] = ['cac_certificate', 'director_id', 'nepc_certificate'];
    const missing = mandatoryTypes.filter(t => !activeDocs.find(d => d.document_type === t && d.document_status === 'verified'));
    if (missing.length > 0) {
      toast({
        title: 'Cannot verify',
        description: `Missing verified documents: ${missing.map(t => DOC_TYPE_LABELS[t]).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    const { error } = await supabase.from('exporters').update({
      kyc_status: 'verified' as KycStatus,
      kyc_verified_by: user.id,
      kyc_verified_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Exporter verified', description: 'KYC status set to Verified.' });
      load();
    }
  };

  const generateUploadToken = async () => {
    if (!id || !user) return;
    setGeneratingToken(true);
    try {
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from('exporter_upload_tokens').insert({
        exporter_id: id,
        created_by: user.id,
        expires_at: expiresAt,
      }).select('token').single();
      if (error) throw error;
      const url = `${window.location.origin}/upload/${data.token}`;
      setTokenUrl(url);
      toast({ title: 'Upload token generated' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate token';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setGeneratingToken(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  if (!exporter) return <div className="py-20 text-center text-muted-foreground">Exporter not found.</div>;

  const activeDocs = docs.filter(d => !d.is_superseded);
  const supersededDocs = docs.filter(d => d.is_superseded);
  const visibleDocs = showSuperseded ? docs : activeDocs;
  const kyc = computeKycStatus(activeDocs);
  const KycIcon = KYC_ICONS[kyc.status === 'expired' ? 'kyc_document_expired' : kyc.status === 'under_review' ? 'under_review' : kyc.status === 'rejected' ? 'rejected' : kyc.status === 'verified' ? 'verified' : 'pending_documents'];

  const mandatoryTypes: ExporterDocumentType[] = ['cac_certificate', 'director_id', 'nepc_certificate'];
  const docSummary = mandatoryTypes.map(t => {
    const doc = activeDocs.find(d => d.document_type === t);
    return { type: t, label: DOC_TYPE_LABELS[t], doc };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate('/exporters')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Exporters
      </Button>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <Eye className="h-4 w-4" /> Read-only view. Document verification is managed by the partner organisation.
      </div>

      {/* KYC Status Banner — derived from documents */}
      <div className={cn('flex items-center gap-3 rounded-lg border p-4', kyc.borderColor)}>
        <KycIcon className={cn('h-5 w-5', kyc.color.split(' ')[1])} />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">KYC Status: {kyc.label}</p>
          <p className="text-xs text-muted-foreground">{kyc.description}</p>
        </div>
      </div>

      {/* Company Identity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{exporter.company_name}</CardTitle>
              <CardDescription>RC {exporter.rc_number} · {ENTITY_TYPE_LABELS[exporter.entity_type]}</CardDescription>
            </div>
            <Badge variant="secondary" className={cn('ml-auto font-medium', kyc.color)}>
              {kyc.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Director</p>
              <p className="font-medium text-foreground">{exporter.director_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Country</p>
              <p className="font-medium text-foreground">{exporter.country}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Subscription</p>
              <p className="font-medium text-foreground">{exporter.subscription_tier === 'veloxis_pro' ? 'Veloxis Pro' : 'Pay As You Go'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium text-foreground">{new Date(exporter.created_at).toLocaleDateString('en-GB')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">KYC Document Checklist</CardTitle>
            <div className="flex gap-2">
              {(role === 'partner_staff' || role === 'partner_admin') && (
                <Button variant="outline" size="sm" onClick={generateUploadToken} disabled={generatingToken}>
                  {generatingToken ? 'Generating…' : 'Generate Upload Link'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tokenUrl && (
            <div className="mb-4 flex gap-2 rounded-lg border border-border bg-muted/50 p-3">
              <Input value={tokenUrl} readOnly className="text-xs font-mono flex-1" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(tokenUrl); toast({ title: 'Copied' }); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => {
                const text = encodeURIComponent(`Upload your KYC documents:\n${tokenUrl}`);
                window.open(`https://wa.me/?text=${text}`, '_blank');
              }}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {docSummary.map(({ type, label, doc }) => {
              const status = doc?.document_status ?? 'missing';
              const cfg = DOC_STATUS_CONFIG[status];
              const StatusIcon = cfg?.icon ?? FileText;
              return (
                <div key={type} className={cn(
                  'rounded-lg border p-3',
                  !doc ? 'border-dashed border-muted-foreground/30' : 'border-border'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusIcon className={cn('h-4 w-4', cfg?.color.split(' ')[1] ?? 'text-muted-foreground')} />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                  {doc ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                      <Badge variant="secondary" className={cn('text-xs', cfg?.color)}>
                        {status === 'pending_review' ? 'Pending Review' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                      {doc.expiry_date && (
                        <p className={cn('text-xs', EXPIRY_COLORS[doc.expiry_status])}>
                          Expires: {new Date(doc.expiry_date).toLocaleDateString('en-GB')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not uploaded</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Requested Documents */}
      <DocumentRequestSection exporterId={id!} mode="admin" />

      {/* Document History Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Document History</CardTitle>
            {supersededDocs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowSuperseded(!showSuperseded)}>
                {showSuperseded ? 'Hide superseded' : `Show ${supersededDocs.length} superseded`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {visibleDocs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  {<TableHead className="text-right">View</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDocs.map((doc) => {
                  const cfg = DOC_STATUS_CONFIG[doc.document_status];
                  const StatusIcon = cfg?.icon ?? FileText;
                  return (
                    <TableRow key={doc.id} className={cn(doc.is_superseded && 'opacity-50')}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{DOC_TYPE_LABELS[doc.document_type]}</span>
                          {doc.is_superseded && <Badge variant="outline" className="text-xs">Superseded</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {doc.file_name}
                      </TableCell>
                      <TableCell>
                        {doc.expiry_date ? (
                          <span className={cn('text-sm', EXPIRY_COLORS[doc.expiry_status])}>
                            {new Date(doc.expiry_date).toLocaleDateString('en-GB')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-xs gap-1', cfg?.color)}>
                          <StatusIcon className="h-3 w-3" />
                          {doc.document_status === 'pending_review' ? 'Pending' : doc.document_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}
                        <br />
                        <span className="text-xs">
                          {doc.uploaded_by_token_id ? 'via upload link' : 'by originator'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDownload(doc.file_path)}>
                            <Download className="mr-1 h-3 w-3" /> View
                          </Button>
                        </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
