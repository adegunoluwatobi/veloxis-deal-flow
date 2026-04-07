import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { FileText, Upload, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  dealId: string;
  ipuVerified: boolean;
  ipuVerifiedAt: string | null;
  ipuDocuments: Array<{ id: string; file_name: string; uploaded_at: string }>;
  dealStatus: string;
  onReload: () => void;
}

export default function IpuUploadSection({
  dealId,
  ipuVerified,
  ipuVerifiedAt,
  ipuDocuments,
  dealStatus,
  onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const isSuperAdminOrDM = role === 'super_admin' || role === 'deal_manager';
  const canUpload = isSuperAdminOrDM && ['sent_to_veloxis', 'under_review', 'docs_requested', 'ready_for_final_approval'].includes(dealStatus);
  const canVerify = isSuperAdminOrDM && ipuDocuments.length > 0 && !ipuVerified;

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const filePath = `deals/${dealId}/ipu_${Date.now()}_${sanitiseFilename(file.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file);
      if (storageErr) throw storageErr;

      const { error: docErr } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        document_type: 'ipu_signed' as any,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (docErr) throw docErr;

      setFile(null);
      toast({ title: 'IPU document uploaded' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async () => {
    if (!user) return;
    setVerifying(true);
    try {
      const { error } = await supabase.from('deals').update({
        ipu_verified: true,
        ipu_verified_at: new Date().toISOString(),
        ipu_verified_by: user.id,
      } as any).eq('id', dealId);
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'ipu_verified' as any,
        p_metadata: { actor_name: user.email },
      });

      toast({ title: 'IPU verified', description: 'The Approve Deal button is now unlocked.' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Verification failed', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Irrevocable Payment Undertaking (IPU)</CardTitle>
          {ipuVerified ? (
            <Badge variant="secondary" className="bg-success/10 text-success text-xs gap-1 ml-auto">
              <ShieldCheck className="h-3 w-3" /> Verified
            </Badge>
          ) : ipuDocuments.length > 0 ? (
            <Badge variant="secondary" className="bg-warning/10 text-warning text-xs ml-auto">Uploaded — Pending Verification</Badge>
          ) : (
            <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs ml-auto">Required</Badge>
          )}
        </div>
        <CardDescription>Signed by Buyer — required before deal approval.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ipuDocuments.map(doc => (
          <div key={doc.id} className="flex items-center gap-2 text-sm rounded-lg border border-border p-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <span className="font-medium text-foreground truncate">{doc.file_name}</span>
            <span className="text-xs text-muted-foreground ml-auto">{new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</span>
          </div>
        ))}

        {canUpload && (
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="flex-1 h-8"
            />
            <Button size="sm" variant="outline" onClick={handleUpload} disabled={!file || uploading} className="h-8 gap-1">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        )}

        {canVerify && (
          <Button size="sm" onClick={handleVerify} disabled={verifying} className="gap-1">
            {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            {verifying ? 'Verifying…' : 'Verify IPU'}
          </Button>
        )}

        {ipuVerified && ipuVerifiedAt && (
          <p className="text-xs text-muted-foreground">
            Verified on {new Date(ipuVerifiedAt).toLocaleDateString('en-GB')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
