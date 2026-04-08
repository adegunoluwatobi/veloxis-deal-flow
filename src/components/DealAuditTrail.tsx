import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, Send, XCircle, CheckCircle2, PenLine, Upload, DollarSign, Clock, AlertTriangle, Plus, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewerRole = 'exporter' | 'partner' | 'veloxis';

interface AuditEntry {
  id: string;
  action_type: string;
  created_at: string;
  user_id: string | null;
  user_role: string | null;
  metadata: Record<string, any>;
}

const EVENT_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  deal_created: { label: 'Application Created (Draft)', icon: Plus, color: 'text-muted-foreground' },
  deal_submitted: { label: 'Application Submitted', icon: Send, color: 'text-primary' },
  deal_changes_requested: { label: 'Changes Requested', icon: PenLine, color: 'text-warning' },
  deal_resubmitted: { label: 'Application Resubmitted', icon: Send, color: 'text-primary' },
  deal_sent_to_veloxis: { label: 'Submitted to Underwriter', icon: Send, color: 'text-primary' },
  deal_rejected_by_partner: { label: 'Rejected by Partner', icon: XCircle, color: 'text-destructive' },
  deal_rejected_by_veloxis: { label: 'Rejected by Veloxis', icon: XCircle, color: 'text-destructive' },
  deal_rejected: { label: 'Application Rejected', icon: XCircle, color: 'text-destructive' },
  deal_approved: { label: 'Application Approved', icon: CheckCircle2, color: 'text-success' },
  deal_funded: { label: 'Application Funded', icon: DollarSign, color: 'text-success' },
  deal_overdue: { label: 'Application Marked Overdue', icon: AlertTriangle, color: 'text-destructive' },
  deal_closed: { label: 'Application Closed', icon: CheckCircle2, color: 'text-muted-foreground' },
  deal_field_edited: { label: 'Field Edited', icon: PenLine, color: 'text-muted-foreground' },
  deal_document_requested: { label: 'Document Requested', icon: FileText, color: 'text-warning' },
  deal_document_uploaded: { label: 'Document Uploaded', icon: Upload, color: 'text-primary' },
  deal_moved_to_under_review: { label: 'Under Review', icon: Eye, color: 'text-primary' },
  deal_status_changed: { label: 'Status Changed', icon: Clock, color: 'text-muted-foreground' },
  document_requested: { label: 'Document Requested', icon: FileText, color: 'text-warning' },
  document_uploaded: { label: 'Document Uploaded', icon: Upload, color: 'text-primary' },
  funding_recorded: { label: 'Funding Recorded', icon: DollarSign, color: 'text-success' },
  repayment_recorded: { label: 'Repayment Recorded', icon: DollarSign, color: 'text-success' },
  internal_note_added: { label: 'Internal Note Added', icon: PenLine, color: 'text-muted-foreground' },
  ipu_generated: { label: 'IPU Generated', icon: FileText, color: 'text-primary' },
  ipu_sent: { label: 'IPU Sent', icon: Send, color: 'text-primary' },
  ipu_signed: { label: 'IPU Signed', icon: CheckCircle2, color: 'text-success' },
  ipu_verified: { label: 'IPU Verified', icon: CheckCircle2, color: 'text-success' },
  payment_advice_submitted: { label: 'Buyer Payment Recorded', icon: DollarSign, color: 'text-success' },
  exporter_receipt_confirmed: { label: 'Exporter Confirmed Receipt', icon: CheckCircle2, color: 'text-success' },
  pricing_recalculated: { label: 'Pricing Recalculated', icon: DollarSign, color: 'text-muted-foreground' },
};

const ROLE_LABELS: Record<string, string> = {
  exporter: 'Exporter',
  partner_admin: 'Partner Admin',
  partner_staff: 'Partner Staff',
  deal_manager: 'Deal Manager',
  super_admin: 'Super Admin',
};

