import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { sanitiseFilename } from '@/lib/sanitiseFilename';

interface DocRequest {
  id: string;
  document_type: string;
  label: string;
  notes: string | null;
  status: string;
  uploaded_doc_id: string | null;
}

interface Props {
  dealId: string;
  dealStatus: string;
  onReload: () => void;
}

export default function ExporterDocRequestBanner({ dealId, dealStatus, onReload }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadRequests = async () => {
    const { data } = await supabase
      .from('deal_doc_requests' as any)
      .select('*')
      .eq('deal_id', dealId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setRequests((data as unknown as DocRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [dealId]);

  const handleUpload = async (req: DocRequest, file: File) => {
    if (!user) return;
    setUploading(req.id);
    try {
      const safeName = sanitiseFilename(file.name);
      const path = `deals/${dealId}/${req.document_type}/${Date.now()}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from('veloxis-documents')
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      // Insert deal document
      const { data: docData, error: insertErr } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        document_type: req.document_type as any,
        file_name: file.name,
        file_path: path,
        uploaded_by: user.id,
        file_size_bytes: file.size,
        mime_type: file.type,
      }).select('id').single();
      if (insertErr) throw insertErr;

      // Mark request as uploaded
      await supabase
        .from('deal_doc_requests' as any)
        .update({ status: 'uploaded', uploaded_doc_id: docData.id })
        .eq('id', req.id);

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: 'exporter' as any,
        p_action_type: 'deal_document_uploaded' as any,
        p_metadata: { document_type: req.document_type, label: req.label, file_name: file.name },
      });

      toast({ title: `${req.label} uploaded` });

      // Check if all requests for this deal are now uploaded
      const { data: remaining } = await supabase
        .from('deal_doc_requests' as any)
        .select('id')
        .eq('deal_id', dealId)
        .eq('status', 'pending');

      if (!remaining || remaining.length === 0) {
        // All docs uploaded — move status back to sent_to_veloxis (under review)
        await supabase.from('deals')
          .update({ status: 'sent_to_veloxis' as any })
          .eq('id', dealId);

        await supabase.rpc('insert_audit_log', {
          p_deal_id: dealId,
          p_user_id: user.id,
          p_user_role: 'exporter' as any,
          p_action_type: 'deal_status_changed' as any,
          p_metadata: {
            actor_name: user.email,
            from: 'docs_requested',
            to: 'sent_to_veloxis',
            reason: 'All requested documents uploaded',
          },
        });

        toast({ title: 'All requested documents uploaded — application returned to review' });
      }

      await loadRequests();
      onReload();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  if (loading || requests.length === 0) return null;
  if (dealStatus !== 'docs_requested') return null;

  const sharedNotes = requests[0]?.notes;

  return (
    <Card className="border-warning">
      <CardContent className="py-4 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">
              The underwriter has requested the following documents. Please upload them to continue.
            </p>
            {sharedNotes && (
              <p className="text-sm text-muted-foreground italic">"{sharedNotes}"</p>
            )}
          </div>
        </div>

        <div className="space-y-3 ml-8">
          {requests.map(req => (
            <div key={req.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                {req.status === 'uploaded' ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                )}
                <span className="text-sm font-medium">{req.label}</span>
                <Badge variant="secondary" className="text-xs bg-warning/10 text-warning">Required</Badge>
              </div>
              <div>
                {req.status === 'pending' && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(req, file);
                      }}
                      disabled={uploading === req.id}
                    />
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 pointer-events-none" disabled={uploading === req.id}>
                      {uploading === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      {uploading === req.id ? 'Uploading…' : 'Upload'}
                    </Button>
                  </label>
                )}
                {req.status === 'uploaded' && (
                  <Badge variant="secondary" className="text-xs bg-success/10 text-success">Uploaded</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
