import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle, CheckCircle2, FileText, ArrowRight, Clock, Upload,
  Banknote, Plus, Pencil, User, Calendar, Shield, UploadCloud, FileX, MapPin,
  ShieldCheck, X, FolderOpen, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeKycStatus } from '@/lib/computeKycStatus';
import DealStatusBadge from '@/components/DealStatusBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DealStatus } from '@/types';

interface ActionDeal {
  id: string;
  deal_reference: string | null;
  status: DealStatus;
  buyer_company_name: string | null;
  invoice_value: number | null;
  invoice_currency_v2: string | null;
  advance_amount: number | null;
  gbp_equivalent: number | null;
}

const ACTION_STATUSES: DealStatus[] = [
  'changes_requested',
  'pending_exporter_acceptance',
  'docs_requested',
  'payment_received',
];

// Required KYC document types for exporter onboarding
const REQUIRED_DOCS: Array<{ type: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: 'cac_certificate', label: 'CAC Certificate', icon: FileText },
  { type: 'director_id', label: 'Director ID', icon: User },
  { type: 'nepc_certificate', label: 'Export Licence', icon: Shield },
];

// 4th KYC item — captured as structured address fields on the exporter row, not a document upload
const ADDRESS_KYC_KEY = '__registered_address__';

const PENDING_DEAL_STATUSES: DealStatus[] = [
  'draft', 'submitted', 'under_review', 'changes_requested', 'docs_requested',
  'ready_for_final_approval', 'pending_exporter_acceptance', 'approved',
  'ipu_sent', 'ipu_signed_awaiting_funding',
];
const ACTIVE_DEAL_STATUSES: DealStatus[] = ['funded_active', 'repayment_due', 'overdue', 'payment_received', 'in_collections'];
const CLOSED_DEAL_STATUSES: DealStatus[] = [
  'closed_repaid', 'closed_partial', 'rejected', 'rejected_by_partner', 'rejected_by_veloxis',
  'declined_by_exporter', 'ipu_expired',
];
const ADVANCED_DEAL_STATUSES: DealStatus[] = [
  'funded_active', 'repayment_due', 'overdue', 'payment_received', 'in_collections',
  'closed_repaid', 'closed_partial',
];

const DISMISS_KEY = 'veloxis_verified_banner_dismissed';

function getActionMessage(status: DealStatus): { icon: React.ReactNode; message: string } {
  switch (status) {
    case 'changes_requested':
      return { icon: <AlertTriangle className="h-4 w-4 text-warning" />, message: 'Changes requested — update and resubmit' };
    case 'pending_exporter_acceptance':
      return { icon: <Clock className="h-4 w-4 text-primary" />, message: 'Facility offer received — review and accept or decline' };
    case 'docs_requested':
      return { icon: <Upload className="h-4 w-4 text-warning" />, message: 'Documents requested — upload required documents' };
    case 'payment_received':
      return { icon: <Banknote className="h-4 w-4 text-success" />, message: 'Payment received — confirm receipt of residual balance' };
    default:
      return { icon: <AlertTriangle className="h-4 w-4" />, message: 'Action required' };
  }
}

function formatGBP(value: number) {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(1)}k`;
  return `£${value.toFixed(0)}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fileExt(name: string | null | undefined) {
  if (!name) return '';
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : '';
}

