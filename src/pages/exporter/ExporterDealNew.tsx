import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput, stripCommas } from '@/components/ui/currency-input';
import { PhoneInput } from '@/components/ui/phone-input';
import { EmailInput, isValidEmail } from '@/components/ui/email-input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Upload, Loader2, ShieldCheck } from 'lucide-react';
import { BUYER_COUNTRY_WHITELIST } from '@/types';
import { cn } from '@/lib/utils';

const STEPS = ['Bank Account', 'Invoice Details', 'Buyer Details', 'Export Details', 'Transaction Documents', 'Fee Calculator', 'Review & Submit'];
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'Other'] as const;
const BANK_COUNTRIES = ['Nigeria', 'United Kingdom', 'United States', 'Ghana', 'Kenya', 'South Africa'] as const;
const CURRENCIES = [
  { value: 'GBP', label: '£ GBP', symbol: '£' },
  { value: 'USD', label: '$ USD', symbol: '$' },
  { value: 'EUR', label: '€ EUR', symbol: '€' },
  { value: 'NGN', label: '₦ NGN', symbol: '₦' },
] as const;

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 20 * 1024 * 1024;

interface ExporterProfile {
  id: string;
  company_name: string;
  originator_id: string;
}

interface ExportLicenceDoc {
  id: string;
  file_name: string;
  document_status: string;
}

