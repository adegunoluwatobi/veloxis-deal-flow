import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CURRENCY_SYMBOLS, type InvoiceCurrency } from '@/types';
import { Globe } from 'lucide-react';

interface Props {
  invoiceCurrency: InvoiceCurrency | null;
  dealStatus: string;
}

export default function SettlementFxSection({
  invoiceCurrency,
  dealStatus,
}: Props) {
  const sym = CURRENCY_SYMBOLS[(invoiceCurrency ?? 'GBP') as InvoiceCurrency] ?? '£';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Settlement Details</CardTitle>
        </div>
        <CardDescription>Currency and settlement method for this facility</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Invoice / Settlement Currency</Label>
            <p className="text-sm font-medium text-foreground">{invoiceCurrency ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Settlement Method</Label>
            <p className="text-sm font-medium text-foreground">Foreign Currency to Domiciliary Account</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <Badge variant="secondary" className="bg-success/10 text-success text-xs">Domiciliary Account ✓</Badge>
          <p className="text-xs text-muted-foreground flex-1">
            Advance will be paid in {invoiceCurrency ?? 'GBP'} directly to the exporter's domiciliary account. The exporter is responsible for any local currency conversion costs.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
