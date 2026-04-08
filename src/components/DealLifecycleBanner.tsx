import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CURRENCY_SYMBOLS, type InvoiceCurrency } from '@/types';
import type { DealStatus } from '@/types';
import { Clock, CheckCircle2, AlertTriangle, Banknote, TrendingUp } from 'lucide-react';

interface DealLifecycleBannerProps {
  deal: {
    status: DealStatus;
    deal_reference: string | null;
    invoice_currency_v2: string | null;
    invoice_value: number | null;
    advance_amount: number | null;
    advance_percentage: number;
    platform_fee_amount: number | null;
    platform_fee_pct: number | null;
    discount_fee_amount: number | null;
    discount_fee_pct: number | null;
    gross_yield: number | null;
    net_advance_amount: number | null;
    payment_terms_days: number | null;
    demurrage_rate_daily: number;
    demurrage_amount: number;
    overdue_days: number;
    disbursement_date: string | null;
    repayment_due_date: string | null;
    funded_at: string | null;
    snapshot_late_penalty_rate_pct: number | null;
  };
  portal: 'exporter' | 'partner';
}

export default function DealLifecycleBanner({ deal, portal }: DealLifecycleBannerProps) {
  const sym = CURRENCY_SYMBOLS[(deal.invoice_currency_v2 as InvoiceCurrency) ?? 'GBP'] ?? '£';
  const fmt = (v: number | null) => v != null ? `${sym}${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—';

  // Calculate days remaining
  const daysRemaining = deal.repayment_due_date
    ? Math.max(0, Math.ceil((new Date(deal.repayment_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const showPricing = ['approved', 'ipu_sent', 'ipu_signed_awaiting_funding', 'funded_active',
    'repayment_due', 'overdue', 'payment_received', 'in_collections',
    'closed_repaid', 'closed_partial'].includes(deal.status);

  const showFundedBanner = deal.status === 'funded_active' || deal.status === 'repayment_due';
  const showOverdueBanner = deal.status === 'overdue' || deal.status === 'in_collections';
  const showApprovedBanner = deal.status === 'approved' || deal.status === 'ipu_sent';
  const showIpuSignedBanner = deal.status === 'ipu_signed_awaiting_funding';

  if (!showPricing && !showFundedBanner && !showOverdueBanner && !showApprovedBanner && !showIpuSignedBanner) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Approved — Awaiting IPU Banner */}
      {showApprovedBanner && (
        <Card className="border-success/50">
          <CardContent className="py-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {deal.status === 'approved' ? 'Application Approved — Awaiting IPU' : 'IPU Sent to Buyer — Awaiting Signature'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {deal.status === 'approved'
                  ? 'Veloxis is preparing the Irrevocable Payment Undertaking (IPU) for your buyer. You will be notified when your buyer signs.'
                  : 'The IPU has been sent to your buyer. Once they sign, your advance will be processed for disbursement.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* IPU Signed — Disbursement in Progress */}
      {showIpuSignedBanner && (
        <Card className="border-success/50">
          <CardContent className="py-4 flex items-start gap-3">
            <Banknote className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">IPU Signed — Disbursement in Progress</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your buyer has signed the payment undertaking. Your advance of {fmt(deal.net_advance_amount)} is being processed for disbursement to your domiciliary account.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funded Banner */}
      {showFundedBanner && (
        <Card className="border-success">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Funded (Active)</p>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Disbursement Date</p>
                    <p className="text-sm font-medium">{deal.disbursement_date || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Advance Received</p>
                    <p className="text-sm font-medium">{fmt(deal.net_advance_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Maturity Date</p>
                    <p className="text-sm font-medium">{deal.repayment_due_date || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Days Remaining</p>
                    <p className={cn('text-sm font-bold', daysRemaining != null && daysRemaining <= 7 ? 'text-warning' : 'text-foreground')}>
                      {daysRemaining != null ? `${daysRemaining} days` : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Late penalty rate: {((deal.snapshot_late_penalty_rate_pct ?? deal.demurrage_rate_daily * 100) ).toFixed(3)}%/day after maturity
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Banner */}
      {showOverdueBanner && (
        <Card className="border-destructive">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {deal.status === 'in_collections' ? 'In Collections' : 'Overdue — Penalty Accruing'}
              </p>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Days Overdue</p>
                  <p className="text-sm font-bold text-destructive">{deal.overdue_days}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Accrued Penalty</p>
                  <p className="text-sm font-bold text-destructive">{fmt(deal.demurrage_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Maturity Date</p>
                  <p className="text-sm font-medium">{deal.repayment_due_date || '—'}</p>
                </div>
              </div>
              {portal === 'exporter' && (
                <p className="text-xs text-destructive mt-2">
                  Please contact your buyer urgently to arrange payment. Penalties accrue daily until full payment is received.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Summary — read-only for both portals */}
      {showPricing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fee & Pricing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">Invoice Amount</TableCell>
                  <TableCell className="text-right font-medium">{fmt(deal.invoice_value)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Advance Rate</TableCell>
                  <TableCell className="text-right font-medium">{deal.advance_percentage}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Advance Amount</TableCell>
                  <TableCell className="text-right font-medium">{fmt(deal.advance_amount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Platform Fee ({((deal.platform_fee_pct ?? 0) * 100).toFixed(1)}%)</TableCell>
                  <TableCell className="text-right font-medium">{fmt(deal.platform_fee_amount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Discount Fee ({((deal.discount_fee_pct ?? 0) * 100).toFixed(1)}%)</TableCell>
                  <TableCell className="text-right font-medium">{fmt(deal.discount_fee_amount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Total Fees</TableCell>
                  <TableCell className="text-right font-medium">{fmt(deal.gross_yield)}</TableCell>
                </TableRow>
                <TableRow className="border-t-2">
                  <TableCell className="font-semibold">Net Advance</TableCell>
                  <TableCell className="text-right font-bold">{fmt(deal.net_advance_amount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Payment Terms</TableCell>
                  <TableCell className="text-right font-medium">{deal.payment_terms_days ?? '—'} days</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
