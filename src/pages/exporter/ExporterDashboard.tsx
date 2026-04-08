import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, FileText, ArrowRight, Clock, Upload, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeKycStatus } from '@/lib/computeKycStatus';
import DealStatusBadge from '@/components/DealStatusBadge';
import type { DealStatus } from '@/types';

interface ActionDeal {
  id: string;
  deal_reference: string | null;
  status: DealStatus;
  buyer_company_name: string | null;
  invoice_value: number | null;
  invoice_currency_v2: string | null;
}

const ACTION_STATUSES: DealStatus[] = [
  'changes_requested',
  'pending_exporter_acceptance',
  'docs_requested',
  'payment_received',
];

function getActionMessage(status: DealStatus): { icon: React.ReactNode; message: string } {
  switch (status) {
    case 'changes_requested':
      return { icon: <AlertTriangle className="h-4 w-4 text-warning" />, message: 'Changes requested — update and resubmit' };
    case 'pending_exporter_acceptance':
      return { icon: <Clock className="h-4 w-4 text-primary" />, message: 'Facility offer received — review and accept or decline' };
    case 'docs_requested':
      return { icon: <Upload className="h-4 w-4 text-warning" />, message: 'Documents requested — upload required documents' };
    case 'payment_received':
      return { icon: <Banknote className="h-4 w-4 text-success" />, message: 'Payment received — confirm receipt of residual balance' };
    default:
      return { icon: <AlertTriangle className="h-4 w-4" />, message: 'Action required' };
  }
}

export default function ExporterDashboard() {
  const { user } = useAuth();
  const [exporter, setExporter] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [actionDeals, setActionDeals] = useState<ActionDeal[]>([]);
  const [recentDeals, setRecentDeals] = useState<ActionDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: exp } = await supabase
        .from('exporters')
        .select('*')
        .eq('exporter_user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (exp) {
        setExporter(exp);
        const [docsRes, dealsRes] = await Promise.all([
          supabase
            .from('exporter_documents')
            .select('*')
            .eq('exporter_id', exp.id)
            .eq('is_superseded', false)
            .order('uploaded_at', { ascending: false }),
          supabase
            .from('deals')
            .select('id, deal_reference, status, buyer_company_name, invoice_value, invoice_currency_v2')
            .eq('exporter_id', exp.id)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);
        setDocuments(docsRes.data ?? []);
        const allDeals = (dealsRes.data ?? []) as ActionDeal[];
        setActionDeals(allDeals.filter(d => ACTION_STATUSES.includes(d.status)));
        setRecentDeals(allDeals.slice(0, 5));
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

  const kyc = computeKycStatus(documents);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{exporter.company_name}</h1>
        <p className="text-sm text-muted-foreground">RC {exporter.rc_number} · {exporter.director_name}</p>
      </div>

      {/* Action Required Cards */}
      {actionDeals.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Action Required</h2>
          {actionDeals.map(deal => {
            const { icon, message } = getActionMessage(deal.status);
            return (
              <Link key={deal.id} to={`/exporter/deals/${deal.id}`}>
                <Card className="border-warning/50 hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="py-3 flex items-center gap-3">
                    {icon}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {deal.deal_reference || deal.id.slice(0, 8)} — {deal.buyer_company_name || 'Unknown Buyer'}
                      </p>
                      <p className="text-xs text-muted-foreground">{message}</p>
                    </div>
                    <DealStatusBadge status={deal.status} portal="exporter" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* KYC Banner — derived from documents */}
      <div className={cn('rounded-lg border p-4', kyc.borderColor)}>
        <div className="flex items-center gap-2">
          {kyc.status === 'verified' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          <span className="font-semibold">KYC Status: {kyc.label}</span>
        </div>
        <p className="mt-1 text-sm">{kyc.description}</p>
      </div>

      {/* Recent Deals */}
      {recentDeals.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Applications</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/exporter/deals">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {recentDeals.map(deal => (
                <Link
                  key={deal.id}
                  to={`/exporter/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium text-foreground">{deal.deal_reference || deal.id.slice(0, 8)}</span>
                  <DealStatusBadge status={deal.status} portal="exporter" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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