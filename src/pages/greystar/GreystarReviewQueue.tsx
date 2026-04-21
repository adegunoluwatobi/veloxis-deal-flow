import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, FileText, UserCheck, Inbox, Loader2 } from 'lucide-react';

interface AppChangeRow {
  id: string;
  deal_id: string;
  status: string;
  created_at: string;
  fields_flagged: any;
  deals: {
    id: string;
    deal_reference: string | null;
    invoice_number: string | null;
    exporter_id: string;
    exporters: { company_name: string } | null;
  } | null;
}

interface ProfileChangeRow {
  id: string;
  exporter_id: string;
  status: string;
  created_at: string;
  proposed_changes: Record<string, unknown>;
  exporters: { company_name: string } | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function GreystarReviewQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appReqs, setAppReqs] = useState<AppChangeRow[]>([]);
  const [profileReqs, setProfileReqs] = useState<ProfileChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [appRes, profRes] = await Promise.all([
      supabase
        .from('deal_change_requests')
        .select('id, deal_id, status, created_at, fields_flagged, deals!inner(id, deal_reference, invoice_number, exporter_id, exporters!inner(company_name))')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('kyc_profile_change_requests')
        .select('id, exporter_id, status, created_at, proposed_changes, exporters!inner(company_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ]);
    setAppReqs((appRes.data as any[] | null) ?? []);
    setProfileReqs((profRes.data as any[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleResolveAppReq = async (req: AppChangeRow) => {
    if (!user) return;
    setActingId(req.id);
    const { error } = await supabase
      .from('deal_change_requests')
      .update({ status: 'resolved' as any, resolved_at: new Date().toISOString() })
      .eq('id', req.id);
    setActingId(null);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Marked resolved' });
    load();
  };

  const handleCancelAppReq = async (req: AppChangeRow) => {
    if (!user) return;
    setActingId(req.id);
    const { error } = await supabase
      .from('deal_change_requests')
      .update({ status: 'cancelled' as any, resolved_at: new Date().toISOString() })
      .eq('id', req.id);
    setActingId(null);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Request cancelled' });
    load();
  };

  const handleProfileDecision = async (req: ProfileChangeRow, decision: 'approved' | 'rejected') => {
    setActingId(req.id);
    const { data, error } = await supabase.functions.invoke('kyc-change-review', {
      body: { request_id: req.id, decision },
    });
    setActingId(null);
    if (error || (data as any)?.error) {
      toast({
        title: 'Failed',
        description: (data as any)?.error ?? error?.message ?? 'Could not process decision',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: decision === 'approved' ? 'Profile change approved' : 'Profile change rejected' });
    load();
  };

  const total = appReqs.length + profileReqs.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Requests</h1>
        <p className="text-sm text-muted-foreground">
          Pending change requests for applications and exporter profiles assigned to your organisation.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            No pending requests.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Application Change Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Application Change Requests
                <Badge variant="secondary" className="ml-1">{appReqs.length}</Badge>
              </CardTitle>
              <CardDescription>
                Field-level change requests sent to exporters on their applications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appReqs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No pending application change requests.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                        <th className="pb-2">Exporter</th>
                        <th className="pb-2">Application</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Submitted</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {appReqs.map((req) => {
                        const ref = req.deals?.deal_reference ?? req.deals?.invoice_number ?? req.deal_id.slice(0, 8);
                        const fieldsCount = Array.isArray(req.fields_flagged) ? req.fields_flagged.length : 0;
                        return (
                          <tr key={req.id}>
                            <td className="py-3 font-medium text-foreground">
                              {req.deals?.exporters?.company_name ?? 'Unknown'}
                            </td>
                            <td className="py-3">
                              <Link to={`/greystar/deals/${req.deal_id}`} className="text-primary underline">
                                {ref}
                              </Link>
                            </td>
                            <td className="py-3 text-muted-foreground">
                              Application change ({fieldsCount} field{fieldsCount === 1 ? '' : 's'})
                            </td>
                            <td className="py-3 text-muted-foreground">{formatDate(req.created_at)}</td>
                            <td className="py-3">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-success"
                                  disabled={actingId === req.id}
                                  onClick={() => handleResolveAppReq(req)}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Mark resolved
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-destructive"
                                  disabled={actingId === req.id}
                                  onClick={() => handleCancelAppReq(req)}
                                >
                                  <XCircle className="mr-1 h-3 w-3" /> Cancel
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Change Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-4 w-4" />
                Profile Change Requests
                <Badge variant="secondary" className="ml-1">{profileReqs.length}</Badge>
              </CardTitle>
              <CardDescription>
                Exporter-submitted updates to their company profile awaiting your approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profileReqs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No pending profile change requests.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                        <th className="pb-2">Exporter</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Fields</th>
                        <th className="pb-2">Submitted</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {profileReqs.map((req) => {
                        const fieldKeys = Object.keys(req.proposed_changes ?? {});
                        return (
                          <tr key={req.id}>
                            <td className="py-3 font-medium text-foreground">
                              <Link to={`/greystar/exporters/${req.exporter_id}`} className="text-primary underline">
                                {req.exporters?.company_name ?? 'Unknown'}
                              </Link>
                            </td>
                            <td className="py-3 text-muted-foreground">Company profile update</td>
                            <td className="py-3 text-muted-foreground max-w-[260px] truncate">
                              {fieldKeys.length === 0 ? '—' : fieldKeys.join(', ')}
                            </td>
                            <td className="py-3 text-muted-foreground">{formatDate(req.created_at)}</td>
                            <td className="py-3">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-success"
                                  disabled={actingId === req.id}
                                  onClick={() => handleProfileDecision(req, 'approved')}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-destructive"
                                  disabled={actingId === req.id}
                                  onClick={() => handleProfileDecision(req, 'rejected')}
                                >
                                  <XCircle className="mr-1 h-3 w-3" /> Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
