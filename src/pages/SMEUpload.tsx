import { useEffect, useState, useCallback } from 'react';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Upload, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import type { ExporterDocumentType } from '@/types';

const REQUIRED_DOCS: { type: ExporterDocumentType; label: string; needsExpiry: boolean }[] = [
  { type: 'cac_certificate', label: 'CAC Certificate', needsExpiry: false },
  { type: 'director_id', label: 'Director ID', needsExpiry: true },
  { type: 'nepc_certificate', label: 'NEPC Certificate', needsExpiry: true },
];

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

interface TokenInfo {
  token_id: string;
  exporter_id: string;
  company_name: string;
  is_valid: boolean;
}

interface DocUpload {
  file: File | null;
  expiryDate: string;
  uploaded: boolean;
  uploading: boolean;
}

export default function SMEUpload() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [uploads, setUploads] = useState<Record<ExporterDocumentType, DocUpload>>({
    cac_certificate: { file: null, expiryDate: '', uploaded: false, uploading: false },
    director_id: { file: null, expiryDate: '', uploaded: false, uploading: false },
    nepc_certificate: { file: null, expiryDate: '', uploaded: false, uploading: false },
    other: { file: null, expiryDate: '', uploaded: false, uploading: false },
  });

  const validateToken = useCallback(async () => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    const { data, error } = await supabase.rpc('validate_upload_token', { p_token: token });
    if (error || !data || data.length === 0 || !data[0].is_valid) {
      setInvalid(true);
    } else {
      setTokenInfo(data[0] as TokenInfo);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { validateToken(); }, [validateToken]);

  const handleFileSelect = (type: ExporterDocumentType, file: File | null) => {
    if (file) {
      if (!ALLOWED_MIME.includes(file.type)) {
        toast({ title: 'Invalid file type', description: 'Only PDF, JPEG, PNG, and WebP files are accepted.', variant: 'destructive' });
        return;
      }
      if (file.size > MAX_SIZE) {
        toast({ title: 'File too large', description: 'Maximum file size is 20MB.', variant: 'destructive' });
        return;
      }
    }
    setUploads(prev => ({ ...prev, [type]: { ...prev[type], file } }));
  };

  const handleUpload = async (type: ExporterDocumentType) => {
    const info = tokenInfo;
    const upload = uploads[type];
    if (!info || !upload.file) return;

    const doc = REQUIRED_DOCS.find(d => d.type === type);
    if (doc?.needsExpiry && !upload.expiryDate) {
      toast({ title: 'Expiry date required', description: `Please enter the expiry date for ${doc.label}.`, variant: 'destructive' });
      return;
    }

    setUploads(prev => ({ ...prev, [type]: { ...prev[type], uploading: true } }));

    try {
      const ext = upload.file.name.split('.').pop() ?? 'pdf';
      const filePath = `exporter-docs/${info.exporter_id}/${type}/${crypto.randomUUID()}_${sanitiseFilename(upload.file.name)}`;

      const { error: storageErr } = await supabase.storage
        .from('veloxis-documents')
        .upload(filePath, upload.file, { contentType: upload.file.type });

      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase.from('exporter_documents').insert({
        exporter_id: info.exporter_id,
        document_type: type,
        file_name: upload.file.name,
        file_path: filePath,
        file_size_bytes: upload.file.size,
        mime_type: upload.file.type,
        expiry_date: upload.expiryDate || null,
        uploaded_by_token_id: info.token_id,
      });

      if (dbErr) throw dbErr;

      // Mark first_used_at on token if not already set
      await supabase.from('exporter_upload_tokens')
        .update({ first_used_at: new Date().toISOString() })
        .eq('id', info.token_id)
        .is('first_used_at', null);

      setUploads(prev => ({ ...prev, [type]: { ...prev[type], uploaded: true, uploading: false } }));
      toast({ title: 'Document uploaded', description: `${doc?.label ?? type} uploaded successfully.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: 'Upload error', description: msg, variant: 'destructive' });
      setUploads(prev => ({ ...prev, [type]: { ...prev[type], uploading: false } }));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Invalid or Expired Link</h2>
            <p className="text-sm text-muted-foreground">
              This upload link is no longer valid. Please contact your originator for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allUploaded = REQUIRED_DOCS.every(d => uploads[d.type].uploaded);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Veloxis</span>
            <span className="ml-1 text-xs text-muted-foreground">Secure Document Upload</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Upload KYC Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            For <span className="font-medium text-foreground">{tokenInfo?.company_name}</span> — Upload the required
            documents below. Accepted formats: PDF, JPEG, PNG, WebP (max 20MB each).
          </p>
        </div>

        {allUploaded && (
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium text-foreground">All documents uploaded</p>
              <p className="text-xs text-muted-foreground">Your documents are now pending review. You may close this page.</p>
            </div>
          </div>
        )}

        {REQUIRED_DOCS.map(({ type, label, needsExpiry }) => {
          const u = uploads[type];
          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {u.uploaded ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">{label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {u.uploaded ? (
                  <p className="text-sm text-success">✓ Uploaded successfully</p>
                ) : (
                  <>
                    <div>
                      <Label htmlFor={`file-${type}`}>Document File</Label>
                      <Input
                        id={`file-${type}`}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => handleFileSelect(type, e.target.files?.[0] ?? null)}
                        className="mt-1"
                      />
                    </div>
                    {needsExpiry && (
                      <div>
                        <Label htmlFor={`expiry-${type}`}>Expiry Date</Label>
                        <Input
                          id={`expiry-${type}`}
                          type="date"
                          value={u.expiryDate}
                          onChange={(e) => setUploads(prev => ({ ...prev, [type]: { ...prev[type], expiryDate: e.target.value } }))}
                          className="mt-1"
                        />
                      </div>
                    )}
                    <Button
                      onClick={() => handleUpload(type)}
                      disabled={!u.file || u.uploading}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {u.uploading ? 'Uploading…' : `Upload ${label}`}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
