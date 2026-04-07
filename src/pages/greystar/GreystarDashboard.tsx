import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, ArrowRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { KYC_STATUS_LABELS, type KycStatus } from '@/types';
import { cn } from '@/lib/utils';

const KYC_COLORS: Record<KycStatus, string> = {
  pending_documents: 'bg-muted text-muted-foreground',
  documents_uploaded: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  verified: 'bg-success/10 text-success',
  kyc_document_expired: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function GreystarDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, expired: 0 });
  const [recentExporters, setRecentExporters] = useState<any[]>([]);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: exporters } = await supabase
        .from('exporters')
        .select('id, company_name, rc_number, kyc_status, created_at, contact_email')
        .order('created_at', { ascending: false })
        .limit(10);

      const list = exporters ?? [];
      setRecentExporters(list);
      setStats({
        total: list.length,
        pending: list.filter((e: any) => ['pending_documents', 'documents_uploaded'].includes(e.kyc_status)).length,
        verified: list.filter((e: any) => e.kyc_status === 'verified').length,
        expired: list.filter((e: any) => e.kyc_status === 'kyc_document_expired').length,
      });

      const { count } = await supabase
        .from('exporter_documents')
        .select('id', { count: 'exact', head: true })
        .eq('document_status', 'pending_review')
        .eq('is_superseded', false);
      setPendingDocs(count ?? 0);
      setLoading(false);
    };
    load();
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
          <CardContent><div className="text-3xl font-bold text-foreground">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-warning">{stats.pending}</div></CardContent>
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
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-destructive">{pendingDocs}</div></CardContent>
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
              {recentExporters.slice(0, 5).map((exp: any) => (
                <Link
                  key={exp.id}
                  to={`/greystar/exporters/${exp.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-foreground">{exp.company_name}</p>
                    <p className="text-sm text-muted-foreground">RC {exp.rc_number}</p>
                  </div>
                  <Badge variant="secondary" className={cn('font-medium', KYC_COLORS[exp.kyc_status as KycStatus])}>
                    {KYC_STATUS_LABELS[exp.kyc_status as KycStatus]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
