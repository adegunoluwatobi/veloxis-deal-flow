import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, ArrowRight, FileText, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeKycStatus, groupDocumentsByExporter, type KycDocumentLike } from '@/lib/computeKycStatus';

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  created_at: string;
  contact_email: string | null;
}

interface ExporterDocumentRow extends KycDocumentLike {
  exporter_id: string;
  is_superseded: boolean;
}

interface RecentExporter extends ExporterRow {
  kyc: ReturnType<typeof computeKycStatus>;
}

interface DashboardStats {
  totalExporters: number;
  pendingReview: number;
  verified: number;
  docsToReview: number;
}

interface RoutedLead {
  id: string; full_name: string; company_name: string; country: string;
  commodity: string; invoice_size: string; email: string; phone: string;
  assigned_partner: string | null; status: string; created_at: string;
}

export default function GreystarDashboard() {
  const [stats, setStats] = useState<DashboardStats>({ totalExporters: 0, pendingReview: 0, verified: 0, docsToReview: 0 });
  const [recentExporters, setRecentExporters] = useState<RecentExporter[]>([]);
  const [routedLeads, setRoutedLeads] = useState<RoutedLead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const { data: exporterData } = await supabase
      .from('exporters')
      .select('id, company_name, rc_number, created_at, contact_email')
      .order('created_at', { ascending: false });

    const exporters = (exporterData as ExporterRow[]) ?? [];
    const exporterIds = exporters.map((exporter) => exporter.id);

    let documents: ExporterDocumentRow[] = [];

    if (exporterIds.length > 0) {
      const { data: docData } = await supabase
        .from('exporter_documents')
        .select('exporter_id, document_type, document_status, expiry_status, is_superseded')
        .in('exporter_id', exporterIds)
        .eq('is_superseded', false);

      documents = (docData as ExporterDocumentRow[]) ?? [];
    }

    const docsByExporter = groupDocumentsByExporter(documents);
    const exportersWithKyc = exporters.map((exporter) => ({
      ...exporter,
      kyc: computeKycStatus(docsByExporter.get(exporter.id) ?? []),
    }));

    setRecentExporters(exportersWithKyc.slice(0, 10));
    setStats({
      totalExporters: exporters.length,
      pendingReview: exportersWithKyc.filter((exporter) => exporter.kyc.status === 'under_review').length,
      verified: exportersWithKyc.filter((exporter) => exporter.kyc.status === 'verified').length,
      docsToReview: documents.filter((doc) => doc.document_status === 'pending_review').length,
    });

    // Load routed leads from exporter_applications matched by partner desk name
    const { data: leads } = await supabase
      .from('exporter_applications' as any)
      .select('id, full_name, company_name, country, commodity, invoice_size, email, phone, assigned_partner, status, created_at')
      .eq('status', 'routed')
      .order('created_at', { ascending: false });
    setRoutedLeads(((leads as any) || []) as RoutedLead[]);

    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('partner-dashboard-deals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Greystar Intake</h1>
          <p className="text-sm text-muted-foreground">Exporter onboarding and document review</p>
        </div>
        <Button asChild>
          <Link to="/greystar/exporters/new"><Plus className="mr-2 h-4 w-4" />New Exporter</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Exporters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-foreground">{stats.totalExporters}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-warning">{stats.pendingReview}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-success">{stats.verified}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Docs to Review</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-primary">{stats.docsToReview}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Exporters</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/greystar/exporters">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentExporters.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No exporters yet. <Link to="/greystar/exporters/new" className="text-primary underline">Create your first</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {recentExporters.slice(0, 5).map((exporter) => (
                <Link
                  key={exporter.id}
                  to={`/greystar/exporters/${exporter.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-foreground">{exporter.company_name}</p>
                    <p className="text-sm text-muted-foreground">RC {exporter.rc_number}</p>
                  </div>
                  <Badge variant="secondary" className={cn('font-medium', exporter.kyc.color)}>
                    {exporter.kyc.badgeLabel}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Routed Applications</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">New exporter leads assigned to your partner desk</p>
          </div>
          <Badge variant="secondary">{routedLeads.length}</Badge>
        </CardHeader>
        <CardContent>
          {routedLeads.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No routed applications yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Country</th>
                    <th className="py-2 pr-3">Commodity</th>
                    <th className="py-2 pr-3">Invoice Size</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {routedLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                      <td className="py-3 pr-3 font-medium text-foreground">{lead.full_name}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{lead.company_name}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{lead.country}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{lead.commodity}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{lead.invoice_size}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{lead.email}</td>
                      <td className="py-3 text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
