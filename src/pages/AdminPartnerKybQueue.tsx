import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { ShieldCheck, FileText, Eye, Check, X, FilePlus2, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPartnerKybQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['admin_partner_kyb_queue'],
    queryFn: async () => {
      const { data } = await supabase
        .from('partner_organisations')
        .select('*')
        .not('kyb_submitted_at', 'is', null)
        .is('kyb_verified_at', null)
        .order('kyb_submitted_at', { ascending: true });
      return data ?? [];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ['admin_partner_kyb_docs', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data } = await supabase
        .from('partner_documents')
        .select('id, document_type, file_name, file_path, uploaded_at, is_superseded')
        .eq('partner_organisation_id', activeOrgId)
        .eq('is_superseded', false)
        .order('uploaded_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!activeOrgId,
  });

  const activeOrg = orgs.find((o: any) => o.id === activeOrgId) ?? null;

  const handleViewDoc = async (path: string) => {
    const { data } = await supabase.storage.from('veloxis-documents').createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Could not generate viewing link.');
  };

  const handleApprove = async () => {
    if (!activeOrgId || !user?.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('partner_organisations').update({
        kyb_status: 'verified' as any,
        kyb_verified_at: new Date().toISOString(),
        kyb_verified_by: user.id,
        kyb_rejected_at: null,
        kyb_rejection_reason: null,
      }).eq('id', activeOrgId);
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_user_id: user.id,
        p_user_role: 'super_admin' as any,
        p_action_type: 'partner_kyb_approved' as any,
        p_metadata: { partner_organisation_id: activeOrgId },
      });

      toast.success('Partner KYB approved.');
      setActiveOrgId(null);
      queryClient.invalidateQueries({ queryKey: ['admin_partner_kyb_queue'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!activeOrgId || !user?.id || !rejectReason.trim()) {
      toast.error('Rejection reason is required.'); return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('partner_organisations').update({
        kyb_status: 'rejected' as any,
        kyb_rejected_at: new Date().toISOString(),
        kyb_rejected_by: user.id,
        kyb_rejection_reason: rejectReason.trim(),
      }).eq('id', activeOrgId);
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_user_id: user.id,
        p_user_role: 'super_admin' as any,
        p_action_type: 'partner_kyb_rejected' as any,
        p_metadata: { partner_organisation_id: activeOrgId, reason: rejectReason.trim() },
      });

      toast.success('KYB rejected. Partner has been notified.');
      setRejectReason('');
      setRejectOpen(false);
      setActiveOrgId(null);
      queryClient.invalidateQueries({ queryKey: ['admin_partner_kyb_queue'] });
    } catch (err: any) {
      toast.error(err.message ?? 'Rejection failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestDoc = async () => {
    if (!activeOrgId || !user?.id || !docTitle.trim()) {
      toast.error('Document name is required.'); return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('partner_document_requests').insert({
        partner_organisation_id: activeOrgId,
        requested_by: user.id,
        document_title: docTitle.trim(),
        description: docDesc.trim() || null,
        status: 'pending',
      });
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_user_id: user.id,
        p_user_role: 'super_admin' as any,
        p_action_type: 'partner_kyb_doc_requested' as any,
        p_metadata: { partner_organisation_id: activeOrgId, document_title: docTitle.trim() },
      });

      toast.success('Document requested. Partner will see it on their KYB page.');
      setDocTitle('');
      setDocDesc('');
      setReqOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <Helmet><title>Partner KYB Queue · Veloxis</title></Helmet>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Partner KYB Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review submitted partner KYB packs and approve, reject, or request additional documents.
        </p>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No partner KYB submissions awaiting review.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeOrgId ?? orgs[0]?.id} onValueChange={setActiveOrgId}>
          <TabsList className="flex w-full flex-wrap h-auto justify-start">
            {orgs.map((o: any) => (
              <TabsTrigger key={o.id} value={o.id} className="gap-2">
                <Building2 className="h-3.5 w-3.5" />
                {o.name}
                {o.kyb_status === 'rejected' ? (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px]">Rejected</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-warning/10 text-warning text-[10px]">Pending</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {orgs.map((o: any) => (
            <TabsContent key={o.id} value={o.id} className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{o.name}</CardTitle>
                  <CardDescription>
                    Submitted {o.kyb_submitted_at ? new Date(o.kyb_submitted_at).toLocaleString() : '—'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
                  <Row k="Registration #" v={o.company_registration_number ?? '—'} />
                  <Row k="Country of incorporation" v={o.country_of_incorporation ?? '—'} />
                  <Row k="Registered address" v={[o.registered_address_line1, o.registered_address_line2, o.registered_city, o.registered_postcode, o.registered_country].filter(Boolean).join(', ') || '—'} />
                  <Row k="Primary contact" v={o.primary_contact_name ? `${o.primary_contact_name} · ${o.primary_contact_email ?? ''}` : '—'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Uploaded documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {docs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium">{labelForDoc(d.document_type)}</span>
                            <span className="ml-2 text-muted-foreground">{d.file_name}</span>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleViewDoc(d.file_path)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2 justify-end">
                <Dialog open={reqOpen} onOpenChange={setReqOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setActiveOrgId(o.id)}>
                      <FilePlus2 className="h-4 w-4 mr-2" /> Request additional document
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request additional document</DialogTitle>
                      <DialogDescription>The partner will see this on their KYB page.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Document name *</Label>
                        <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Director ID — second director" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Reason / instructions (optional)</Label>
                        <Textarea value={docDesc} onChange={(e) => setDocDesc(e.target.value)} rows={3} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button>
                      <Button onClick={handleRequestDoc} disabled={busy}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Request
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" onClick={() => setActiveOrgId(o.id)}>
                      <X className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reject KYB</DialogTitle>
                      <DialogDescription>Provide a reason. The partner will be notified.</DialogDescription>
                    </DialogHeader>
                    <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder="Reason for rejection…" />
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
                      <Button variant="destructive" onClick={handleReject} disabled={busy}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirm rejection
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button size="sm" onClick={() => { setActiveOrgId(o.id); handleApprove(); }} disabled={busy}>
                  {busy && activeOrgId === o.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Approve KYB
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function labelForDoc(t: string): string {
  switch (t) {
    case 'certificate_of_incorporation': return 'Certificate of Incorporation';
    case 'proof_of_registered_address': return 'Proof of Address';
    case 'director_id': return 'Director ID';
    default: return t.replace(/_/g, ' ');
  }
}