/** Events that are internal to partner — hidden from exporter */
const PARTNER_INTERNAL_EVENTS = new Set(['internal_note_added']);
/** Events that are internal to Veloxis — hidden from partner and exporter */
const VELOXIS_INTERNAL_EVENTS = new Set<string>([]);

function isVisibleToViewer(entry: AuditEntry, viewerRole: ViewerRole): boolean {
  const actionType = entry.action_type;
  const actorRole = entry.user_role;

  if (viewerRole === 'veloxis') return true;

  if (viewerRole === 'partner') {
    // Partners can't see Veloxis internal notes
    if (actionType === 'internal_note_added' && (actorRole === 'deal_manager' || actorRole === 'super_admin')) {
      return false;
    }
    return true;
  }

  // Exporter
  if (PARTNER_INTERNAL_EVENTS.has(actionType)) return false;
  if (actionType === 'internal_note_added') return false;
  // Hide Veloxis-only internal entries
  if (actorRole === 'deal_manager' || actorRole === 'super_admin') {
    if (actionType === 'deal_status_changed') return false;
  }
  return true;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  dealId: string;
  viewerRole: ViewerRole;
}

export default function DealAuditTrail({ dealId, viewerRole }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('id, action_type, created_at, user_id, user_role, metadata')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEntries((data as AuditEntry[]) ?? []);
        setLoading(false);
      });
  }, [dealId]);

  const visible = entries.filter(e => isVisibleToViewer(e, viewerRole));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity & Audit Trail</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</p>
        ) : (
          <div className="relative space-y-0">
            {/* Timeline line */}
            <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />
            {visible.map((entry) => {
              const config = EVENT_CONFIG[entry.action_type] ?? { label: entry.action_type.replace(/_/g, ' '), icon: Clock, color: 'text-muted-foreground' };
              const Icon = config.icon;
              const meta = entry.metadata ?? {};
              const actorName = (meta.actor_name as string) || (meta.email as string) || entry.user_id?.slice(0, 8) || 'System';
              const roleLabel = ROLE_LABELS[entry.user_role ?? ''] ?? entry.user_role ?? '';
              const note = (meta.note as string) || (meta.reason as string) || (meta.rejection_reason as string) || null;

              return (
                <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border-2", 
                    config.color.includes('destructive') ? 'border-destructive/30' :
                    config.color.includes('success') ? 'border-success/30' :
                    config.color.includes('warning') ? 'border-warning/30' :
                    config.color.includes('primary') ? 'border-primary/30' :
                    'border-border'
                  )}>
                    <Icon className={cn("h-3.5 w-3.5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium", config.color)}>{config.label}</span>
                      <span className="text-xs text-muted-foreground">
                        — by {actorName} {roleLabel && `(${roleLabel})`}
                      </span>
                    </div>
                    {note && (
                      <p className="mt-1 text-sm text-foreground bg-muted/50 rounded-md px-3 py-2 border border-border">
                        "{note}"
                      </p>
                    )}
                    {/* Show funding details */}
                    {(entry.action_type === 'deal_funded' || entry.action_type === 'funding_recorded') && meta.advance_amount && (
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        <p>Advance: {meta.advance_currency ?? ''} {Number(meta.advance_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
                        {meta.fx_rate && <p>FX Rate: {String(meta.fx_rate)}</p>}
                        {meta.repayment_due_date && <p>Repayment due: {String(meta.repayment_due_date)}</p>}
                      </div>
                    )}
                    {/* Show field edit details */}
                    {entry.action_type === 'deal_field_edited' && meta.field && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {String(meta.field)}: "{String(meta.old_value)}" → "{String(meta.new_value)}"
                      </p>
                    )}
                    {/* Show document title */}
                    {(entry.action_type === 'deal_document_requested' || entry.action_type === 'deal_document_uploaded' || entry.action_type === 'document_requested') && meta.document_title && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Document: {String(meta.document_title)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(entry.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
