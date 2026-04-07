import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import type { CommodityType } from '@/types';

interface TradePackItem {
  type: string;
  label: string;
  condition?: (commodity: CommodityType | null) => boolean;
}

const DOC_OPTIONS: TradePackItem[] = [
  { type: 'commercial_invoice', label: 'Commercial Invoice' },
  { type: 'bill_of_lading', label: 'Bill of Lading / Airway Bill' },
  { type: 'buyer_registration_doc', label: 'Buyer Registration Document' },
  { type: 'export_licence', label: 'Export Licence', condition: (c) => c === 'solid_minerals' },
  { type: 'ipu_signed', label: 'Irrevocable Payment Undertaking (IPU)' },
  { type: 'other', label: 'Other Supporting Document' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  commodityType: CommodityType | null;
  onSent: () => void;
}

export default function RequestDocsModal({ open, onOpenChange, dealId, commodityType, onSent }: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const applicableItems = DOC_OPTIONS.filter(item => !item.condition || item.condition(commodityType));

  const toggleItem = (type: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleSend = async () => {
    if (!user || selected.size === 0) return;
    setSubmitting(true);
    try {
      // Insert doc requests
      const rows = Array.from(selected).map(type => {
        const item = applicableItems.find(i => i.type === type)!;
        return {
          deal_id: dealId,
          document_type: type,
          label: item.label,
          notes: notes.trim() || null,
          requested_by: user.id,
        };
      });

      const { error: insertErr } = await supabase.from('deal_doc_requests' as any).insert(rows);
      if (insertErr) throw insertErr;

      // Update deal status to docs_requested
      const { error: statusErr } = await supabase.from('deals')
        .update({ status: 'docs_requested' as any })
        .eq('id', dealId);
      if (statusErr) throw statusErr;

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'deal_document_requested' as any,
        p_metadata: {
          actor_name: user.email,
          requested_documents: rows.map(r => r.label),
          notes: notes.trim() || null,
        },
      });

      toast({ title: 'Document request sent' });
      setSelected(new Set());
      setNotes('');
      onOpenChange(false);
      onSent();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Documents</DialogTitle>
          <DialogDescription>Select the documents you need from the exporter and add any notes.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Required Documents</Label>
            {applicableItems.map(item => (
              <div key={item.type} className="flex items-center gap-3">
                <Checkbox
                  id={`doc-${item.type}`}
                  checked={selected.has(item.type)}
                  onCheckedChange={() => toggleItem(item.type)}
                />
                <label htmlFor={`doc-${item.type}`} className="text-sm cursor-pointer">
                  {item.label}
                </label>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Additional notes to exporter</Label>
            <Textarea
              placeholder="e.g. Please ensure the bill of lading shows the correct consignee name…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSend} disabled={submitting || selected.size === 0} className="gap-1">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
