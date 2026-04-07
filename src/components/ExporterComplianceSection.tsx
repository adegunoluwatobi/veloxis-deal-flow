import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  SANCTIONS_STATUS_LABELS, SANCTIONS_STATUS_COLORS,
  type SanctionsScreeningStatus,
} from '@/types';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface Props {
  exporterId: string;
  sanctionsStatus: SanctionsScreeningStatus;
  eddRequired: boolean;
  eddCompleted: boolean;
  sourceOfFundsStatement: string | null;
  isVeloxis: boolean;
  onReload: () => void;
}

export default function ExporterComplianceSection({
  exporterId,
  sanctionsStatus,
  eddRequired,
  eddCompleted,
  sourceOfFundsStatement,
  isVeloxis,
  onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [sanctions, setSanctions] = useState(sanctionsStatus);
  const [eddReq, setEddReq] = useState(eddRequired);
  const [eddDone, setEddDone] = useState(eddCompleted);

  const isSuperAdminOrDM = role === 'super_admin' || role === 'deal_manager';

  const handleSave = async () => {
    if (!isSuperAdminOrDM) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('exporters').update({
        sanctions_screening_status: sanctions,
        edd_required: eddReq,
        edd_completed: eddDone,
      } as any).eq('id', exporterId);
      if (error) throw error;
      toast({ title: 'Compliance settings updated' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Sanctions & Enhanced Due Diligence</CardTitle>
        </div>
        <CardDescription>Managed by Veloxis admin after external screening.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSuperAdminOrDM ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Sanctions / PEP Screening</Label>
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
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">EDD Required</p>
                <p className="text-xs text-muted-foreground">Enhanced Due Diligence — defaults to ON for Nigerian exporters.</p>
              </div>
              <Switch checked={eddReq} onCheckedChange={setEddReq} />
            </div>
            {eddReq && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">EDD Complete</p>
                  <p className="text-xs text-muted-foreground">Mark as complete once enhanced checks have been finalised.</p>
                </div>
                <Switch checked={eddDone} onCheckedChange={setEddDone} />
              </div>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Compliance Settings'}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sanctions / PEP Screening</span>
              <Badge variant="secondary" className={cn('text-xs', SANCTIONS_STATUS_COLORS[sanctionsStatus])}>
                {SANCTIONS_STATUS_LABELS[sanctionsStatus]}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">EDD Required</span>
              <span className="font-medium text-foreground">{eddRequired ? 'Yes' : 'No'}</span>
            </div>
            {eddRequired && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">EDD Status</span>
                <Badge variant="secondary" className={cn('text-xs', eddCompleted ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                  {eddCompleted ? 'Complete' : 'Pending'}
                </Badge>
              </div>
            )}
            {sourceOfFundsStatement && (
              <div className="text-sm">
                <span className="text-muted-foreground">Source of Funds Statement</span>
                <p className="mt-1 text-foreground bg-muted/50 rounded p-2 text-xs">{sourceOfFundsStatement}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
