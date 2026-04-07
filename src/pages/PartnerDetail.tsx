import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import DealStatusBadge from '@/components/DealStatusBadge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft, Building2, Users, FileText, ShieldCheck, Ban, CheckCircle2, Edit } from 'lucide-react';
import { type DealStatus } from '@/types';

export default function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isSuperAdmin = role === 'super_admin';

  const [org, setOrg] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [exporters, setExporters] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showSuspend, setShowSuspend] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [editName, setEditName] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;

    const [orgRes, rolesRes] = await Promise.all([
      supabase.from('partner_organisations').select('*').eq('id', id).single(),
      supabase.from('user_roles').select('user_id, role').eq('partner_organisation_id', id).in('role', ['partner_admin', 'partner_staff']),
    ]);

    setOrg(orgRes.data);
    const userIds = (rolesRes.data ?? []).map((r: any) => r.user_id);
    const roleMap: Record<string, string> = {};
    (rolesRes.data ?? []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from('users').select('id, email, full_name, is_active').in('id', userIds);
      setStaff((usersData ?? []).map((u: any) => ({ ...u, role: roleMap[u.id] })));

      // Get exporters created by org staff
      const { data: exps } = await supabase.from('exporters').select('id, company_name, kyc_status, created_at, onboarding_status').in('originator_id', userIds);
      setExporters(exps ?? []);

      // Get deals for org
      const { data: dealsData } = await supabase.from('deals')
        .select('id, deal_reference, invoice_value, invoice_currency_v2, buyer_company_name, status, created_at')
        .eq('partner_organisation_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      setDeals(dealsData ?? []);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSuspend = async () => {
    if (!suspendReason.trim()) { toast({ title: 'Please provide a reason', variant: 'destructive' }); return; }
    setSaving(true);
    await supabase.from('partner_organisations').update({
      suspended_at: new Date().toISOString(),
      suspended_by: user!.id,
      suspension_reason: suspendReason.trim(),
      is_active: false,
    }).eq('id', id!);
    toast({ title: 'Partner suspended' });
    setShowSuspend(false);
    setSuspendReason('');
    setSaving(false);
    load();
  };

  const handleReactivate = async () => {
    setSaving(true);
    await supabase.from('partner_organisations').update({
      suspended_at: null,
      suspended_by: null,
      suspension_reason: null,
      is_active: true,
    }).eq('id', id!);
    toast({ title: 'Partner reactivated' });
    setSaving(false);
    load();
  };

  const handleEditSave = async () => {
    if (!editName.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    await supabase.from('partner_organisations').update({
      name: editName.trim(),
      country: editCountry.trim() || 'Nigeria',
    }).eq('id', id!);
    toast({ title: 'Organisation updated' });
    setShowEdit(false);
    setSaving(false);
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  if (!org) return <div className="py-20 text-center text-muted-foreground">Partner not found.</div>;

  const isSuspended = !!org.suspended_at;
  const kycCompleteCount = exporters.filter(e => e.kyc_status === 'verified').length;
  const fundedDeals = deals.filter(d => ['funded_active', 'repayment_due', 'overdue', 'closed_repaid', 'closed_partial'].includes(d.status));
  const totalFundedVolume = deals
    .filter(d => ['funded_active', 'repayment_due', 'overdue', 'closed_repaid', 'closed_partial'].includes(d.status))
    .reduce((sum, d) => sum + (Number(d.invoice_value) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/partners')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Partners
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
            <p className="text-sm text-muted-foreground">{org.country || 'Nigeria'} · Since {format(new Date(org.created_at), 'MMM yyyy')}</p>
          </div>
          {isSuspended ? (
            <Badge variant="destructive">Suspended</Badge>
          ) : (
            <Badge className="bg-success/10 text-success border-success/30">Active</Badge>
          )}
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditName(org.name); setEditCountry(org.country || 'Nigeria'); setShowEdit(true); }}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
            {isSuspended ? (
              <Button size="sm" onClick={handleReactivate} disabled={saving}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Reactivate
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => setShowSuspend(true)}>
                <Ban className="mr-2 h-4 w-4" /> Suspend
              </Button>
            )}
          </div>
        )}
      </div>

      {isSuspended && org.suspension_reason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <strong>Suspension reason:</strong> {org.suspension_reason}
          {org.suspended_at && <span className="ml-2 text-muted-foreground">({format(new Date(org.suspended_at), 'dd MMM yyyy')})</span>}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-foreground">{exporters.length}</p><p className="text-xs text-muted-foreground">Total Exporters</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-success">{kycCompleteCount}</p><p className="text-xs text-muted-foreground">KYC Complete</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-foreground">{deals.length}</p><p className="text-xs text-muted-foreground">Deals Submitted</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-foreground">{fundedDeals.length}</p><p className="text-xs text-muted-foreground">Deals Funded</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-foreground">£{totalFundedVolume.toLocaleString()}</p><p className="text-xs text-muted-foreground">Volume Funded</p></CardContent></Card>
      </div>

      {/* Staff */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Staff ({staff.length})</CardTitle></CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No staff accounts.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {staff.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name || '—'}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell><Badge variant="secondary">{s.role === 'partner_admin' ? 'Admin' : 'Staff'}</Badge></TableCell>
                    <TableCell>{s.is_active ? <Badge className="bg-success/10 text-success border-success/30">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Exporters */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Exporters ({exporters.length})</CardTitle></CardHeader>
        <CardContent>
          {exporters.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No exporters.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>KYC Status</TableHead><TableHead>Onboarding</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
              <TableBody>
                {exporters.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.company_name}</TableCell>
                    <TableCell><Badge variant="secondary">{e.kyc_status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{e.onboarding_status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(e.created_at), 'dd MMM yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Deals */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Deals ({deals.length})</CardTitle></CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No deals.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Buyer</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
              <TableBody>
                {deals.map(d => (
                  <TableRow key={d.id}>
                    <TableCell><Link to={`/admin/deals/${d.id}`} className="font-medium text-primary hover:underline">{d.deal_reference || d.id.slice(0, 8)}</Link></TableCell>
                    <TableCell>{d.buyer_company_name || '—'}</TableCell>
                    <TableCell className="text-right">{d.invoice_value ? `${d.invoice_value.toLocaleString()}` : '—'}</TableCell>
                    <TableCell><DealStatusBadge status={d.status as DealStatus} portal="veloxis" /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(d.created_at), 'dd MMM yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Suspend Modal */}
      <Dialog open={showSuspend} onOpenChange={setShowSuspend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Partner</DialogTitle>
            <DialogDescription>This will prevent the partner admin from accessing the platform.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Reason for suspension" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspend(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={saving}>{saving ? 'Suspending…' : 'Suspend'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div><Label>Country</Label><Input value={editCountry} onChange={e => setEditCountry(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
