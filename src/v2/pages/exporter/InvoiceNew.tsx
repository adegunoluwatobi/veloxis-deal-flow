import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { logAudit } from '@/v2/audit';
import { getAdvanceRatePct } from '@/v2/lib/config';
import SubmissionProgress, { type StepState } from '@/v2/components/invoice/SubmissionProgress';
import ExporterInstrumentsPanel from '@/v2/components/invoice/ExporterInstrumentsPanel';
import DocumentUploadRow, { type UploadedDoc } from '@/v2/components/invoice/DocumentUploadRow';
import CompanyAuthorityRow, { useCompanyAuthority } from '@/v2/components/invoice/CompanyAuthorityRow';
import { ChevronDown, Lock } from 'lucide-react';

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const OTHER_LABEL = 'other';
const INSPECTION_CODE = 'clean_certificate_of_inspection';

type DocType = {
  id: string; code: string; label: string; description: string | null;
  stage: number | null; requirement: string; level: string; sort_order: number; active: boolean;
};
type Commodity = { id: string; name: string; category: string };
type DocRequest = {
  id: string; document_type_id: string; reason: string | null; due_date: string | null; status: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function ExporterInvoiceNew() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [exp, setExp] = useState<any>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [myBuyers, setMyBuyers] = useState<{ id: string; company_name: string }[]>([]);
  const [addingBuyer, setAddingBuyer] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ company_name: '', country: '' });
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [regulated, setRegulated] = useState<{ name: string; requires_inspection: boolean }[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [signatories, setSignatories] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [commodityOpen, setCommodityOpen] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warranty, setWarranty] = useState(false);

  const [f, setF] = useState({
    invoice_number: '', buyer_id: '', commodity_id: '', commodity_other: '',
    incoterm: '', bl_number: '', bl_date: '', port_of_loading: '', port_of_discharge: '',
    port_of_loading_other: '', port_of_discharge_other: '',
    estimated_arrival_date: '', invoice_currency: 'GBP', gross_invoice_value: '',
    agreed_deductions: '0', terms_days: '30', signatory_id: '',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  /* ---------------- load reference data ---------------- */
  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: b }, { data: c }, { data: rc }, { data: dt }] = await Promise.all([
        supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).maybeSingle(),
        supabase.from('v2_buyers').select('id, company_name'),
        supabase.from('commodities').select('id, name, category').eq('active', true).order('name'),
        supabase.from('regulated_commodities').select('name, requires_inspection').eq('active', true),
        supabase.from('document_types').select('*').eq('active', true).order('sort_order'),
      ]);
      setExp(e);
      setMyBuyers((b ?? []) as any);
      setCommodities((c ?? []) as any);
      setRegulated((rc ?? []) as any);
      setDocTypes((dt ?? []) as any);
    })();
  }, [user]);

  const refreshInvoiceState = useCallback(async (id: string) => {
    const [{ data: inv }, { data: d }, { data: r }] = await Promise.all([
      supabase.from('v2_invoices').select('*').eq('id', id).maybeSingle(),
      supabase.from('invoice_documents').select('id, document_type_id, original_filename, file_size_bytes, status, uploaded_at, storage_path, scan_status')
        .eq('invoice_id', id).is('superseded_by', null).order('uploaded_at', { ascending: false }),
      supabase.from('invoice_document_requests').select('id, document_type_id, reason, due_date, status')
        .eq('invoice_id', id).eq('status', 'outstanding'),
    ]);
    setInvoice(inv);
    setDocs((d ?? []) as any);
    setRequests((r ?? []) as any);
  }, []);

  /* ---------------- derived values ---------------- */
  const selectedCommodity = commodities.find((c) => c.id === f.commodity_id) ?? null;
  const isOther = (selectedCommodity?.name ?? '').toLowerCase() === OTHER_LABEL;

  const inspectionRequired = useMemo(() => {
    if (invoice?.inspection_required) return true; // staff may have set it already
    if (!selectedCommodity) return false;
    const match = regulated.find((r) => r.name.toLowerCase() === selectedCommodity.name.toLowerCase());
    return !!match?.requires_inspection;
  }, [invoice?.inspection_required, selectedCommodity, regulated]);

  const maturityDate = f.bl_date ? addDays(f.bl_date, Number(f.terms_days)) : null;

  const gross = Number(f.gross_invoice_value || 0);
  const deductions = Number(f.agreed_deductions || 0);
  const exposure = Math.max(0, gross - deductions);

  const authority = useCompanyAuthority(exp?.id ?? null, exposure);

  /* ---------------- signatories for the relied upon resolution ---------------- */
  useEffect(() => {
    (async () => {
      if (!authority.resolutionId) { setSignatories([]); return; }
      const { data } = await supabase.from('authorised_signatories')
        .select('id, full_name, email').eq('board_resolution_id', authority.resolutionId).order('full_name');
      setSignatories((data ?? []) as any);
    })();
  }, [authority.resolutionId]);

  const chosenSignatory = signatories.find((s) => s.id === f.signatory_id) ?? null;
  const signingOnBehalf = !!chosenSignatory
    && !!user?.email
    && (chosenSignatory.email ?? '').toLowerCase() !== user.email.toLowerCase();

  /* ---------------- document type buckets ---------------- */
  const stage1Required = useMemo(() => {
    const base = docTypes.filter((d) => d.stage === 1 && d.level === 'invoice' && d.requirement === 'mandatory');
    const inspection = docTypes.find(
      (d) => d.stage === 1 && d.level === 'invoice' && (d.code === INSPECTION_CODE || /clean certificate of inspection/i.test(d.label)),
    );
    if (inspectionRequired && inspection && !base.some((d) => d.id === inspection.id)) base.push(inspection);
    return base;
  }, [docTypes, inspectionRequired]);

  const optionalTypes = useMemo(
    () => docTypes.filter((d) => d.stage === 1 && d.level === 'invoice' && d.requirement === 'optional'),
    [docTypes],
  );
  // Stage 2: the exporter uploads the certificate of origin only. The three
  // assignment instruments are generated by Veloxis and signed electronically.
  const stage2Types = useMemo(
    () => docTypes.filter((d) => d.stage === 2 && d.requirement === 'mandatory' && !(d as any).generated),
    [docTypes],
  );

  const docsFor = (typeId: string) => docs.filter((d) => d.document_type_id === typeId);
  const typeById = (id: string) => docTypes.find((d) => d.id === id);

  /* ---------------- progress ---------------- */
  const step1Total = stage1Required.length + 1; // + company authority
  const step1Done =
    stage1Required.filter((t) => docsFor(t.id).length > 0).length +
    (!authority.loading && !authority.blockMessage ? 1 : 0);
  const step2Done = stage2Types.filter((t) => docsFor(t.id).length > 0).length;

  const status = invoice?.status ?? null;
  const step2Locked = !['approved', 'funded', 'monitoring', 'settled'].includes(status ?? '');

  const step1State: StepState =
    requests.length > 0 ? 'Action required'
      : status === 'approved' || status === 'funded' || status === 'monitoring' ? 'Approved'
        : status === 'submitted' || status === 'verified' ? 'Submitted'
          : step1Done === 0 ? 'Not started'
            : step1Done === step1Total ? 'Complete' : 'In progress';

  const step2State: StepState =
    step2Locked ? 'Not started'
      : step2Done === 0 ? 'Not started'
        : step2Done === stage2Types.length ? 'Complete' : 'In progress';

  /* ---------------- persistence ---------------- */
  const buildPayload = async (forSubmit: boolean) => {
    let buyerId = f.buyer_id || null;
    if (addingBuyer && newBuyer.company_name) {
      const { data: nb, error: bErr } = await supabase.from('v2_buyers')
        .insert({ company_name: newBuyer.company_name, country: newBuyer.country || null }).select('id').single();
      if (bErr) throw new Error(bErr.message);
      buyerId = nb.id;
      setAddingBuyer(false);
      setF((s) => ({ ...s, buyer_id: nb.id }));
    }
    return {
      invoice_number: f.invoice_number,
      exporter_id: exp.id,
      buyer_id: buyerId,
      commodity_id: f.commodity_id || null,
      commodity: isOther ? f.commodity_other : (selectedCommodity?.name ?? null),
      incoterm: f.incoterm || null,
      bl_number: f.bl_number || null,
      bl_date: f.bl_date || null,
      port_of_loading: f.port_of_loading || null,
      port_of_discharge: f.port_of_discharge || null,
      estimated_arrival_date: f.estimated_arrival_date || null,
      invoice_currency: f.invoice_currency as any,
      gross_invoice_value: gross || null,
      invoice_amount: gross || 0,
      agreed_deductions: deductions,
      terms_days: Number(f.terms_days),
      maturity_date: maturityDate,
      shipment_date: f.bl_date || null,
      inspection_required: inspectionRequired,
      board_resolution_id: forSubmit ? authority.resolutionId : null,
      signatory_id: f.signatory_id || null,
    };
  };

  const saveDraft = async () => {
    if (!exp) return;
    if (!f.invoice_number) { toast({ title: 'Invoice number is required', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const payload = await buildPayload(false);
      if (invoiceId) {
        const { error } = await supabase.from('v2_invoices').update(payload).eq('id', invoiceId);
        if (error) throw new Error(error.message);
      } else {
        const advancePct = await getAdvanceRatePct();
        const { data, error } = await supabase.from('v2_invoices')
          .insert({ ...payload, advance_rate: advancePct, status: 'draft' as any })
          .select('id').single();
        if (error) throw new Error(error.message);
        setInvoiceId(data.id);
        await logAudit({ invoice_id: data.id, action: 'exporter_draft', to_status: 'draft' as any });
      }
      const id = invoiceId ?? (await supabase.from('v2_invoices').select('id').eq('exporter_id', exp.id).order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.id;
      if (id) { setInvoiceId(id); await refreshInvoiceState(id); }
      toast({ title: 'Draft saved', description: 'You can now upload your documents.' });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const missingFields = () => {
    const miss: string[] = [];
    if (!f.invoice_number) miss.push('Invoice number');
    if (!f.commodity_id) miss.push('Commodity');
    if (isOther && !f.commodity_other) miss.push('Commodity description');
    if (!f.incoterm) miss.push('Incoterm');
    if (!f.bl_number) miss.push('Bill of lading number');
    if (!f.bl_date) miss.push('Bill of lading date');
    if (f.bl_date && f.bl_date > today()) miss.push('Bill of lading date cannot be in the future');
    if (!f.port_of_loading) miss.push('Port of loading');
    if (!f.port_of_discharge) miss.push('Port of discharge');
    if (!gross) miss.push('Gross invoice value');
    if (!f.signatory_id) miss.push('Who is signing this submission');
    stage1Required.forEach((t) => { if (docsFor(t.id).length === 0) miss.push(t.label); });
    if (!warranty) miss.push('Warranty confirmation');
    return miss;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exp) return;
    if (authority.blockMessage) {
      toast({ title: 'Submission blocked', description: authority.blockMessage, variant: 'destructive' });
      return;
    }
    const miss = missingFields();
    if (miss.length) {
      toast({ title: 'Please complete your submission', description: miss.join(', '), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const payload = await buildPayload(true);
      let id = invoiceId;
      if (!id) {
        const advancePct = await getAdvanceRatePct();
        const { data, error } = await supabase.from('v2_invoices')
          .insert({ ...payload, advance_rate: advancePct, status: 'draft' as any }).select('id').single();
        if (error) throw new Error(error.message);
        id = data.id;
        setInvoiceId(id);
      }
      const { error: upErr } = await supabase.from('v2_invoices').update({
        ...payload,
        status: 'submitted' as any,
        submitted_by: user!.id,
        warranties_accepted_at: new Date().toISOString(),
        warranties_accepted_by: user!.id,
      }).eq('id', id!);
      if (upErr) throw new Error(upErr.message); // FX trigger messages surface verbatim
      await logAudit({ invoice_id: id!, action: 'exporter_submitted', to_status: 'submitted' as any });
      nav(`/portal/invoices/${id}`);
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (exp === null) return <div className="text-muted-foreground">Loading…</div>;
  if (!exp) return <div className="card-elevated p-6 text-sm">Your exporter profile is not set up yet. Please contact Veloxis.</div>;

  const uploadsDisabled = invoiceId ? null : 'Save your invoice details first to start uploading';
  const optionalCommercial = optionalTypes.filter((d) => /commercial/i.test(d.code) || d.sort_order < 500);
  const optionalCompliance = optionalTypes.filter((d) => !optionalCommercial.includes(d));

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <SubmissionProgress
        step1={{ state: step1State, done: step1Done, total: step1Total }}
        step2={{ state: step2State, done: step2Done, total: stage2Types.length, locked: step2Locked }}
        requestedCount={requests.length}
        decisionDueAt={invoice?.decision_due_at}
        clockPaused={!!invoice?.sla_paused_at}
      />

      <h1 className="text-2xl">Submit invoice</h1>

      <form className="space-y-6" onSubmit={submit}>
        {/* ---------------- invoice fields ---------------- */}
        <section className="card-elevated space-y-4 p-6">
          <h2 className="text-lg">Invoice and shipment</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Invoice number *</Label>
              <Input value={f.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <Label>Buyer</Label>
                <button type="button" onClick={() => setAddingBuyer((s) => !s)} className="text-xs text-accent">
                  {addingBuyer ? 'Choose existing' : 'Add new'}
                </button>
              </div>
              {addingBuyer ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Company name" value={newBuyer.company_name} onChange={(e) => setNewBuyer({ ...newBuyer, company_name: e.target.value })} />
                  <Input placeholder="Country" value={newBuyer.country} onChange={(e) => setNewBuyer({ ...newBuyer, country: e.target.value })} />
                </div>
              ) : (
                <Select value={f.buyer_id} onValueChange={(v) => set('buyer_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{myBuyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.company_name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Commodity *</Label>
              <Popover open={commodityOpen} onOpenChange={setCommodityOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    {selectedCommodity?.name ?? 'Search commodities'}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search commodities…" />
                    <CommandList>
                      <CommandEmpty>No commodity found.</CommandEmpty>
                      <CommandGroup>
                        {commodities.map((c) => (
                          <CommandItem key={c.id} value={c.name} onSelect={() => { set('commodity_id', c.id); setCommodityOpen(false); }}>
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Incoterm *</Label>
              <Select value={f.incoterm} onValueChange={(v) => set('incoterm', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{INCOTERMS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {isOther && (
              <div className="sm:col-span-2">
                <Label>Describe the commodity *</Label>
                <Input value={f.commodity_other} onChange={(e) => set('commodity_other', e.target.value)} />
              </div>
            )}

            <div>
              <Label>Bill of lading number *</Label>
              <Input value={f.bl_number} onChange={(e) => set('bl_number', e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Bill of lading or air waybill number</p>
            </div>
            <div>
              <Label>Bill of lading date *</Label>
              <Input type="date" max={today()} value={f.bl_date} onChange={(e) => set('bl_date', e.target.value)} />
            </div>

            <div><Label>Port of loading *</Label><Input value={f.port_of_loading} onChange={(e) => set('port_of_loading', e.target.value)} /></div>
            <div><Label>Port of discharge *</Label><Input value={f.port_of_discharge} onChange={(e) => set('port_of_discharge', e.target.value)} /></div>
            <div><Label>Estimated arrival date</Label><Input type="date" value={f.estimated_arrival_date} onChange={(e) => set('estimated_arrival_date', e.target.value)} /></div>

            <div>
              <Label>Currency</Label>
              <Select value={f.invoice_currency} onValueChange={(v) => set('invoice_currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['GBP', 'USD', 'EUR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>Gross invoice value *</Label>
              <Input type="number" step="0.01" value={f.gross_invoice_value} onChange={(e) => set('gross_invoice_value', e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Full face value of the invoice before any deductions</p>
            </div>
            <div>
              <Label>Agreed deductions</Label>
              <Input type="number" step="0.01" value={f.agreed_deductions} onChange={(e) => set('agreed_deductions', e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Any retention, discount or deduction agreed with the buyer</p>
            </div>

            <div>
              <Label>Payment terms</Label>
              <Select value={f.terms_days} onValueChange={(v) => set('terms_days', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['30', '45', '60'].map((c) => <SelectItem key={c} value={c}>{c} days</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expected payment date</Label>
              <Input readOnly value={maturityDate ?? '—'} className="bg-muted/50" />
              <p className="mt-1 text-xs text-muted-foreground">Bill of lading date plus your payment terms</p>
            </div>
          </div>
        </section>

        {/* ---------------- stage 1 uploads ---------------- */}
        <section className="card-elevated space-y-4 p-6">
          <div>
            <h2 className="text-lg">Step 1 · Submission documents</h2>
            {uploadsDisabled && <p className="mt-1 text-xs text-muted-foreground">{uploadsDisabled}.</p>}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Required documents</h3>
            <CompanyAuthorityRow state={authority} />
            {stage1Required.map((t) => (
              <DocumentUploadRow
                key={t.id}
                label={t.label}
                description={t.description}
                note={
                  (t.code === INSPECTION_CODE || /clean certificate of inspection/i.test(t.label)) && inspectionRequired && selectedCommodity
                    ? `Required because ${selectedCommodity.name} is a regulated commodity.`
                    : null
                }
                documentTypeId={t.id}
                invoiceId={invoiceId}
                exporterId={exp.id}
                docs={docsFor(t.id)}
                required
                disabledReason={uploadsDisabled}
                onUploaded={() => invoiceId && refreshInvoiceState(invoiceId)}
              />
            ))}
          </div>

          {requests.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-amber-600">Requested by Veloxis</h3>
              {requests.map((r) => {
                const t = typeById(r.document_type_id);
                return (
                  <DocumentUploadRow
                    key={r.id}
                    label={t?.label ?? 'Requested document'}
                    description={t?.description}
                    note={[r.reason, r.due_date ? `Due by ${new Date(r.due_date).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
                    documentTypeId={r.document_type_id}
                    invoiceId={invoiceId}
                    exporterId={exp.id}
                    docs={docsFor(r.document_type_id)}
                    required
                    accent="amber"
                    disabledReason={uploadsDisabled}
                    onUploaded={() => invoiceId && refreshInvoiceState(invoiceId)}
                  />
                );
              })}
            </div>
          )}

          <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between px-0 text-sm">
                Optional documents. These are not required, but a stronger file moves faster.
                <ChevronDown className={`h-4 w-4 transition-transform ${optionalOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              {[['Commercial', optionalCommercial], ['Compliance', optionalCompliance]].map(([heading, list]) => {
                const items = list as DocType[];
                if (!items.length) return null;
                return (
                  <div key={heading as string} className="space-y-3">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground">{heading as string}</h4>
                    {items.map((t) => (
                      <DocumentUploadRow
                        key={t.id}
                        label={t.label}
                        description={t.description}
                        documentTypeId={t.id}
                        invoiceId={invoiceId}
                        exporterId={exp.id}
                        docs={docsFor(t.id)}
                        disabledReason={uploadsDisabled}
                        onUploaded={() => invoiceId && refreshInvoiceState(invoiceId)}
                      />
                    ))}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        </section>

        {/* ---------------- stage 2 preview ---------------- */}
        <section className={`card-elevated space-y-3 p-6 ${step2Locked ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-2">
            {step2Locked && <Lock className="h-4 w-4 text-muted-foreground" />}
            <h2 className="text-lg">Step 2 · Pre funding documents</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {step2Locked ? 'Unlocks once your submission is approved. Here is what you can prepare now.' : 'Upload your certificate of origin. We handle the rest.'}
          </p>
          <p className="text-sm text-muted-foreground">
            We prepare these documents for you. You will be asked to sign them electronically.
          </p>
          <ExporterInstrumentsPanel invoiceId={invoiceId ?? undefined} />
          {stage2Types.map((t) => (
            <DocumentUploadRow
              key={t.id}
              label={t.label}
              description={t.description}
              documentTypeId={t.id}
              invoiceId={invoiceId}
              exporterId={exp.id}
              docs={docsFor(t.id)}
              required
              readOnly={step2Locked}
              disabledReason={uploadsDisabled}
              onUploaded={() => invoiceId && refreshInvoiceState(invoiceId)}
            />
          ))}
        </section>

        {/* ---------------- signatory and warranty ---------------- */}
        <section className="card-elevated space-y-4 p-6">
          <div>
            <Label>Who is signing this submission *</Label>
            <Select value={f.signatory_id} onValueChange={(v) => set('signatory_id', v)}>
              <SelectTrigger><SelectValue placeholder={signatories.length ? 'Select a named signatory' : 'No authorised signatories on file'} /></SelectTrigger>
              <SelectContent>
                {signatories.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.email ?? 'Signatory'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {signingOnBehalf && (
              <p className="mt-1 text-xs text-muted-foreground">
                You are submitting on behalf of {chosenSignatory?.full_name ?? chosenSignatory?.email}. Veloxis may contact them to confirm.
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={warranty} onCheckedChange={(v) => setWarranty(!!v)} className="mt-0.5" />
            <span className="text-muted-foreground">
              I confirm the goods have shipped, the invoice is genuine and unencumbered, the documents uploaded are true copies,
              and the named signatory is authorised to submit this invoice.
            </span>
          </label>

          {authority.blockMessage && (
            <p className="text-sm text-destructive">{authority.blockMessage}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" onClick={saveDraft} disabled={busy}>Save draft</Button>
            <Button type="submit" disabled={busy || !!authority.blockMessage}>Submit for review</Button>
          </div>
        </section>
      </form>
    </div>
  );
}
