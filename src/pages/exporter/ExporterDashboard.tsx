import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KYC_STATUS_LABELS, type KycStatus } from '@/types';
import { AlertTriangle, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const KYC_COLORS: Record<KycStatus, string> = {
  pending_documents: 'bg-muted text-muted-foreground',
  documents_uploaded: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  verified: 'bg-success/10 text-success',
  kyc_document_expired: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function ExporterDashboard() {
  const { user } = useAuth();
  const [exporter, setExporter] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Find the exporter linked to this user
      const { data: exp } = await supabase
        .from('exporters')
        .select('*')
        .eq('exporter_user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (exp) {
        setExporter(exp);
        const { data: docs } = await supabase
          .from('exporter_documents')
          .select('*')
          .eq('exporter_id', exp.id)
          .eq('is_superseded', false)
          .order('uploaded_at', { ascending: false });
        setDocuments(docs ?? []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;

  if (!exporter) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-4 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">No Exporter Profile Found</h2>
        <p className="text-sm text-muted-foreground mt-1">Your account is not linked to an exporter profile yet.</p>
      </div>
    );
  }

  const DOC_TYPE_LABELS: Record<string, string> = {
    cac_certificate: 'CAC Certificate',
    director_id: 'Director ID',
    nepc_certificate: 'NEPC Certificate',
    other: 'Other',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{exporter.company_name}</h1>
        <p className="text-sm text-muted-foreground">RC {exporter.rc_number} · {exporter.director_name}</p>
      </div>

      {/* KYC Banner */}
      <div className={cn('rounded-lg border p-4', KYC_COLORS[exporter.kyc_status as KycStatus])}>
        <div className="flex items-center gap-2">
          {exporter.kyc_status === 'verified' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          <span className="font-semibold">KYC Status: {KYC_STATUS_LABELS[exporter.kyc_status as KycStatus]}</span>
        </div>
        {exporter.kyc_status === 'pending_documents' && (
          <p className="mt-1 text-sm">Please upload your CAC Certificate, Director ID, and NEPC Certificate.</p>
        )}
      </div>

      {/* Documents Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Documents</CardTitle>
            <CardDescription>Upload and track your KYC documents</CardDescription>
          </div>
          <Button asChild size="sm">
            <Link to="/exporter/documents">Upload Documents <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</p>
                      <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={cn('text-xs',
                    doc.document_status === 'verified' ? 'bg-success/10 text-success' :
                    doc.document_status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                    'bg-warning/10 text-warning'
                  )}>
                    {doc.document_status === 'pending_review' ? 'Pending Review' : doc.document_status === 'verified' ? 'Verified' : 'Rejected'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
