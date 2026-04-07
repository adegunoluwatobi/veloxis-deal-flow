import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, FileText, Clock, UserCheck } from 'lucide-react';
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
  const [pendingExporters, setPendingExporters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [docsRes, exportersRes] = await Promise.all([
      supabase
        .from('exporter_documents')
        .select('*, exporters!exporter_documents_exporter_id_fkey(company_name, id)')
        .eq('document_status', 'pending_review')
        .eq('is_superseded', false)
        .order('uploaded_at', { ascending: true }),
      supabase
        .from('exporters')
        .select('id, company_name, contact_email, director_name, onboarding_status, updated_at')
        .eq('onboarding_status', 'onboarding_submitted')
        .order('updated_at', { ascending: true }),
    ]);
    setDocs(docsRes.data ?? []);
    setPendingExporters(exportersRes.data ?? []);
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
      p_user_role: 'partner_staff' as any,
      p_action_type: 'kyc_rejected' as any,
      p_metadata: { document_id: doc.id, document_type: doc.document_type },
    });
    toast({ title: 'Document rejected' });
    load();
  };

  const handleApproveOnboarding = async (exporterId: string) => {
    if (!user) return;
    await supabase.from('exporters').update({ onboarding_status: 'onboarding_approved' as any }).eq('id', exporterId);
    await supabase.rpc('insert_audit_log', {
      p_exporter_id: exporterId,
      p_user_id: user.id,
      p_user_role: 'partner_staff' as any,
      p_action_type: 'onboarding_approved' as any,
      p_metadata: {},
    });
    toast({ title: 'Onboarding approved', description: 'Exporter now has full platform access.' });
    load();
  };

  const handleRejectOnboarding = async (exporterId: string) => {
    if (!user) return;
    await supabase.from('exporters').update({ onboarding_status: 'onboarding_rejected' as any }).eq('id', exporterId);
    await supabase.rpc('insert_audit_log', {
      p_exporter_id: exporterId,
      p_user_id: user.id,
      p_user_role: 'partner_staff' as any,
      p_action_type: 'onboarding_rejected' as any,
      p_metadata: {},
    });
    toast({ title: 'Onboarding rejected', description: 'Exporter can revise and resubmit.' });
    load();
  };

  const totalPending = docs.length + pendingExporters.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground">Onboarding approvals and documents pending review</p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : totalPending === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            Nothing pending review.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={pendingExporters.length > 0 ? 'onboarding' : 'documents'}>
          <TabsList>
            <TabsTrigger value="onboarding" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Onboarding ({pendingExporters.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents ({docs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="onboarding" className="mt-4">
            {pendingExporters.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No onboarding submissions pending.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {pendingExporters.map((exp) => (
                  <Card key={exp.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-warning" />
                        <div>
                          <Link to={`/greystar/exporters/${exp.id}`} className="font-semibold text-foreground hover:underline">
                            {exp.company_name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {exp.director_name} · {exp.contact_email ?? 'No email'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleRejectOnboarding(exp.id)}>
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => handleApproveOnboarding(exp.id)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            {docs.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No documents pending review.</CardContent></Card>
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
                                {doc.uploaded_by_role === 'partner_staff' ? 'Partner' : doc.uploaded_by_role === 'exporter' ? 'Exporter' : 'Token'}
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
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
