import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, AlertTriangle, Globe2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuyerVerificationCardProps {
  dealId: string;
  buyerCompanyName: string | null;
  buyerCountry: string | null;
  buyer_ch_verified: boolean | null;
  buyer_ch_verified_at: string | null;
  buyer_ch_verified_by: string | null;
  buyer_ch_verified_by_role: string | null;
  buyer_ch_company_number: string | null;
  buyer_ch_company_status: string | null;
  buyer_ch_company_name: string | null;
  buyer_ch_registered_address: string | null;
  buyer_ch_sic_codes: string[] | null;
  buyer_ch_search_term: string | null;
  buyer_ch_found: boolean | null;
  /** Whether the current viewer can trigger verification (partner_admin/staff or veloxis staff) */
  canVerify: boolean;
  onVerified?: () => void;
}

const UK_LABELS = ['united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'];

function isUkBuyer(country: string | null): boolean {
  if (!country) return true; // assume verifiable until proven otherwise
  return UK_LABELS.includes(country.trim().toLowerCase());
}

function formatStatus(s: string | null): string {
  if (!s) return '—';
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(s: string | null): 'active' | 'inactive' | 'unknown' {
  if (!s) return 'unknown';
  const v = s.toLowerCase();
  if (v === 'active') return 'active';
  if (['dissolved', 'liquidation', 'receivership', 'administration', 'voluntary-arrangement', 'converted-closed'].includes(v))
    return 'inactive';
  return 'unknown';
}

export default function BuyerVerificationCard(props: BuyerVerificationCardProps) {
  const {
    dealId, buyerCompanyName, buyerCountry, canVerify, onVerified,
    buyer_ch_verified, buyer_ch_verified_at, buyer_ch_verified_by_role,
    buyer_ch_company_number, buyer_ch_company_status, buyer_ch_company_name,
    buyer_ch_registered_address, buyer_ch_sic_codes, buyer_ch_search_term, buyer_ch_found,
  } = props;
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const nonUk = !isUkBuyer(buyerCountry);

  const handleVerify = async () => {
    if (!buyerCompanyName) {
      toast({ title: 'Missing buyer name', description: 'Add a buyer company name first.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-buyer-companies-house', {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      if (data?.found) {
        toast({ title: 'Buyer verified', description: `${data.result?.title ?? 'Company'} matched on Companies House.` });
      } else {
        toast({ title: 'Not found', description: 'No matching company on Companies House.', variant: 'destructive' });
      }
      onVerified?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      toast({ title: 'Verification failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ---- Non-UK buyer ----
  if (nonUk) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe2 className="h-4 w-4" />
          <span>Non-UK company — Companies House verification not applicable.</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Record the verification method (e.g. DUNS, local registry) in the partner notes.
        </p>
      </div>
    );
  }

  // ---- Verified state ----
  if (buyer_ch_verified) {
    if (buyer_ch_found) {
      const tone = statusTone(buyer_ch_company_status);
      return (
        <div className="rounded-md border border-border bg-card p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1">
              <ShieldCheck className="h-3 w-3" /> Verified on Companies House
            </Badge>
            {canVerify && (
              <Button size="sm" variant="ghost" onClick={handleVerify} disabled={loading} className="h-7 text-xs">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Re-verify'}
              </Button>
            )}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <DefRow label="Registered name" value={buyer_ch_company_name} mono />
            <DefRow label="Company number" value={buyer_ch_company_number} mono />
            <DefRow label="Status" value={
              <span className={cn(
                'font-medium',
                tone === 'active' && 'text-emerald-600 dark:text-emerald-400',
                tone === 'inactive' && 'text-destructive',
                tone === 'unknown' && 'text-muted-foreground'
              )}>{formatStatus(buyer_ch_company_status)}</span>
            } />
            <DefRow label="SIC codes" value={buyer_ch_sic_codes && buyer_ch_sic_codes.length ? buyer_ch_sic_codes.join(', ') : '—'} mono />
            <DefRow label="Registered address" value={buyer_ch_registered_address} fullWidth />
          </dl>

          {tone === 'inactive' && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>This company is not currently active on Companies House. Review before proceeding.</span>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
            Verified by {buyer_ch_verified_by_role?.replace(/_/g, ' ') ?? 'user'}
            {buyer_ch_verified_at ? ` on ${new Date(buyer_ch_verified_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
            {buyer_ch_search_term ? ` · searched "${buyer_ch_search_term}"` : ''}
          </p>
        </div>
      );
    }
    // Verification attempted but not found
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="destructive" className="gap-1">
            <ShieldAlert className="h-3 w-3" /> Not found on Companies House
          </Badge>
          {canVerify && (
            <Button size="sm" variant="ghost" onClick={handleVerify} disabled={loading} className="h-7 text-xs">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Try again'}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          No matching company found for &ldquo;{buyer_ch_search_term ?? buyerCompanyName}&rdquo;. This buyer may be a non-UK company or the name may be entered incorrectly.
        </p>
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
          Checked by {buyer_ch_verified_by_role?.replace(/_/g, ' ') ?? 'user'}
          {buyer_ch_verified_at ? ` on ${new Date(buyer_ch_verified_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
        </p>
      </div>
    );
  }

  // ---- Not yet verified ----
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldQuestion className="h-4 w-4" />
          <span>Buyer not yet verified on Companies House.</span>
        </div>
        {canVerify ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleVerify}
            disabled={loading || !buyerCompanyName}
            className="border-primary/40 text-primary hover:bg-primary/10"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Verify on Companies House
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DefRow({ label, value, mono, fullWidth }: { label: string; value: React.ReactNode; mono?: boolean; fullWidth?: boolean }) {
  return (
    <div className={cn('flex flex-col', fullWidth && 'sm:col-span-2')}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn('text-foreground', mono && 'font-mono text-[11px]')}>{value || '—'}</dd>
    </div>
  );
}

/** Compact icon-only verification status for use in deal list rows. */
export function BuyerVerificationIcon({
  buyerCountry,
  buyer_ch_verified,
  buyer_ch_found,
  buyer_ch_company_status,
}: {
  buyerCountry: string | null;
  buyer_ch_verified: boolean | null;
  buyer_ch_found: boolean | null;
  buyer_ch_company_status: string | null;
}) {
  if (!isUkBuyer(buyerCountry)) {
    return <span title="Non-UK buyer — CH not applicable" className="inline-flex items-center text-muted-foreground"><Globe2 className="h-3.5 w-3.5" /></span>;
  }
  if (!buyer_ch_verified) {
    return <span title="Not yet verified" className="inline-flex items-center text-muted-foreground">—</span>;
  }
  if (!buyer_ch_found) {
    return <span title="Verification attempted — not found" className="inline-flex items-center text-destructive"><ShieldAlert className="h-3.5 w-3.5" /></span>;
  }
  const tone = statusTone(buyer_ch_company_status);
  if (tone === 'active') {
    return <span title="Verified — Active" className="inline-flex items-center text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-3.5 w-3.5" /></span>;
  }
  return <span title={`Verified — ${formatStatus(buyer_ch_company_status)} (review)`} className="inline-flex items-center text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /></span>;
}