export default function ExporterDealNew() {
  const { user } = useAuth();
  const { id: editDealId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [exporter, setExporter] = useState<ExporterProfile | null>(null);
  const [exportLicence, setExportLicence] = useState<ExportLicenceDoc | null>(null);
  const [savedBankAccounts, setSavedBankAccounts] = useState<any[]>([]);
  const [saveBankDetails, setSaveBankDetails] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [existingInvoicePath, setExistingInvoicePath] = useState<string | null>(null);
  const [pricingConfig, setPricingConfig] = useState<any>(null);
  const [paymentTermsDays, setPaymentTermsDays] = useState('');
  const [feeAccepted, setFeeAccepted] = useState(false);
  const [extendedTermsConfirmed, setExtendedTermsConfirmed] = useState(false);
  const [tradePackFiles, setTradePackFiles] = useState<Record<string, File>>({});
  const [tradePackUploading, setTradePackUploading] = useState(false);
  const isEditing = !!editDealId;

  const [form, setForm] = useState({
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_sort_code_iban: '',
    bank_country: '',
    invoice_number: '',
    invoice_date: '',
    invoice_amount: '',
    invoice_currency: 'GBP',
    payment_due_date: '',
    invoice_file: null as File | null,
    buyer_company_name: '',
    buyer_country: '',
    buyer_contact_name: '',
    buyer_contact_email: '',
    buyer_contact_phone: '',
    goods_description: '',
    export_destination: '',
    export_licence_number: '',
    hs_code: '',
    incoterms: '',
    fx_risk_acknowledged: false,
  });

  useEffect(() => {
    if (!user) return;
    // Load pricing config
    supabase.from('pricing_config').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) setPricingConfig(data);
    });
    const load = async () => {
      const { data: exp } = await supabase
        .from('exporters')
        .select('id, company_name, originator_id')
        .eq('exporter_user_id', user.id)
        .maybeSingle();
      if (exp) {
        setExporter(exp);
        const { data: banks } = await supabase
          .from('exporter_bank_accounts')
          .select('*')
          .eq('exporter_id', exp.id)
          .order('is_default', { ascending: false });
        setSavedBankAccounts(banks ?? []);

        // If editing an existing draft, load its data
        if (editDealId) {
          const { data: deal } = await supabase
            .from('deals')
            .select('*')
            .eq('id', editDealId)
            .maybeSingle();
          if (deal && (deal.status === 'draft' || deal.status === 'changes_requested')) {
            setForm(f => ({
              ...f,
              bank_name: deal.bank_name ?? '',
              bank_account_name: deal.bank_account_name ?? '',
              bank_account_number: deal.bank_account_number ?? '',
              bank_sort_code_iban: deal.bank_sort_code_iban ?? '',
              bank_country: deal.bank_country ?? '',
              invoice_number: deal.invoice_number ?? '',
              invoice_date: deal.invoice_date ?? '',
              invoice_amount: deal.invoice_value ? deal.invoice_value.toLocaleString('en-GB') : '',
              invoice_currency: deal.invoice_currency_v2 ?? 'GBP',
              payment_due_date: deal.payment_due_date ?? '',
              invoice_file: null, // can't restore file, user can re-upload
              buyer_company_name: deal.buyer_company_name ?? '',
              buyer_country: deal.buyer_country ?? '',
              buyer_contact_name: deal.buyer_contact_name ?? '',
              buyer_contact_email: deal.buyer_contact_email ?? '',
              buyer_contact_phone: deal.buyer_contact_phone ?? '',
              goods_description: deal.goods_description ?? '',
              export_destination: deal.export_destination ?? '',
              export_licence_number: deal.export_licence_number ?? '',
              hs_code: deal.hs_code ?? '',
              incoterms: deal.incoterms ?? '',
            }));
            // Mark that we already have an invoice file if one exists
            if (deal.invoice_file_path) {
              setExistingInvoicePath(deal.invoice_file_path);
            }
          }
        } else if (banks && banks.length > 0) {
          const def = banks.find((b: any) => b.is_default) || banks[0];
          setForm(f => ({
            ...f,
            bank_name: def.bank_name,
            bank_account_name: def.account_name,
            bank_account_number: def.account_number,
            bank_sort_code_iban: def.sort_code_iban,
            bank_country: def.bank_country,
          }));
        }

        const { data: licDoc } = await supabase
          .from('exporter_documents')
          .select('id, file_name, document_status')
          .eq('exporter_id', exp.id)
          .eq('document_type', 'nepc_certificate')
          .eq('is_superseded', false)
          .maybeSingle();
        setExportLicence(licDoc as ExportLicenceDoc | null);
      }
    };
    load();
  }, [user, editDealId]);

  const updateField = (field: string, value: any) => {
    setForm(f => ({ ...f, [field]: value }));
    // Clear field error when user starts correcting
    if (fieldErrors[field]) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const bankNameMatch = exporter
    ? form.bank_account_name.trim().toLowerCase() === exporter.company_name.trim().toLowerCase()
    : null;

  const currencySymbol = CURRENCIES.find(c => c.value === form.invoice_currency)?.symbol ?? '';

  // Fee calculator values
  const invoiceAmount = parseFloat(stripCommas(form.invoice_amount)) || 0;
  const advRatePct = pricingConfig?.advance_rate_pct ?? 80;
  const platformFeePct = pricingConfig?.platform_fee_pct ?? 1;
  const discountFeePctMonthly = pricingConfig?.discount_fee_pct_monthly ?? 2;
  const latePenaltyRate = pricingConfig?.late_penalty_rate_pct_daily ?? 0.067;
  const minTerms = pricingConfig?.min_payment_terms_days ?? 30;
  const maxTerms = pricingConfig?.max_payment_terms_days ?? 90;
  const terms = parseInt(paymentTermsDays) || 0;
  const advanceAmount = invoiceAmount * (advRatePct / 100);
  const platformFeeAmount = invoiceAmount * (platformFeePct / 100);
  const discountFeeAmount = advanceAmount * (discountFeePctMonthly / 100) * (terms / 30);
  const totalFees = platformFeeAmount + discountFeeAmount;
  const netAdvance = advanceAmount - totalFees;

  const REQUIRED_TRADE_DOCS = ['commercial_invoice', 'bill_of_lading', 'buyer_registration_doc'];
  const RECOMMENDED_TRADE_DOCS = ['packing_list', 'insurance_certificate', 'nxp_form'];
  const ALL_TRADE_DOCS = [
    { type: 'commercial_invoice', label: 'Commercial Invoice', required: true },
    { type: 'bill_of_lading', label: 'Bill of Lading / Airway Bill', required: true },
    { type: 'buyer_registration_doc', label: 'Buyer Registration Document', required: true },
    { type: 'packing_list', label: 'Packing List', required: false },
    { type: 'insurance_certificate', label: 'Insurance Certificate', required: false },
    { type: 'nxp_form', label: 'NXP Form (Customs Export Declaration)', required: false },
  ];
  const requiredDocsUploaded = REQUIRED_TRADE_DOCS.filter(t => tradePackFiles[t]).length;
  const recommendedDocsUploaded = RECOMMENDED_TRADE_DOCS.filter(t => tradePackFiles[t]).length;

  const canProceed = (s: number) => {
    switch (s) {
      case 0: return form.bank_name && form.bank_account_name && form.bank_account_number && form.bank_sort_code_iban && form.bank_country;
      case 1: return form.invoice_number && form.invoice_date && form.invoice_amount && form.invoice_currency && form.payment_due_date && (form.invoice_file || existingInvoicePath);
      case 2: return form.buyer_company_name && form.buyer_country && form.buyer_contact_name && form.buyer_contact_email && isValidEmail(form.buyer_contact_email) && form.buyer_contact_phone;
      case 3: return form.goods_description && form.export_destination && form.export_licence_number && form.hs_code && form.incoterms;
      case 4: return requiredDocsUploaded === REQUIRED_TRADE_DOCS.length;
      case 5: return terms >= minTerms && terms <= maxTerms && feeAccepted && (terms <= 60 || extendedTermsConfirmed);
      default: return true;
    }
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!exporter || !user) return;
    if (!asDraft && !isValidEmail(form.buyer_contact_email)) {
      setFieldErrors(prev => ({ ...prev, buyer_contact_email: 'Please enter a valid email address' }));
      setStep(2);
      return;
    }
    if (!asDraft && !form.fx_risk_acknowledged) {
      toast({ title: 'FX Risk Acknowledgement Required', description: 'Please acknowledge the FX risk before submitting.', variant: 'destructive' });
      setStep(6);
      return;
    }
    if (!asDraft && !feeAccepted) {
      toast({ title: 'Fee Acceptance Required', description: 'Please accept the fee structure before submitting.', variant: 'destructive' });
      setStep(5);
      return;
    }
    setSaving(true);
    try {
      let invoiceFilePath: string | null = existingInvoicePath;
      if (form.invoice_file) {
        const safeName = sanitiseFilename(form.invoice_file.name);
        const path = `deals/${exporter.id}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('veloxis-documents')
          .upload(path, form.invoice_file);
        if (upErr) throw upErr;
        invoiceFilePath = path;
      }

      const { data: orgData } = await supabase
        .rpc('get_partner_org_id', { _user_id: exporter.originator_id });

      const dealData: any = {
        exporter_id: exporter.id,
        originator_id: exporter.originator_id,
        partner_organisation_id: orgData,
        status: asDraft ? 'draft' : 'submitted',
        bank_name: form.bank_name,
        bank_account_name: form.bank_account_name,
        bank_account_number: form.bank_account_number,
        bank_sort_code_iban: form.bank_sort_code_iban,
        bank_country: form.bank_country,
        bank_name_match: bankNameMatch,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        invoice_value: parseFloat(stripCommas(form.invoice_amount)),
        invoice_currency_v2: form.invoice_currency,
        payment_due_date: form.payment_due_date,
        invoice_file_path: invoiceFilePath,
        buyer_company_name: form.buyer_company_name,
        buyer_country: form.buyer_country,
        buyer_contact_name: form.buyer_contact_name,
        buyer_contact_email: form.buyer_contact_email,
        buyer_contact_phone: form.buyer_contact_phone,
        buyer_name_match: true,
        goods_description: form.goods_description,
        export_destination: form.export_destination,
        export_licence_number: form.export_licence_number,
        hs_code: form.hs_code,
        incoterms: form.incoterms,
        export_licence_document_id: exportLicence?.id ?? null,
        licence_name_match: exportLicence ? true : null,
        fx_risk_acknowledged: form.fx_risk_acknowledged,
        settlement_currency: form.invoice_currency,
        payment_terms_days: terms || null,
        advance_percentage: advRatePct,
        advance_amount: advanceAmount > 0 ? advanceAmount : null,
        platform_fee_pct: platformFeePct / 100,
        platform_fee_amount: platformFeeAmount > 0 ? platformFeeAmount : null,
        discount_fee_pct: discountFeePctMonthly / 100,
        discount_fee_amount: discountFeeAmount > 0 ? discountFeeAmount : null,
        gross_yield: totalFees > 0 ? totalFees : null,
        net_advance_amount: netAdvance > 0 ? netAdvance : null,
        repayment_amount: invoiceAmount > 0 ? invoiceAmount : null,
        snapshot_advance_rate_pct: advRatePct,
        snapshot_platform_fee_pct: platformFeePct,
        snapshot_discount_fee_pct: discountFeePctMonthly,
        snapshot_late_penalty_rate_pct: latePenaltyRate,
        demurrage_rate_daily: latePenaltyRate / 100,
      };

      if (!asDraft) {
        dealData.submitted_at = new Date().toISOString();
        dealData.fee_acceptance_at = new Date().toISOString();
        dealData.fee_acceptance_by = user.id;
      }

      let dealId: string;
      if (isEditing) {
        const { error } = await supabase.from('deals').update(dealData as any).eq('id', editDealId!);
        if (error) throw error;
        dealId = editDealId!;
      } else {
        const { data: newDeal, error } = await supabase.from('deals').insert(dealData).select('id').single();
        if (error) throw error;
        dealId = newDeal.id;
      }

      // Upload trade pack documents
      for (const [docType, file] of Object.entries(tradePackFiles)) {
        const safeName = sanitiseFilename(file.name);
        const docPath = `deals/${dealId}/${docType}/${Date.now()}_${safeName}`;
        const { error: docUpErr } = await supabase.storage.from('veloxis-documents').upload(docPath, file);
        if (!docUpErr) {
          await supabase.from('deal_documents').insert({
            deal_id: dealId,
            document_type: docType as any,
            file_name: file.name,
            file_path: docPath,
            uploaded_by: user.id,
            file_size_bytes: file.size,
            mime_type: file.type,
          });
        }
      }

      // Audit log
      const actionType = isEditing
        ? (asDraft ? 'deal_field_edited' : 'deal_submitted')
        : (asDraft ? 'deal_created' : 'deal_submitted');
      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: 'exporter' as any,
        p_action_type: actionType as any,
        p_metadata: { actor_name: user.email, email: user.email, invoice_number: form.invoice_number },
      });


      if (saveBankDetails && savedBankAccounts.length === 0) {
        await supabase.from('exporter_bank_accounts').insert({
          exporter_id: exporter.id,
          bank_name: form.bank_name,
          account_name: form.bank_account_name,
          account_number: form.bank_account_number,
          sort_code_iban: form.bank_sort_code_iban,
          bank_country: form.bank_country,
          is_default: true,
        });
      }

      toast({ title: asDraft ? 'Application saved as draft' : 'Application submitted successfully' });
      navigate('/exporter/deals');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!exporter) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/exporter/deals')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isEditing ? 'Edit Application' : 'Submit an Application'}</h1>
          <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      {/* Step 0: Bank Account */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Business Bank Account</CardTitle>
            <CardDescription>Enter your bank details for receiving funds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Name *</Label>
              <Input value={form.bank_name} onChange={e => updateField('bank_name', e.target.value)} placeholder="e.g. First Bank of Nigeria" />
            </div>
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input value={form.bank_account_name} onChange={e => updateField('bank_account_name', e.target.value)} placeholder="Must match your company name" />
              {form.bank_account_name && bankNameMatch === false && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Account name must match your registered company name: {exporter.company_name}
                </p>
              )}
              {form.bank_account_name && bankNameMatch === true && (
                <p className="text-xs text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />Name matches company name
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Account Number *</Label>
              <Input value={form.bank_account_number} onChange={e => updateField('bank_account_number', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sort Code / IBAN / SWIFT *</Label>
              <Input value={form.bank_sort_code_iban} onChange={e => updateField('bank_sort_code_iban', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bank Country *</Label>
              <Select value={form.bank_country} onValueChange={v => updateField('bank_country', v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {BANK_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="save-bank" checked={saveBankDetails} onCheckedChange={(v) => setSaveBankDetails(v === true)} />
              <label htmlFor="save-bank" className="text-sm text-muted-foreground">Save bank details for future applications</label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Invoice Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
            <CardDescription>Provide details of the trade invoice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Invoice Number *</Label>
              <Input value={form.invoice_number} onChange={e => updateField('invoice_number', e.target.value)} placeholder="e.g. INV-2024/001" />
            </div>
            <div className="space-y-2">
              <Label>Invoice Date *</Label>
              <Input type="date" value={form.invoice_date} onChange={e => updateField('invoice_date', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Amount *</Label>
                <CurrencyInput
                  value={form.invoice_amount}
                  onChange={v => updateField('invoice_amount', v)}
                  currencyLabel={currencySymbol}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency *</Label>
                <Select value={form.invoice_currency} onValueChange={v => updateField('invoice_currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Due Date *</Label>
              <Input type="date" value={form.payment_due_date} onChange={e => updateField('payment_due_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Upload Invoice File * (PDF or image)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f && !ALLOWED_MIME.includes(f.type)) {
                    toast({ title: 'Invalid file type', variant: 'destructive' });
                    return;
                  }
                  if (f && f.size > MAX_SIZE) {
                    toast({ title: 'File too large (max 20 MB)', variant: 'destructive' });
                    return;
                  }
                  updateField('invoice_file', f ?? null);
                }}
              />
              {form.invoice_file && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Upload className="h-3 w-3" />{form.invoice_file.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Buyer Details */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Buyer Details</CardTitle>
            <CardDescription>Information about the buyer / importer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Buyer Company Name *</Label>
              <Input value={form.buyer_company_name} onChange={e => updateField('buyer_company_name', e.target.value)} placeholder="Must match name on invoice" />
            </div>
            <div className="space-y-2">
              <Label>Buyer Country *</Label>
              <Select value={form.buyer_country} onValueChange={v => updateField('buyer_country', v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {BUYER_COUNTRY_WHITELIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contact Name *</Label>
              <Input value={form.buyer_contact_name} onChange={e => updateField('buyer_contact_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contact Email *</Label>
              <EmailInput
                value={form.buyer_contact_email}
                onChange={e => updateField('buyer_contact_email', e.target.value)}
                error={fieldErrors.buyer_contact_email}
                placeholder="buyer@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone *</Label>
              <PhoneInput
                value={form.buyer_contact_phone}
                onChange={v => updateField('buyer_contact_phone', v)}
                placeholder="8012345678"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Export Details */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Export Details</CardTitle>
            <CardDescription>Trade and export information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Goods / Commodity Description *</Label>
              <Textarea value={form.goods_description} onChange={e => updateField('goods_description', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Export Destination Country *</Label>
              <Select value={form.export_destination} onValueChange={v => updateField('export_destination', v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {BUYER_COUNTRY_WHITELIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Export Licence Number *</Label>
              <Input value={form.export_licence_number} onChange={e => updateField('export_licence_number', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>HS Code *</Label>
              <Input value={form.hs_code} onChange={e => updateField('hs_code', e.target.value)} placeholder="e.g. 2601.11" />
            </div>
            <div className="space-y-2">
              <Label>Incoterms *</Label>
              <Select value={form.incoterms} onValueChange={v => updateField('incoterms', v)}>
                <SelectTrigger><SelectValue placeholder="Select incoterms" /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground mb-1">Export Licence on File</p>
              {exportLicence ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  {exportLicence.file_name} — {exportLicence.document_status === 'verified' ? 'Verified ✅' : 'Pending Review'}
                </p>
              ) : (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  No NEPC certificate on file. Please upload it in your Documents section first.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Transaction Documents */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction Documents</CardTitle>
            <CardDescription>Upload the trade pack documents for this application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ALL_TRADE_DOCS.map(doc => {
              const file = tradePackFiles[doc.type];
              return (
                <div key={doc.type} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {file ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{doc.label}</p>
                      {file && <p className="text-xs text-muted-foreground truncate">{file.name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className={cn("text-xs", doc.required ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                      {doc.required ? 'Required' : 'Recommended'}
                    </Badge>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f && !ALLOWED_MIME.includes(f.type)) {
                            toast({ title: 'Invalid file type', variant: 'destructive' });
                            return;
                          }
                          if (f && f.size > MAX_SIZE) {
                            toast({ title: 'File too large (max 20 MB)', variant: 'destructive' });
                            return;
                          }
                          if (f) setTradePackFiles(prev => ({ ...prev, [doc.type]: f }));
                        }}
                      />
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 pointer-events-none">
                        <Upload className="h-3 w-3" />
                        {file ? 'Replace' : 'Upload'}
                      </Button>
                    </label>
                  </div>
                </div>
              );
            })}

            {/* Checklist summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground">
                {requiredDocsUploaded === REQUIRED_TRADE_DOCS.length ? (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    {requiredDocsUploaded} of {REQUIRED_TRADE_DOCS.length} required documents uploaded ✓
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {requiredDocsUploaded} of {REQUIRED_TRADE_DOCS.length} required documents uploaded
                  </span>
                )}
              </p>
              <p className="text-muted-foreground mt-1">
                {recommendedDocsUploaded} of {RECOMMENDED_TRADE_DOCS.length} recommended documents uploaded
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Fee Calculator */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Fee Calculator & Acceptance</CardTitle>
            <CardDescription>Review the fee structure based on your payment terms. You must accept these terms before submitting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-terms">Payment Terms (days) *</Label>
              <Input
                id="payment-terms"
                type="number"
                min={minTerms}
                max={maxTerms}
                value={paymentTermsDays}
                onChange={e => setPaymentTermsDays(e.target.value)}
                placeholder={`${minTerms}–${maxTerms} days`}
              />
              {terms > 0 && terms < minTerms && (
                <p className="text-xs text-destructive">Minimum payment terms is {minTerms} days</p>
              )}
              {terms > maxTerms && (
                <p className="text-xs text-destructive">Maximum payment terms is {maxTerms} days</p>
              )}
              {terms > 30 && terms <= 60 && (
                <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 mt-1">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">Payment terms above 30 days increase your discount fee. Ensure this matches your contract with the buyer.</p>
                </div>
              )}
              {terms > 60 && terms <= maxTerms && (
                <div className="space-y-2 mt-1">
                  <div className="flex items-start gap-2 rounded-md border border-[hsl(30,90%,50%)]/40 bg-[hsl(30,90%,50%)]/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-[hsl(30,90%,50%)] shrink-0 mt-0.5" />
                    <p className="text-xs text-[hsl(30,90%,50%)]">Warning: Standard export finance terms are 30 days. Terms above 60 days significantly increase your fees and repayment risk.</p>
                  </div>
                  <div className="flex items-start space-x-2 pl-1">
                    <Checkbox
                      id="extended-terms-confirm"
                      checked={extendedTermsConfirmed}
                      onCheckedChange={(v) => setExtendedTermsConfirmed(v === true)}
                    />
                    <label htmlFor="extended-terms-confirm" className="text-xs text-muted-foreground leading-relaxed">
                      I confirm these payment terms have been agreed in my contract with the buyer
                    </label>
                  </div>
                </div>
              )}
            </div>

            {invoiceAmount > 0 && terms >= minTerms && terms <= maxTerms && (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className="text-left py-2 px-4 font-medium">Field</th><th className="text-left py-2 px-4 font-medium">Value</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-border"><td className="py-2 px-4">Invoice Amount</td><td className="py-2 px-4 font-medium">{currencySymbol}{invoiceAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
                    <tr className="border-t border-border"><td className="py-2 px-4">Advance Rate</td><td className="py-2 px-4 font-medium">{advRatePct}%</td></tr>
                    <tr className="border-t border-border"><td className="py-2 px-4">Advance Amount</td><td className="py-2 px-4 font-medium">{currencySymbol}{advanceAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
                    <tr className="border-t border-border"><td className="py-2 px-4">Platform Fee ({platformFeePct}% one-off)</td><td className="py-2 px-4 font-medium">{currencySymbol}{platformFeeAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
                    <tr className="border-t border-border"><td className="py-2 px-4">Discount Fee ({discountFeePctMonthly}%/month × {terms} days)</td><td className="py-2 px-4 font-medium">{currencySymbol}{discountFeeAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
                    <tr className="border-t border-border"><td className="py-2 px-4">Total Fees</td><td className="py-2 px-4 font-medium">{currencySymbol}{totalFees.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
                    <tr className="border-t-2 border-border"><td className="py-2 px-4 font-semibold">Net Advance to You</td><td className="py-2 px-4 font-bold">{currencySymbol}{netAdvance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
                    <tr className="border-t border-border"><td className="py-2 px-4">Late Penalty Rate</td><td className="py-2 px-4 font-medium">{latePenaltyRate.toFixed(3)}% per day after maturity</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {invoiceAmount > 0 && terms >= minTerms && terms <= maxTerms && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="fee-acceptance"
                    checked={feeAccepted}
                    onCheckedChange={(v) => setFeeAccepted(v === true)}
                  />
                  <label htmlFor="fee-acceptance" className="text-xs text-muted-foreground leading-relaxed">
                    I have reviewed and agree to the fee structure above. I understand the net advance, total fees, and late penalty terms. I authorise Veloxis to proceed with my application on these terms.
                  </label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 6: Review & Submit */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>Review your application before submitting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-border p-4 space-y-2">
              <p className="text-sm font-medium text-foreground mb-2">Name Matching Validation</p>
              <div className="flex items-center gap-2 text-sm">
                {bankNameMatch ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span>Bank account name vs company name</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Buyer name vs invoice buyer</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {exportLicence ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span>Export licence on file</span>
              </div>
              {(!bankNameMatch || !exportLicence) && (
                <p className="text-xs text-destructive mt-2">
                  ⚠️ Please ensure all names match before submitting. Mismatches may cause your application to be rejected.
                </p>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Invoice Number</span><span className="font-medium">{form.invoice_number}</span>
                <span className="text-muted-foreground">Invoice Amount</span><span className="font-medium">{form.invoice_currency} {parseFloat(stripCommas(form.invoice_amount) || '0').toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                <span className="text-muted-foreground">Buyer</span><span className="font-medium">{form.buyer_company_name}</span>
                <span className="text-muted-foreground">Destination</span><span className="font-medium">{form.export_destination}</span>
                <span className="text-muted-foreground">Bank Account</span><span className="font-medium">{form.bank_account_name} ({form.bank_name})</span>
                <span className="text-muted-foreground">Invoice File</span><span className="font-medium">{form.invoice_file?.name ?? (existingInvoicePath ? 'On file' : '—')}</span>
              </div>
            </div>

            {/* FX Risk Acknowledgement */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">FX Risk Acknowledgement</p>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="fx-risk"
                  checked={form.fx_risk_acknowledged}
                  onCheckedChange={(v) => updateField('fx_risk_acknowledged', v === true)}
                />
                <label htmlFor="fx-risk" className="text-xs text-muted-foreground leading-relaxed">
                  I understand that the advance will be paid in {form.invoice_currency} to my domiciliary account. Veloxis bears no responsibility for fluctuations in the NGN exchange rate. I am solely responsible for all costs and risks of converting to NGN, including CBN regulations on domiciliary account usage.
                </label>
              </div>
              {!form.fx_risk_acknowledged && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  You must acknowledge FX risk before submitting
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => s - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
        <div className="flex gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <Button variant="outline" disabled={saving} onClick={() => handleSubmit(true)}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save as Draft
              </Button>
              <Button disabled={saving} onClick={() => handleSubmit(false)}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Submit Application
              </Button>
            </>
          ) : (
            <Button disabled={!canProceed(step)} onClick={() => setStep(s => s + 1)}>
              Next<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
