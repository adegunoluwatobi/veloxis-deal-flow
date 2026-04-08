import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Send, ShieldAlert, MessageSquare, Clock } from 'lucide-react';
import type { DealStatus, AuditAction } from '@/types';

interface CollectionNote {
  id: string;
  note_body: string;
  created_at: string;
  author_id: string;
}

interface Props {
  dealId: string;
  dealStatus: DealStatus;
  buyerContactEmail: string | null;
  buyerCompanyName: string | null;
  dealReference: string | null;
  overdueDays: number;
  onReload: () => void;
}

export default function OverdueActionsPanel({
  dealId, dealStatus, buyerContactEmail, buyerCompanyName,
  dealReference, overdueDays, onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [notes, setNotes] = useState<CollectionNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);

  const isOverdueOrCollections = dealStatus === 'overdue' || dealStatus === ('in_collections' as DealStatus);
  const isDM = role === 'deal_manager' || role === 'super_admin';

  if (!isOverdueOrCollections || !isDM) return null;

  const loadNotes = async () => {
    if (notesLoaded) return;
    const { data } = await supabase
      .from('internal_notes')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    setNotes((data ?? []) as unknown as CollectionNote[]);
    setNotesLoaded(true);
  };

  // Load notes on first render
  if (!notesLoaded) loadNotes();

  const handleSendReminder = async () => {
    setSending(true);
    try {
      // Log the reminder action
      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user?.id,
        p_user_role: role as any,
        p_action_type: 'deal_status_changed' as AuditAction,
        p_metadata: {
          action: 'buyer_payment_reminder_sent',
          buyer_email: buyerContactEmail,
          buyer_company: buyerCompanyName,
          overdue_days: overdueDays,
        },
      });
      toast({ title: 'Buyer payment reminder logged', description: `Reminder recorded for ${buyerCompanyName || 'buyer'}. Email sending requires email domain setup.` });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      const { error } = await supabase.from('deals')
        .update({ status: 'in_collections' as any })
        .eq('id', dealId);
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user?.id,
        p_user_role: role as any,
        p_action_type: 'deal_status_changed' as AuditAction,
        p_metadata: { from: 'overdue', to: 'in_collections', action: 'escalated_to_collections' },
      });

      toast({ title: 'Application escalated to Collections' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setEscalating(false);
    }
  };

  const handleAddCollectionNote = async () => {
    if (!newNote.trim() || !user) return;
    setAddingNote(true);
    try {
      const { error } = await supabase.from('internal_notes').insert({
        deal_id: dealId,
        author_id: user.id,
        note_body: `[Collection Note] ${newNote.trim()}`,
      });
      if (error) throw error;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'internal_note_added' as AuditAction,
        p_metadata: { type: 'collection_note' },
      });

      setNewNote('');
      setNotesLoaded(false);
      toast({ title: 'Collection note added' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <CardTitle className="text-base text-destructive">
            {dealStatus === ('in_collections' as DealStatus) ? 'Collections Management' : 'Overdue Actions'}
          </CardTitle>
          <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
            {overdueDays} days overdue
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendReminder}
            disabled={sending || !buyerContactEmail}
            className="gap-1"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending…' : 'Send Buyer Payment Reminder'}
          </Button>
          {dealStatus === 'overdue' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleEscalate}
              disabled={escalating}
              className="gap-1"
            >
              <ShieldAlert className="h-4 w-4" />
              {escalating ? 'Escalating…' : 'Escalate to Collections'}
            </Button>
          )}
        </div>

        {!buyerContactEmail && (
          <p className="text-xs text-muted-foreground">No buyer email on file — reminder cannot be sent.</p>
        )}

        {/* Collection Notes */}
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Collection Activity Log</Label>
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Log collection activity…"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleAddCollectionNote}
              disabled={!newNote.trim() || addingNote}
              className="shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {notes.filter(n => n.note_body.startsWith('[Collection Note]')).length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes
                .filter(n => n.note_body.startsWith('[Collection Note]'))
                .map(note => (
                  <div key={note.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-sm text-foreground">{note.note_body.replace('[Collection Note] ', '')}</p>
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(note.created_at).toLocaleString('en-GB')}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
