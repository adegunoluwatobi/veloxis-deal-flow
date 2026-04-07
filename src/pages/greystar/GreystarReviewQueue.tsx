import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const DOC_TYPE_LABELS: Record<string, string> = {
  cac_certificate: 'CAC Certificate',
  director_id: 'Director ID',
  nepc_certificate: 'NEPC Certificate',
  other: 'Other',
};

export default function GreystarReviewQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('exporter_documents')
      .select('*, exporters!exporter_documents_exporter_id_fkey(company_name, id)')
      .eq('document_status', 'pending_review')
      .eq('is_superseded', false)
      .order('uploaded_at', { ascending: true });
    setDocs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleVerify = async (doc: any) => {
    if (!user) return;
    await supabase.from('exporter_documents').update({
      document_status: 'verified',
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    }).eq('id', doc.id);
    await supabase.rpc('insert_audit_log', {
      p_exporter_id: doc.exporter_id,
      p_user_id: user.id,
      p_user_role: 'partner_staff' as any,
      p_action_type: 'exporter_document_verified' as any,
      p_metadata: { document_id: doc.id, document_type: doc.document_type },
    });
    toast({ title: 'Document verified' });
    load();
  };

  const handleReject = async (doc: any) => {
    if (!user) return;
    await supabase.from('exporter_documents').update({ document_status: 'rejected' }).eq('id', doc.id);
    await supabase.rpc('insert_audit_log', {
      p_exporter_id: doc.exporter_id,
      p_user_id: user.id,
      p_user_role: 'originator_staff' as any,
      p_action_type: 'kyc_rejected' as any,
      p_metadata: { document_id: doc.id, document_type: doc.document_type },
    });
    toast({ title: 'Document rejected' });
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground">Documents pending Greystar review</p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            No documents pending review.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Pending Documents ({docs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Exporter</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">File</th>
                    <th className="pb-2 font-medium">Uploaded By</th>
                    <th className="pb-2 font-medium">Uploaded</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-3">
                        <Link to={`/greystar/exporters/${doc.exporter_id}`} className="text-primary underline">
                          {(doc.exporters as any)?.company_name ?? 'Unknown'}
                        </Link>
                      </td>
                      <td className="py-3">{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</td>
                      <td className="py-3 max-w-[200px] truncate">{doc.file_name}</td>
                      <td className="py-3">
                        <Badge variant="outline" className="text-xs">
                          {doc.uploaded_by_role === 'originator_staff' ? 'Greystar' : doc.uploaded_by_role === 'exporter' ? 'Exporter' : 'Token'}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => handleVerify(doc)}>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Verify
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleReject(doc)}>
                            <XCircle className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </div>
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
