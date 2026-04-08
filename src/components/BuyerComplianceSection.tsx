import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  SANCTIONS_STATUS_LABELS, SANCTIONS_STATUS_COLORS,
  BUYER_CREDIT_CHECK_LABELS, BUYER_CREDIT_CHECK_COLORS,
  type SanctionsScreeningStatus, type BuyerCreditCheckStatus,
} from '@/types';
import { Shield, Upload } from 'lucide-react';
import { sanitiseFilename } from '@/lib/sanitiseFilename';

interface Props {
  dealId: string;
  buyerCountryOfIncorporation: string | null;
  buyerSanctionsStatus: SanctionsScreeningStatus;
  buyerCreditCheckStatus: BuyerCreditCheckStatus;
  buyerUnderwriterNotes: string | null;
  isVeloxis: boolean;
  onReload: () => void;
}

export default function BuyerComplianceSection({
  dealId,
  buyerCountryOfIncorporation,
  buyerSanctionsStatus,
  buyerCreditCheckStatus,
  buyerUnderwriterNotes,
  isVeloxis,
  onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [country, setCountry] = useState(buyerCountryOfIncorporation ?? '');
  const [sanctions, setSanctions] = useState(buyerSanctionsStatus);
  const [creditCheck, setCreditCheck] = useState(buyerCreditCheckStatus);
  const [notes, setNotes] = useState(buyerUnderwriterNotes ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const isSuperAdminOrDM = role === 'super_admin' || role === 'deal_manager';

  // Determine if already completed (non-default values present)
  const alreadyCompleted = (
    buyerSanctionsStatus !== 'pending_screening' ||
    buyerCreditCheckStatus !== 'pending' ||
    (buyerUnderwriterNotes && buyerUnderwriterNotes.trim().length > 0) ||
    (buyerCountryOfIncorporation && buyerCountryOfIncorporation.trim().length > 0)
  );

  const isLocked = alreadyCompleted || justSaved;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('deals').update({
        buyer_sanctions_status: isSuperAdminOrDM ? sanctions : buyerSanctionsStatus,
        buyer_credit_check_status: isSuperAdminOrDM ? creditCheck : buyerCreditCheckStatus,
        buyer_underwriter_notes: isSuperAdminOrDM ? (notes.trim() || null) : buyerUnderwriterNotes,
        buyer_country_of_incorporation: country.trim() || null,
      } as any).eq('id', dealId);
      if (error) throw error;
      toast({ title: 'Buyer compliance saved' });
      setJustSaved(true);
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDoc = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const filePath = `deals/${dealId}/buyer_${Date.now()}_${sanitiseFilename(file.name)}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file);
      if (storageErr) throw storageErr;

      const { error: docErr } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        document_type: 'buyer_registration_doc' as any,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (docErr) throw docErr;

      setFile(null);
      toast({ title: 'Buyer registration document uploaded' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Buyer Compliance</CardTitle>
          {isLocked && (
            <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">Saved</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Country of incorporation */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Buyer Country of Incorporation</Label>
          {isLocked ? (
            <p className="text-sm text-foreground">{country || '—'}</p>
          ) : (
            <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. United Kingdom" disabled={!isVeloxis} />
          )}
        </div>

        {/* Buyer registration doc upload — Veloxis only, only when not locked */}
        {isVeloxis && !isLocked && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buyer Company Registration Document</Label>
            <div className="flex gap-2">
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)} className="flex-1" />
              <Button size="sm" onClick={handleUploadDoc} disabled={!file || uploading}>
                <Upload className="mr-1 h-3 w-3" /> {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          </div>
        )}

        {/* Veloxis-only editable fields — or read-only if locked */}
        {isSuperAdminOrDM && !isLocked ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sanctions Screening</Label>
                <Select value={sanctions} onValueChange={v => setSanctions(v as SanctionsScreeningStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SANCTIONS_STATUS_LABELS) as [SanctionsScreeningStatus, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Credit Check</Label>
                <Select value={creditCheck} onValueChange={v => setCreditCheck(v as BuyerCreditCheckStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(BUYER_CREDIT_CHECK_LABELS) as [BuyerCreditCheckStatus, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Underwriter Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notes on buyer creditworthiness…" />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Sanctions Screening</span>
                <Badge variant="secondary" className={cn('ml-2 text-xs', SANCTIONS_STATUS_COLORS[buyerSanctionsStatus])}>
                  {SANCTIONS_STATUS_LABELS[buyerSanctionsStatus]}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Credit Check</span>
                <Badge variant="secondary" className={cn('ml-2 text-xs', BUYER_CREDIT_CHECK_COLORS[buyerCreditCheckStatus])}>
                  {BUYER_CREDIT_CHECK_LABELS[buyerCreditCheckStatus]}
                </Badge>
              </div>
            </div>
            {buyerUnderwriterNotes && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Underwriter Notes</Label>
                <p className="text-sm text-foreground whitespace-pre-wrap">{buyerUnderwriterNotes}</p>
              </div>
            )}
          </>
        )}

        {/* Save button only when not locked and user is Veloxis */}
        {isSuperAdminOrDM && !isLocked && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Buyer Compliance'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