export default function ExporterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exporter, setExporter] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [actionDeals, setActionDeals] = useState<ActionDeal[]>([]);
  const [allDeals, setAllDeals] = useState<ActionDeal[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  });

  const load = async () => {
    if (!user) return;
    const { data: exp } = await supabase
      .from('exporters')
      .select('*')
      .eq('exporter_user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (exp) {
      setExporter(exp);
      const [docsRes, dealsRes, roleRes] = await Promise.all([
        supabase
          .from('exporter_documents')
          .select('*')
          .eq('exporter_id', exp.id)
          .eq('is_superseded', false)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('deals')
          .select('id, deal_reference, status, buyer_company_name, invoice_value, invoice_currency_v2, advance_amount, gbp_equivalent')
          .eq('exporter_id', exp.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('user_roles')
          .select('partner_organisation_id')
          .eq('user_id', exp.originator_id)
          .in('role', ['partner_admin', 'partner_staff'])
          .limit(1)
          .maybeSingle(),
      ]);
      setDocuments(docsRes.data ?? []);
      const deals = (dealsRes.data ?? []) as ActionDeal[];
      setAllDeals(deals);
      setActionDeals(deals.filter(d => ACTION_STATUSES.includes(d.status)));

      const partnerOrgId = (roleRes.data as any)?.partner_organisation_id;
      if (partnerOrgId) {
        const { data: org } = await supabase
          .from('partner_organisations')
          .select('name')
          .eq('id', partnerOrgId)
          .maybeSingle();
        setPartnerName(org?.name ?? null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();

    const channel = supabase
      .channel('exporter-dashboard-deals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const docStatusByType = useMemo(() => {
    const map = new Map<string, any>();
    documents.forEach((d) => {
      // Keep most recent (first due to order)
      if (!map.has(d.document_type)) map.set(d.document_type, d);
    });
    return map;
  }, [documents]);

  const docCompletedCount = REQUIRED_DOCS.filter((r) => {
    const d = docStatusByType.get(r.type);
    return d && d.document_status !== 'rejected';
  }).length;

  const docVerifiedCount = REQUIRED_DOCS.filter((r) => {
    const d = docStatusByType.get(r.type);
    return d?.document_status === 'verified';
  }).length;

  const stats = useMemo(() => {
    const advancedDeals = allDeals.filter((d) => ADVANCED_DEAL_STATUSES.includes(d.status));
    const advancedTotal = advancedDeals.reduce(
      (sum, d) => sum + (d.gbp_equivalent ?? d.advance_amount ?? 0),
      0,
    );
    return {
      total: allDeals.length,
      advanced: advancedTotal,
      pending: allDeals.filter((d) => PENDING_DEAL_STATUSES.includes(d.status)).length,
      active: allDeals.filter((d) => ACTIVE_DEAL_STATUSES.includes(d.status)).length,
      closed: allDeals.filter((d) => CLOSED_DEAL_STATUSES.includes(d.status)).length,
    };
  }, [allDeals]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;

  if (!exporter) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-4 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">No Exporter Profile Found</h2>
        <p className="text-sm text-muted-foreground mt-1">Your account is not linked to an exporter profile yet.</p>
      </div>
    );
  }

  // Address counts as a 4th KYC item once line1 + city are populated. No document upload required.
  const addressComplete = !!(exporter.registered_address_line1 && exporter.registered_city);
  const totalRequiredCount = REQUIRED_DOCS.length + 1; // 3 docs + address
  const completedCount = docCompletedCount + (addressComplete ? 1 : 0);
  const verifiedCount = docVerifiedCount + (addressComplete ? 1 : 0);

  const kyc = computeKycStatus(documents, 0, addressComplete);
  const initial = (exporter.company_name || '?').charAt(0).toUpperCase();
  const rcPending = !exporter.rc_number || exporter.rc_number.toLowerCase() === 'pending';
  const allDocsComplete = completedCount === totalRequiredCount;
  const isFullyVerified = verifiedCount === totalRequiredCount;

  const registeredAddress = [
    exporter.registered_address_line1,
    exporter.registered_address_line2,
    exporter.registered_city,
    exporter.registered_postcode,
    exporter.registered_country,
  ].filter(Boolean).join(', ') || '—';

  const dismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
  };

  const showVerifiedBanner = isFullyVerified && !bannerDismissed;

  return (
    <div className="-m-6 lg:-m-8 animate-fade-in">
      {/* ========= HERO HEADER ========= */}
      <header className="bg-veloxis-deep text-white px-6 lg:px-10 pt-8 pb-0 relative overflow-hidden">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-veloxis-teal/10 blur-3xl" />
        <div className="pointer-events-none absolute right-40 top-20 h-40 w-40 rounded-full bg-veloxis-teal/5 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-veloxis-teal text-3xl font-bold text-veloxis-deep shadow-lg">
                {initial}
              </div>
              {isFullyVerified && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-success text-white ring-2 ring-veloxis-deep">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">{exporter.company_name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                {isFullyVerified ? (
                  <Badge className="border-emerald-400/40 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/20 uppercase text-[10px] tracking-wider">
                    ✓ KYC Verified
                  </Badge>
                ) : rcPending ? (
                  <Badge className="border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15 uppercase text-[10px] tracking-wider">
                    RC Pending
                  </Badge>
                ) : (
                  <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15 uppercase text-[10px] tracking-wider">
                    RC {exporter.rc_number}
                  </Badge>
                )}
                <Badge className="border-veloxis-teal/40 bg-veloxis-teal/10 text-veloxis-teal hover:bg-veloxis-teal/15 uppercase text-[10px] tracking-wider">
                  Exporter
                </Badge>
                {partnerName && (
                  <Badge variant="outline" className="border-white/20 bg-white/5 text-white/80 hover:bg-white/10 uppercase text-[10px] tracking-wider">
                    Managed by {partnerName}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => navigate('/exporter/account/profile')}
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit Profile
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={!allDocsComplete ? 'cursor-not-allowed' : undefined}>
                  <Button
                    className="bg-veloxis-teal text-veloxis-deep hover:bg-veloxis-teal/90 disabled:pointer-events-none disabled:opacity-60"
                    onClick={() => navigate('/exporter/deals/new')}
                    disabled={!allDocsComplete}
                  >
                    <Plus className="mr-2 h-4 w-4" /> New Application
                  </Button>
                </span>
              </TooltipTrigger>
              {!allDocsComplete && (
                <TooltipContent side="bottom" className="max-w-xs">
                  Upload all 4 KYC documents (CAC Certificate, Director ID, Export Licence, Registered Address Proof) to enable new applications.
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>

        {/* Tabs */}
        <nav className="relative mt-8 flex gap-8 border-b border-white/10">
          {[
            { label: 'Overview', href: '/exporter', active: true },
          ].map((t) => (
            <Link
              key={t.label}
              to={t.href}
              className={cn(
                'relative pb-3 text-sm font-medium transition-colors',
                t.active ? 'text-white' : 'text-white/60 hover:text-white/90'
              )}
            >
              {t.label}
              {t.active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-veloxis-teal" />}
            </Link>
          ))}
        </nav>
      </header>

      {/* ========= BODY ========= */}
      <div className="bg-muted/30 px-6 lg:px-10 py-8 space-y-6">
        {/* Verified Banner */}
        {showVerifiedBanner && (
          <div className="flex items-start gap-4 rounded-xl border-2 border-success/40 bg-success/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-success">Identity Verified — You're ready to submit deals</p>
              <p className="mt-0.5 text-sm text-success/80">All 4 KYC documents have been reviewed and approved by Veloxis</p>
            </div>
            <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/30 uppercase text-[10px] tracking-wider">
              Active
            </Badge>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="flex h-8 w-8 items-center justify-center rounded-md text-success/70 transition-colors hover:bg-success/10 hover:text-success"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Action Required */}
        {actionDeals.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Action Required</h2>
            {actionDeals.map(deal => {
              const { icon, message } = getActionMessage(deal.status);
              return (
                <Link key={deal.id} to={`/exporter/deals/${deal.id}`}>
                  <Card className="border-warning/50 hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="py-3 flex items-center gap-3">
                      {icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {deal.deal_reference || deal.id.slice(0, 8)} — {deal.buyer_company_name || 'Unknown Buyer'}
                        </p>
                        <p className="text-xs text-muted-foreground">{message}</p>
                      </div>
                      <DealStatusBadge status={deal.status} portal="exporter" />
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* ========= KYC CARD ========= */}
        <Card className={cn(
          'border-2',
          isFullyVerified
            ? 'border-success/40 bg-success/5'
            : allDocsComplete
              ? 'border-success/40 bg-success/5'
              : 'border-amber-400/50 bg-amber-50/60 dark:bg-amber-500/5'
        )}>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                allDocsComplete ? 'bg-success/15 text-success' : 'bg-amber-400/20 text-amber-700 dark:text-amber-400'
              )}>
                {allDocsComplete ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <h3 className={cn('font-semibold', allDocsComplete ? 'text-success' : 'text-amber-800 dark:text-amber-300')}>
                  {isFullyVerified
                    ? 'KYC Verification Complete'
                    : allDocsComplete
                      ? 'KYC Documents Submitted'
                      : 'KYC Verification Required'}
                </h3>
                <p className={cn('text-sm', allDocsComplete ? 'text-success/80' : 'text-amber-700/90 dark:text-amber-400/80')}>
                  {isFullyVerified
                    ? `All documents verified by Veloxis on ${formatDate(exporter.kyc_verified_at) || 'review date'}`
                    : allDocsComplete
                      ? 'All documents uploaded and pending review.'
                      : `Complete all ${totalRequiredCount} items to unlock deal submissions`}
                </p>
              </div>
              {isFullyVerified && (
                <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/30 text-xs">
                  {verifiedCount} / {totalRequiredCount} Verified
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Verification progress</span>
                <span className={isFullyVerified ? 'text-success' : allDocsComplete ? 'text-success' : 'text-amber-700 dark:text-amber-400'}>
                  {isFullyVerified ? `${verifiedCount} of ${totalRequiredCount} verified` : `${completedCount} of ${totalRequiredCount} complete`}
                </span>
              </div>
              <Progress
                value={
                  isFullyVerified
                    ? 100
                    : (completedCount / totalRequiredCount) * 100
                }
                className={cn('h-1.5', allDocsComplete ? '[&>div]:bg-success' : '[&>div]:bg-amber-500')}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {REQUIRED_DOCS.map(({ type, label, icon: Icon }) => {
                const doc = docStatusByType.get(type);
                const status = doc?.document_status;
                const isVerified = status === 'verified';
                const isPending = status === 'pending_review';
                const isRejected = status === 'rejected';
                const isMissing = !doc;

                const isClickable = isMissing || isRejected;
                const Wrapper: React.ElementType = isClickable ? Link : 'div';
                const wrapperProps = isClickable
                  ? { to: `/exporter/documents?type=${type}` }
                  : {};

                return (
                  <Wrapper
                    key={type}
                    {...wrapperProps}
                    className={cn(
                      'rounded-lg border p-4 transition-all',
                      isClickable && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isVerified && 'border-success/40 bg-success/5',
                      isPending && 'border-blue-400/40 bg-blue-50/60 dark:bg-blue-500/5',
                      isRejected && 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10',
                      isMissing && 'border-amber-400/40 bg-amber-100/40 dark:bg-amber-500/10 hover:bg-amber-200/50 dark:hover:bg-amber-500/15'
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-md',
                        isVerified && 'bg-success/15 text-success',
                        isPending && 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                        isRejected && 'bg-destructive/15 text-destructive',
                        isMissing && 'bg-amber-400/20 text-amber-700 dark:text-amber-400'
                      )}>
                        {isRejected ? <FileX className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
                        {doc && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDate(doc.uploaded_at)}{fileExt(doc.file_name) && ` · ${fileExt(doc.file_name)}`}
                          </p>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            'mt-2 text-[10px] font-bold uppercase tracking-wider border',
                            isVerified && 'border-success/40 bg-success/10 text-success',
                            isPending && 'border-blue-400/40 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                            isRejected && 'border-destructive/40 bg-destructive/10 text-destructive',
                            isMissing && 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-400'
                          )}
                        >
                          {isVerified ? 'Verified' : isPending ? 'Pending Review' : isRejected ? 'Rejected' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                  </Wrapper>
                );
              })}

              {/* Address tile (4th KYC item) — driven by structured fields, not a document upload */}
              {(() => {
                const isVerified = addressComplete;
                const isMissing = !addressComplete;
                const isClickable = isMissing;
                const Wrapper: React.ElementType = isClickable ? Link : 'div';
                const wrapperProps = isClickable
                  ? { to: '/exporter/account/profile' }
                  : {};
                return (
                  <Wrapper
                    key={ADDRESS_KYC_KEY}
                    {...wrapperProps}
                    className={cn(
                      'rounded-lg border p-4 transition-all',
                      isClickable && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isVerified && 'border-success/40 bg-success/5',
                      isMissing && 'border-amber-400/40 bg-amber-100/40 dark:bg-amber-500/10 hover:bg-amber-200/50 dark:hover:bg-amber-500/15'
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-md',
                        isVerified && 'bg-success/15 text-success',
                        isMissing && 'bg-amber-400/20 text-amber-700 dark:text-amber-400'
                      )}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight">Registered Address</p>
                        {isVerified && (
                          <p className="mt-1 text-[11px] text-muted-foreground truncate">
                            {[exporter.registered_city, exporter.registered_country].filter(Boolean).join(', ')}
                          </p>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            'mt-2 text-[10px] font-bold uppercase tracking-wider border',
                            isVerified && 'border-success/40 bg-success/10 text-success',
                            isMissing && 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-400'
                          )}
                        >
                          {isVerified ? 'Complete' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                  </Wrapper>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* ========= TWO COLUMN: COMPANY PROFILE + APPLICATIONS ========= */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Company Profile */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-veloxis-teal/10 text-veloxis-teal">
                    <User className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-foreground">Company Profile</h3>
                </div>
                <Link
                  to="/exporter/account/profile"
                  className="text-sm font-medium text-veloxis-teal hover:underline inline-flex items-center gap-1"
                >
                  Edit <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <dl className="space-y-3 text-sm">
                <ProfileRow label="Company name" value={exporter.company_name} />
                <ProfileRow
                  label="RC number"
                  value={rcPending ? '—' : exporter.rc_number}
                />
                <ProfileRow
                  label="Registered address"
                  value={registeredAddress}
                />
                <ProfileRow
                  label="KYC status"
                  value={isFullyVerified ? '✓ Verified' : allDocsComplete ? kyc.label : 'Pending Documents'}
                  valueClassName={isFullyVerified || allDocsComplete ? 'text-success font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}
                />
                {partnerName && <ProfileRow label="Managed by" value={partnerName} />}
                <ProfileRow label="Email" value={exporter.contact_email || user?.email || '—'} />
                <ProfileRow
                  label="Onboarding"
                  value={exporter.onboarding_status === 'onboarding_approved' ? '✓ Complete' : 'In Progress'}
                  valueClassName={exporter.onboarding_status === 'onboarding_approved' ? 'text-success font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}
                />
              </dl>

              {/* Quick Actions */}
              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 gap-3">
                  <QuickAction
                    icon={<Plus className="h-4 w-4" />}
                    title="New deal"
                    subtitle="Submit invoice"
                    onClick={() => navigate('/exporter/deals/new')}
                    disabled={!allDocsComplete}
                  />
                  <QuickAction
                    icon={<FolderOpen className="h-4 w-4" />}
                    title="Documents"
                    subtitle={`${verifiedCount} verified`}
                    onClick={() => navigate('/exporter/documents')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Applications card */}
          <Card>
            <CardContent className="p-6">
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3 pb-6 mb-6 border-b border-border">
                <Stat label="Total" value={stats.total} color="text-foreground" />
                <Stat label="Advanced" value={stats.advanced > 0 ? formatGBP(stats.advanced) : '£0'} color="text-foreground" />
                <Stat label="Active" value={stats.active} color="text-veloxis-teal" />
                <Stat label="Closed" value={stats.closed} color="text-muted-foreground" />
              </div>

              {allDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-veloxis-teal/10 text-veloxis-teal">
                    <Layers className="h-6 w-6" />
                  </div>
                  <p className="font-semibold text-foreground">Ready to submit your first deal?</p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    {allDocsComplete
                      ? 'Your account is verified and active. Upload an invoice against a UK or EU buyer to get 80% advanced within 24 hours.'
                      : 'Complete your KYC verification above to unlock deal submissions.'}
                  </p>
                  {allDocsComplete && (
                    <Button
                      className="mt-4 bg-veloxis-teal text-veloxis-deep hover:bg-veloxis-teal/90"
                      onClick={() => navigate('/exporter/deals/new')}
                    >
                      Submit your first deal
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-veloxis-teal/10 text-veloxis-teal">
                        <FileText className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-foreground">Applications</h3>
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/exporter/deals">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {allDeals.slice(0, 5).map(deal => (
                      <Link
                        key={deal.id}
                        to={`/exporter/deals/${deal.id}`}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">
                            {deal.deal_reference || deal.id.slice(0, 8)}
                          </p>
                          {deal.buyer_company_name && (
                            <p className="text-xs text-muted-foreground truncate">{deal.buyer_company_name}</p>
                          )}
                        </div>
                        <DealStatusBadge status={deal.status} portal="exporter" />
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={cn('font-medium text-foreground text-right', valueClassName)}>{value}</dd>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickAction({
  icon, title, subtitle, onClick, disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-veloxis-teal/40 hover:bg-veloxis-teal/5'
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-veloxis-teal/10 text-veloxis-teal">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
    </button>
  );
}
