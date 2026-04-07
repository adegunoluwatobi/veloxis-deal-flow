import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, FileText, Clock, CheckCircle2, XCircle, Upload, Download, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitiseFilename } from '@/lib/sanitiseFilename';

interface DocumentRequest {
  id: string;
  exporter_id: string;
  document_title: string;
  description: string | null;
  expiry_required: boolean;
  status: string;
  created_at: string;
  fulfilled_at: string | null;
  requested_by: string;
  requested_by_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_upload: { label: 'Pending Upload', color: 'bg-warning/10 text-warning', icon: Clock },
  uploaded_pending_review: { label: 'Uploaded — Pending Review', color: 'bg-primary/10 text-primary', icon: FileText },
  verified: { label: 'Verified', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground', icon: Ban },
};

interface Props {
  exporterId: string;
  mode: 'admin' | 'exporter';
  onRequestsLoaded?: (requests: DocumentRequest[]) => void;
}

export default function DocumentRequestSection({ exporterId, mode, onRequestsLoaded }: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', expiryRequired: true });
  const [uploadForms, setUploadForms] = useState<Record<string, { file: File | null; expiry_date: string }>>({});

  const canCreate = mode === 'admin' && (role === 'partner_admin' || role === 'partner_staff' || role === 'super_admin' || role === 'deal_manager');

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from('document_requests' as any)
      .select('*')
      .eq('exporter_id', exporterId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      // Fetch requester names
      const userIds = [...new Set((data as any[]).map((r: any) => r.requested_by).filter(Boolean))];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, full_name, email').in('id', userIds);
        if (users) {
          for (const u of users) {
            userMap[u.id] = u.full_name || u.email;
          }
        }
      }
      const enriched = (data as any[]).map((r: any) => ({ ...r, requested_by_name: userMap[r.requested_by] || 'Unknown' }));
      setRequests(enriched);
      onRequestsLoaded?.(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, [exporterId]);

  const handleCreate = async () => {
    if (!user || !form.title.trim()) return;
    setSubmitting(true);
    try {
      // Get partner org id
      const { data: roleData } = await supabase.from('user_roles').select('partner_organisation_id').eq('user_id', user.id).limit(1).maybeSingle();

      const { error } = await supabase.from('document_requests' as any).insert({
        exporter_id: exporterId,
        partner_organisation_id: roleData?.partner_organisation_id || null,
        requested_by: user.id,
        document_title: form.title.trim(),
        description: form.description.trim() || null,
        expiry_required: form.expiryRequired,
      });
      if (error) throw error;

      toast({ title: 'Document requested', description: `Request for "${form.title}" has been created.` });
      setForm({ title: '', description: '', expiryRequired: true });
      setDialogOpen(false);
      loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create request';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (reqId: string) => {
    const { error } = await supabase.from('document_requests' as any).update({ status: 'cancelled' }).eq('id', reqId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Request cancelled' });
      loadRequests();
    }
  };

  const handleUploadForRequest = async (req: DocumentRequest) => {
    if (!user) return;
    const uf = uploadForms[req.id];
    if (!uf?.file) return;
    if (req.expiry_required && !uf.expiry_date) {
      toast({ title: 'Expiry date required', description: 'This document requires an expiry date.', variant: 'destructive' });
      return;
    }
    setUploadingId(req.id);
    try {
      const file = uf.file;
      const filePath = `exporters/${exporterId}/${Date.now()}_${sanitiseFilename(file.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file);
      if (storageErr) throw storageErr;

      const { error: docErr } = await supabase.from('exporter_documents').insert({
        exporter_id: exporterId,
        document_type: 'other' as any,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        expiry_date: uf.expiry_date || null,
        uploaded_by_user_id: user.id,
        uploaded_by_role: 'exporter',
        document_status: 'pending_review',
        document_request_id: req.id,
      });
      if (docErr) throw docErr;

      // Update request status
      await supabase.from('document_requests' as any).update({
        status: 'uploaded_pending_review',
        fulfilled_at: new Date().toISOString(),
      }).eq('id', req.id);

      setUploadForms((prev) => { const next = { ...prev }; delete next[req.id]; return next; });
      toast({ title: 'Document uploaded', description: 'Your document has been submitted for review.' });
      loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const handleVerifyRequest = async (reqId: string) => {
    await supabase.from('document_requests' as any).update({ status: 'verified' }).eq('id', reqId);
    toast({ title: 'Document request verified' });
    loadRequests();
  };

  const handleRejectRequest = async (reqId: string) => {
    await supabase.from('document_requests' as any).update({ status: 'rejected', fulfilled_at: null }).eq('id', reqId);
    toast({ title: 'Document request rejected — exporter will need to re-upload' });
    loadRequests();
  };

  const activeRequests = requests.filter((r) => r.status !== 'cancelled');

  if (loading) return null;
  if (activeRequests.length === 0 && !canCreate) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Requested Documents</CardTitle>
            <CardDescription>Custom document requests from the admin team.</CardDescription>
          </div>
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Request Document
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Additional Document</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Document Title <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. Board Resolution Letter, Export Licence"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description / Instructions</Label>
                    <Textarea
                      placeholder="Notes for the exporter on what to upload…"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Expiry Date Required</Label>
                    <Switch checked={form.expiryRequired} onCheckedChange={(v) => setForm({ ...form, expiryRequired: v })} />
                  </div>
                  <Button onClick={handleCreate} disabled={!form.title.trim() || submitting} className="w-full">
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeRequests.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No document requests yet.</p>
        ) : (
          <div className="space-y-3">
            {activeRequests.map((req) => {
              const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending_upload;
              const StatusIcon = cfg.icon;
              const uf = uploadForms[req.id];
              return (
                <div key={req.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground">{req.document_title}</span>
                        <Badge variant="secondary" className={cn('text-xs gap-1', cfg.color)}>
                          <StatusIcon className="h-3 w-3" /> {cfg.label}
                        </Badge>
                      </div>
                      {req.description && (
                        <p className="text-xs text-muted-foreground">{req.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested by {req.requested_by_name} · {new Date(req.created_at).toLocaleDateString()}
                        {req.expiry_required && ' · Expiry date required'}
                      </p>
                    </div>

                    {/* Admin actions */}
                    {mode === 'admin' && req.status === 'pending_upload' && (
                      <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => handleCancel(req.id)}>
                        Cancel
                      </Button>
                    )}
                    {mode === 'admin' && req.status === 'uploaded_pending_review' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => handleVerifyRequest(req.id)}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Verify
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleRejectRequest(req.id)}>
                          <XCircle className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Exporter upload form for pending/rejected requests */}
                  {mode === 'exporter' && (req.status === 'pending_upload' || req.status === 'rejected') && (
                    <div className="border-t border-border pt-3 space-y-2">
                      {req.status === 'rejected' && (
                        <p className="text-xs text-destructive font-medium">This document was rejected. Please re-upload.</p>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">File</Label>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="text-xs"
                            onChange={(e) =>
                              setUploadForms((prev) => ({
                                ...prev,
                                [req.id]: { ...prev[req.id], file: e.target.files?.[0] ?? null, expiry_date: prev[req.id]?.expiry_date || '' },
                              }))
                            }
                          />
                        </div>
                        {req.expiry_required && (
                          <div className="space-y-1">
                            <Label className="text-xs">Expiry Date <span className="text-destructive">*</span></Label>
                            <Input
                              type="date"
                              className="text-xs"
                              value={uf?.expiry_date || ''}
                              onChange={(e) =>
                                setUploadForms((prev) => ({
                                  ...prev,
                                  [req.id]: { ...prev[req.id], expiry_date: e.target.value, file: prev[req.id]?.file ?? null },
                                }))
                              }
                            />
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleUploadForRequest(req)}
                        disabled={!uf?.file || (req.expiry_required && !uf?.expiry_date) || uploadingId === req.id}
                      >
                        <Upload className="mr-1 h-3 w-3" />
                        {uploadingId === req.id ? 'Uploading…' : 'Upload'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
