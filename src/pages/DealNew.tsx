import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  COMMODITY_TYPE_LABELS, BUYER_COUNTRY_WHITELIST, CURRENCY_SYMBOLS,
  type CommodityType, type InvoiceCurrency, type EntityType, type KycStatus,
} from '@/types';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';

interface VerifiedExporter {
  id: string;
  company_name: string;
  rc_number: string;
  entity_type: EntityType;
  kyc_status: KycStatus;
  subscription_tier: string;
}

interface PricingResult {
  advance_amount: number;
  platform_fee_pct: number;
  platform_fee_amount: number;
  discount_fee_pct: number;
  discount_fee_amount: number;
  gross_expected_yield: number;
  net_repayment_target: number;
}

const STEPS = ['Select Exporter', 'Trade Details', 'Buyer Details', 'Review & Submit'];

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 20 * 1024 * 1024;

export default function DealNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporters, setExporters] = useState<VerifiedExporter[]>([]);
  const [loadingExporters, setLoadingExporters] = useState(true);

  // Step 1: Exporter
  const [selectedExporterId, setSelectedExporterId] = useState('');

  // Step 2: Trade details
  const [trade, setTrade] = useState({
    commodity_type: '' as CommodityType | '',
    goods_description: '',
    invoice_number: '',
    invoice_currency: 'GBP' as InvoiceCurrency,
    invoice_value: '',
    invoice_date: '',
    payment_terms_days: '30',
  });
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [bolFile, setBolFile] = useState<File | null>(null);

  // Step 3: Buyer
  const [buyer, setBuyer] = useState({
    buyer_company_name: '',
    buyer_country: '',
    buyer_contact_name: '',
    buyer_contact_email: '',
  });

  // Pricing
  const [pricing, setPricing] = useState<PricingResult | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('exporters')
      .select('id, company_name, rc_number, entity_type, kyc_status, subscription_tier')
      .eq('originator_id', user.id)
      .eq('kyc_status', 'verified')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        setExporters((data as unknown as VerifiedExporter[]) ?? []);
        setLoadingExporters(false);
      });
  }, [user]);

  // Calculate pricing when trade details change
  useEffect(() => {
    const iv = parseFloat(trade.invoice_value);
    const pt = parseInt(trade.payment_terms_days);
    if (!iv || iv <= 0 || ![30, 45, 60].includes(pt) || !selectedExporterId) {
      setPricing(null);
      return;
    }
    const exporter = exporters.find(e => e.id === selectedExporterId);
    const tier = exporter?.subscription_tier ?? 'pay_as_you_go';
    supabase.rpc('calculate_deal_pricing', {
      p_invoice_value: iv,
      p_advance_percentage: 80,
      p_payment_terms_days: pt,
      p_subscription_tier: tier as 'pay_as_you_go' | 'veloxis_pro',
    }).then(({ data }) => {
      if (data && data.length > 0) setPricing(data[0] as PricingResult);
    });
  }, [trade.invoice_value, trade.payment_terms_days, selectedExporterId, exporters]);

  const selectedExporter = exporters.find(e => e.id === selectedExporterId);
  const currSymbol = CURRENCY_SYMBOLS[trade.invoice_currency] ?? '£';

  const normalizeTerms = (days: string) => {
    const n = parseInt(days);
    if (n <= 30) return '30';
    if (n <= 45) return '45';
    return '60';
  };

  const canProceedStep = (s: number): boolean => {
    switch (s) {
      case 0: return !!selectedExporterId;
      case 1: return !!(trade.commodity_type && trade.invoice_value && parseFloat(trade.invoice_value) > 0 && trade.payment_terms_days);
      case 2: return !!(buyer.buyer_company_name && buyer.buyer_country && buyer.buyer_contact_email);
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedExporter) return;
    setLoading(true);

    try {
      // Check NEPC not expired
      const { data: nepcDocs } = await supabase.from('exporter_documents')
        .select('expiry_status')
        .eq('exporter_id', selectedExporterId)
        .eq('document_type', 'nepc_certificate')
        .eq('is_superseded', false)
        .eq('document_status', 'verified')
        .limit(1);

      if (!nepcDocs || nepcDocs.length === 0) {
        toast({ title: 'Cannot submit', description: 'Exporter has no verified NEPC certificate.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (nepcDocs[0].expiry_status === 'expired') {
        toast({ title: 'Cannot submit', description: 'NEPC certificate has expired. Request replacement from exporter.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const terms = parseInt(normalizeTerms(trade.payment_terms_days));

      // Create deal as draft
      const { data: deal, error: dealErr } = await supabase.from('deals').insert({
        originator_id: user.id,
        exporter_id: selectedExporterId,
        commodity_type: trade.commodity_type as CommodityType,
        goods_description: trade.goods_description || null,
        invoice_number: trade.invoice_number || null,
        invoice_currency_v2: trade.invoice_currency,
        invoice_value: parseFloat(trade.invoice_value),
        invoice_date: trade.invoice_date || null,
        payment_terms_days: terms,
        buyer_company_name: buyer.buyer_company_name,
        buyer_country: buyer.buyer_country,
        buyer_contact_name: buyer.buyer_contact_name || null,
        buyer_contact_email: buyer.buyer_contact_email,
        status: 'draft',
      }).select('id').single();

      if (dealErr) throw dealErr;

      // Upload documents
      const uploadDoc = async (file: File, docType: 'commercial_invoice' | 'bill_of_lading') => {
        const filePath = `deal-docs/${deal.id}/${docType}/${crypto.randomUUID()}_${file.name}`;
        const { error: storErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file, { contentType: file.type });
        if (storErr) throw storErr;
        const { error: dbErr } = await supabase.from('deal_documents').insert({
          deal_id: deal.id,
          document_type: docType,
          file_name: file.name,
          file_path: filePath,
          file_size_bytes: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
        });
        if (dbErr) throw dbErr;
      };

      if (invoiceFile) await uploadDoc(invoiceFile, 'commercial_invoice');
      if (bolFile) await uploadDoc(bolFile, 'bill_of_lading');

      // Submit the deal
      const { error: submitErr } = await supabase.from('deals')
        .update({ status: 'submitted' })
        .eq('id', deal.id);

      if (submitErr) throw submitErr;

      toast({ title: 'Deal submitted', description: 'Your deal has been submitted for review.' });
      navigate('/deals');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit deal';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const validateFile = (file: File | null): boolean => {
    if (!file) return true;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast({ title: 'Invalid file', description: 'Only PDF, JPEG, PNG, WebP accepted.', variant: 'destructive' });
      return false;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: 'File too large', description: 'Max 20MB per file.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate('/deals')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Deals
      </Button>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
              i < step ? 'bg-success text-success-foreground' :
              i === step ? 'bg-primary text-primary-foreground' :
              'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-xs sm:inline ${i === step ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Exporter */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Exporter</CardTitle>
            <CardDescription>Choose a verified exporter to link this deal to. Only verified exporters are shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingExporters ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : exporters.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium text-foreground">No verified exporters</p>
                  <p className="text-xs text-muted-foreground">You need at least one verified exporter before creating a deal.</p>
                </div>
              </div>
            ) : (
              <Select value={selectedExporterId} onValueChange={setSelectedExporterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an exporter" />
                </SelectTrigger>
                <SelectContent>
                  {exporters.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.company_name} — RC {e.rc_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Trade Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Trade Details</CardTitle>
            <CardDescription>Enter the trade and invoice information for this deal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Commodity Type</Label>
                <Select value={trade.commodity_type} onValueChange={(v) => setTrade({ ...trade, commodity_type: v as CommodityType })}>
                  <SelectTrigger><SelectValue placeholder="Select commodity" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(COMMODITY_TYPE_LABELS) as [CommodityType, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Terms (days)</Label>
                <Select value={trade.payment_terms_days} onValueChange={(v) => setTrade({ ...trade, payment_terms_days: normalizeTerms(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="45">45 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Goods Description</Label>
              <Textarea
                placeholder="Brief description of goods being exported"
                value={trade.goods_description}
                onChange={(e) => setTrade({ ...trade, goods_description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Invoice Currency</Label>
                <Select value={trade.invoice_currency} onValueChange={(v) => setTrade({ ...trade, invoice_currency: v as InvoiceCurrency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invoice Value</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={trade.invoice_value}
                  onChange={(e) => setTrade({ ...trade, invoice_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={trade.invoice_date}
                  onChange={(e) => setTrade({ ...trade, invoice_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                placeholder="e.g. INV-2026-001"
                value={trade.invoice_number}
                onChange={(e) => setTrade({ ...trade, invoice_number: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Commercial Invoice (PDF)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (validateFile(f)) setInvoiceFile(f);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Bill of Lading (PDF)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (validateFile(f)) setBolFile(f);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Buyer Details */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Buyer Details</CardTitle>
            <CardDescription>Enter the European buyer's information for this trade.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Buyer Company Name</Label>
              <Input
                placeholder="e.g. Acme Trading GmbH"
                value={buyer.buyer_company_name}
                onChange={(e) => setBuyer({ ...buyer, buyer_company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Buyer Country</Label>
              <Select value={buyer.buyer_country} onValueChange={(v) => setBuyer({ ...buyer, buyer_country: v })}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {BUYER_COUNTRY_WHITELIST.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  placeholder="Full name"
                  value={buyer.buyer_contact_name}
                  onChange={(e) => setBuyer({ ...buyer, buyer_contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  placeholder="buyer@example.com"
                  value={buyer.buyer_contact_email}
                  onChange={(e) => setBuyer({ ...buyer, buyer_contact_email: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Deal Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-muted-foreground">Exporter</p><p className="font-medium">{selectedExporter?.company_name}</p></div>
                <div><p className="text-muted-foreground">Commodity</p><p className="font-medium">{COMMODITY_TYPE_LABELS[trade.commodity_type as CommodityType] ?? '—'}</p></div>
                <div><p className="text-muted-foreground">Invoice</p><p className="font-medium">{trade.invoice_number || '—'}</p></div>
                <div><p className="text-muted-foreground">Invoice Value</p><p className="font-medium">{currSymbol}{parseFloat(trade.invoice_value || '0').toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p></div>
                <div><p className="text-muted-foreground">Payment Terms</p><p className="font-medium">{trade.payment_terms_days} days</p></div>
                <div><p className="text-muted-foreground">Buyer</p><p className="font-medium">{buyer.buyer_company_name}, {buyer.buyer_country}</p></div>
                <div><p className="text-muted-foreground">Buyer Contact</p><p className="font-medium">{buyer.buyer_contact_email}</p></div>
                <div><p className="text-muted-foreground">Documents</p><p className="font-medium">{[invoiceFile && 'Invoice', bolFile && 'BoL'].filter(Boolean).join(', ') || 'None'}</p></div>
              </div>
            </CardContent>
          </Card>

          {pricing && (
            <Card>
              <CardHeader><CardTitle className="text-base">Indicative Pricing</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  These figures are indicative only. Final pricing is confirmed by the Deal Manager during review.
                </p>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><p className="text-muted-foreground">Advance (80%)</p><p className="font-medium">{currSymbol}{pricing.advance_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p></div>
                  <div><p className="text-muted-foreground">Platform Fee ({(pricing.platform_fee_pct * 100).toFixed(1)}%)</p><p className="font-medium">{currSymbol}{pricing.platform_fee_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p></div>
                  <div><p className="text-muted-foreground">Discount Fee ({(pricing.discount_fee_pct * 100).toFixed(1)}%)</p><p className="font-medium">{currSymbol}{pricing.discount_fee_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p></div>
                  <div><p className="text-muted-foreground">Expected Yield</p><p className="font-medium">{currSymbol}{pricing.gross_expected_yield.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canProceedStep(step)} onClick={() => setStep(step + 1)}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? 'Submitting…' : 'Submit Deal'}
          </Button>
        )}
      </div>
    </div>
  );
}
