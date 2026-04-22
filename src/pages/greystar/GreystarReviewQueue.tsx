import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Inbox, Loader2, ArrowRight } from 'lucide-react';

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
  current_snapshot: Record<string, unknown>;
  exporters: { company_name: string } | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const FIELD_LABELS: Record<string, string> = {
  company_name: 'Company name',
  director_name: 'Director name',
  rc_number: 'RC number',
  vat_number: 'VAT number',
  contact_email: 'Contact email',
  primary_commodity: 'Primary commodity',
  entity_type: 'Entity type',
  registered_address_line1: 'Registered address line 1',
  registered_address_line2: 'Registered address line 2',
  registered_city: 'Registered city',
  registered_postcode: 'Registered postcode',
  registered_country: 'Registered country',
  trading_address_line1: 'Trading address line 1',
  trading_address_line2: 'Trading address line 2',
  trading_city: 'Trading city',
  trading_postcode: 'Trading postcode',
  trading_country: 'Trading country',
  export_licence_number: 'Export licence number',
};

const prettifyKey = (k: string) =>
  FIELD_LABELS[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const renderValue = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export default function GreystarReviewQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appReqs, setAppReqs] = useState<AppChangeRow[]>([]);
  const [profileReqs, setProfileReqs] = useState<ProfileChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'profile' | 'application'>('profile');

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
        .select('id, exporter_id, status, created_at, proposed_changes, current_snapshot, exporters!inner(company_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ]);
    setAppReqs((appRes.data as any[] | null) ?? []);
    setProfileReqs((profRes.data as any[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Default-tab logic: prefer Profile if it has items, else Application, else Profile
  useEffect(() => {
    if (loading) return;
    if (profileReqs.length > 0) setTab('profile');
    else if (appReqs.length > 0) setTab('application');
    else setTab('profile');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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

  const profileDiffs = useMemo(() => {
    return profileReqs.map((req) => {
      const proposed = req.proposed_changes ?? {};
      const snapshot = req.current_snapshot ?? {};
      const changes = Object.keys(proposed).map((key) => ({
        key,
        label: prettifyKey(key),
        oldValue: renderValue((snapshot as any)[key]),
        newValue: renderValue((proposed as any)[key]),
      }));
      return { req, changes };
    });
  }, [profileReqs]);

  const total = appReqs.length + profileReqs.length;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Header />
        <Card>
          <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Header />

      {total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            No pending requests.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'profile' | 'application')} className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="profile" className="gap-2">
              Profile Requests
              <Badge variant={profileReqs.length > 0 ? 'default' : 'secondary'} className="px-1.5">
                {profileReqs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="application" className="gap-2">
              Application Requests
              <Badge variant={appReqs.length > 0 ? 'default' : 'secondary'} className="px-1.5">
                {appReqs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <ProfileRequestsTable
              items={profileDiffs}
              actingId={actingId}
              onDecision={handleProfileDecision}
            />
          </TabsContent>

          <TabsContent value="application" className="space-y-4">
            <AppRequestsTable
              items={appReqs}
              actingId={actingId}
              onResolve={handleResolveAppReq}
              onCancel={handleCancelAppReq}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Requests</h1>
      <p className="text-sm text-muted-foreground">
        Pending change requests for applications and exporter profiles assigned to your organisation.
      </p>
    </div>
  );
}

function ProfileRequestsTable({
  items,
  actingId,
  onDecision,
}: {
  items: { req: ProfileChangeRow; changes: { key: string; label: string; oldValue: string; newValue: string }[] }[];
  actingId: string | null;
  onDecision: (req: ProfileChangeRow, decision: 'approved' | 'rejected') => void;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          No pending profile change requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(({ req, changes }) => (
        <Card key={req.id}>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link
                  to={`/greystar/exporters/${req.exporter_id}`}
                  className="text-base font-semibold text-foreground hover:text-primary"
                >
                  {req.exporters?.company_name ?? 'Unknown exporter'}
                </Link>
                <div className="text-xs text-muted-foreground">
                  Submitted {new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '}
                  {changes.length} field{changes.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-success hover:text-success"
                  disabled={actingId === req.id}
                  onClick={() => onDecision(req, 'approved')}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  disabled={actingId === req.id}
                  onClick={() => onDecision(req, 'rejected')}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2 w-1/4">Field</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2">Proposed</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {changes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-center text-muted-foreground">
                        No detectable changes.
                      </td>
                    </tr>
                  ) : (
                    changes.map((c) => (
                      <tr key={c.key}>
                        <td className="px-3 py-2 font-medium text-foreground">{c.label}</td>
                        <td className="px-3 py-2 text-muted-foreground line-through decoration-muted-foreground/40">
                          {c.oldValue}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">{c.newValue}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AppRequestsTable({
  items,
  actingId,
  onResolve,
  onCancel,
}: {
  items: AppChangeRow[];
  actingId: string | null;
  onResolve: (req: AppChangeRow) => void;
  onCancel: (req: AppChangeRow) => void;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          No pending application change requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Exporter</th>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Flagged fields</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((req) => {
                const ref = req.deals?.deal_reference ?? req.deals?.invoice_number ?? req.deal_id.slice(0, 8);
                const flagged: string[] = Array.isArray(req.fields_flagged)
                  ? req.fields_flagged.map((f: any) => (typeof f === 'string' ? f : f?.field ?? f?.name ?? ''))
                  : [];
                return (
                  <tr key={req.id}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {req.deals?.exporters?.company_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/greystar/deals/${req.deal_id}`} className="text-primary underline">
                        {ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[320px]">
                      {flagged.length === 0 ? (
                        <span className="text-muted-foreground/70">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {flagged.slice(0, 4).map((f, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              {prettifyKey(f)}
                            </Badge>
                          ))}
                          {flagged.length > 4 && (
                            <Badge variant="outline" className="text-[10px]">+{flagged.length - 4}</Badge>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(req.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-success"
                          disabled={actingId === req.id}
                          onClick={() => onResolve(req)}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Mark resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          disabled={actingId === req.id}
                          onClick={() => onCancel(req)}
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
      </CardContent>
    </Card>
  );
}
