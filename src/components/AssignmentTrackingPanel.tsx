import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { FileText, Upload, CheckCircle2, Loader2, Send, DollarSign } from 'lucide-react';
import type { DealStatus } from '@/types';

interface Props {
  dealId: string;
  dealStatus: DealStatus;
  deedSentAt: string | null;
  deedAcknowledgedAt: string | null;
  buyerConfirmedAt: string | null;
  disbursementDate: string | null;
  disbursementReference: string | null;
  documents: Array<{ id: string; document_type: string; file_name: string; uploaded_at: string }>;
  onReload: () => void;
}

export default function AssignmentTrackingPanel({
  dealId,
  dealStatus,
  deedSentAt,
  deedAcknowledgedAt,
  buyerConfirmedAt,
  disbursementDate,
  disbursementReference,
  documents,
  onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [uploadType, setUploadType] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [disbRef, setDisbRef] = useState('');

  const isAdmin = role === 'super_admin' || role === 'deal_manager' || role === 'admin_manager';
  if (!isAdmin) return null;

  const showAfterApproved = ['approved', 'deed_sent', 'deed_acknowledged', 'funded_active', 'repayment_due', 'overdue', 'payment_received', 'closed_repaid', 'closed_partial'].includes(dealStatus);
  if (!showAfterApproved) return null;

  const docsOfType = (t: string) => documents.filter(d => d.document_type === t);

  const upload = async (docType: string) => {
    if (!file || !user) return;
    setBusy(true);
    try {
      const path = `deals/${dealId}/${docType}_${Date.now()}_${sanitiseFilename(file.name)}`;
      const { error: sErr } = await supabase.storage.from('veloxis-documents').upload(path, file);
      if (sErr) throw sErr;
      const { error: dErr } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        document_type: docType as any,
        file_name: file.name,
        file_path: path,
        file_size_bytes: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (dErr) throw dErr;
      setFile(null);
      setUploadType(null);
      toast({ title: 'Document uploaded' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const patchDeal = async (fields: Record<string, unknown>, newStatus?: DealStatus, note?: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const patch: Record<string, unknown> = { ...fields };
      if (newStatus) patch.status = newStatus;
      const { error } = await supabase.from('deals').update(patch as any).eq('id', dealId);
      if (error) throw error;
      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'deal_status_changed' as any,
        p_metadata: { actor_name: user.email, ...(fields as Record<string, unknown>), ...(newStatus ? { to: newStatus } : {}), ...(note ? { note } : {}) },
      });
      toast({ title: note ?? 'Updated' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Update failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const now = () => new Date().toISOString();

  const Step = ({
    title, description, done, doneAt, actionLabel, onAction, disabled, extra,
  }: {
    title: string; description: string; done: boolean; doneAt?: string | null;
    actionLabel?: string; onAction?: () => void; disabled?: boolean; extra?: React.ReactNode;
  }) => (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start gap-2">
        {done ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" /> : <div className="h-4 w-4 mt-0.5 rounded-full border-2 border-muted-foreground/40 shrink-0" />}
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {done && doneAt && (
            <p className="text-xs text-success mt-1">Recorded {new Date(doneAt).toLocaleString('en-GB')}</p>
          )}
        </div>
        {!done && actionLabel && onAction && (
          <Button size="sm" onClick={onAction} disabled={disabled || busy} className="gap-1 shrink-0">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            {actionLabel}
          </Button>
        )}
      </div>
      {extra}
    </div>
  );

  const uploaderFor = (docType: string, label: string) => (
    <div className="mt-2">
      {uploadType === docType ? (
        <div className="flex items-center gap-2">
          <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} className="h-8 flex-1" />
          <Button size="sm" variant="outline" onClick={() => upload(docType)} disabled={!file || busy} className="h-8 gap-1">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setUploadType(null); setFile(null); }} className="h-8">Cancel</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setUploadType(docType)} className="h-7 gap-1 text-xs">
          <Upload className="h-3 w-3" /> {label}
        </Button>
      )}
      {docsOfType(docType).map(d => (
        <div key={d.id} className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" /> {d.file_name}
          <span className="ml-auto">{new Date(d.uploaded_at).toLocaleDateString('en-GB')}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Assignment & Disbursement</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">Manual admin actions</Badge>
        </div>
        <CardDescription>
          Deed of Assignment, Notice of Assignment, buyer confirmation, disbursement and repayment tracking.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Step
          title="1. Deed of Assignment sent to exporter"
          description="Upload the executed Deed and mark as sent."
          done={!!deedSentAt || ['deed_sent', 'deed_acknowledged', 'funded_active', 'repayment_due', 'overdue', 'payment_received', 'closed_repaid', 'closed_partial'].includes(dealStatus)}
          doneAt={deedSentAt}
          actionLabel="Mark Deed Sent"
          disabled={docsOfType('deed_of_assignment').length === 0}
          onAction={() => patchDeal(
            { deed_sent_at: now(), deed_sent_by: user!.id },
            dealStatus === 'approved' ? 'deed_sent' : undefined,
            'Deed of Assignment marked as sent'
          )}
          extra={uploaderFor('deed_of_assignment', 'Upload Deed of Assignment')}
        />

        <Step
          title="2. Deed acknowledged by exporter"
          description="Upload the counter-signed acknowledgement and confirm."
          done={!!deedAcknowledgedAt || ['deed_acknowledged', 'funded_active', 'repayment_due', 'overdue', 'payment_received', 'closed_repaid', 'closed_partial'].includes(dealStatus)}
          doneAt={deedAcknowledgedAt}
          actionLabel="Mark Deed Acknowledged"
          disabled={!deedSentAt && dealStatus !== 'deed_sent'}
          onAction={() => patchDeal(
            { deed_acknowledged_at: now(), deed_acknowledged_by: user!.id },
            'deed_acknowledged',
            'Deed of Assignment acknowledged'
          )}
          extra={uploaderFor('notice_of_assignment', 'Upload Notice of Assignment (to buyer)')}
        />

        <Step
          title="3. Buyer direct confirmation received"
          description="Buyer has confirmed they will pay Veloxis directly."
          done={!!buyerConfirmedAt}
          doneAt={buyerConfirmedAt}
          actionLabel="Record Buyer Confirmation"
          onAction={() => patchDeal({ buyer_confirmed_at: now(), buyer_confirmed_by: user!.id }, undefined, 'Buyer confirmation recorded')}
          extra={uploaderFor('buyer_confirmation', 'Upload Buyer Confirmation')}
        />

        <Step
          title="4. Disbursement to exporter"
          description="Record the funding transfer. Moves the deal to Funded (Active)."
          done={!!disbursementDate || ['funded_active', 'repayment_due', 'overdue', 'payment_received', 'closed_repaid', 'closed_partial'].includes(dealStatus)}
          doneAt={disbursementDate}
          actionLabel="Record Disbursement"
          disabled={!deedAcknowledgedAt && dealStatus !== 'deed_acknowledged'}
          onAction={() => patchDeal(
            {
              disbursement_date: new Date().toISOString().split('T')[0],
              funded_at: now(),
              disbursement_reference: disbRef || null,
            },
            'funded_active',
            'Disbursement recorded'
          )}
          extra={
            <div className="mt-2 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Transfer reference (optional)</Label>
                <Input value={disbRef || disbursementReference || ''} onChange={e => setDisbRef(e.target.value)} placeholder="SWIFT / bank reference" className="h-8" />
              </div>
              {uploaderFor('disbursement_proof', 'Upload Disbursement Proof')}
            </div>
          }
        />

        <Step
          title="5. Repayment received from buyer"
          description="Recorded in the Payment Advice panel below."
          done={dealStatus === 'payment_received' || dealStatus === 'closed_repaid' || dealStatus === 'closed_partial'}
          extra={uploaderFor('repayment_proof', 'Upload Repayment Proof')}
        />
      </CardContent>
    </Card>
  );
}
