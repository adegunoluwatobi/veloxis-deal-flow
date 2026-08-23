import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { OptionSelect, ID_TYPES, COUNTRIES, NATIONALITIES, INDUSTRIES, NIGERIAN_BANKS } from '@/v2/lib/formOptions';
import { CheckCircle2, Upload, Clock, AlertCircle, Lock, FileDown, Printer } from 'lucide-react';
import AdditionalDirectors from '@/v2/components/AdditionalDirectors';
import SignOutButton from '@/v2/components/SignOutButton';
import NotificationBell from '@/v2/components/NotificationBell';
import { openBoardResolutionTemplate, downloadBoardResolutionPdf } from '@/v2/lib/boardResolutionTemplate';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';


type DocType = string;

const REQUIRED_DOCS: { key: DocType; label: string; hint: string; optional?: boolean }[] = [
  { key: 'cac_certificate', label: 'CAC certificate of incorporation', hint: 'Certificate of Incorporation showing your RC number.' },
  { key: 'cac_status_report', label: 'CAC status report', hint: 'Current status report listing directors and shareholding.' },
  { key: 'tin_certificate', label: 'Tax identification number', hint: 'TIN certificate issued by FIRS. A clear screenshot of your TIN record on the FIRS site is acceptable.' },
  { key: 'nepc_certificate', label: 'NEPC exporter registration', hint: 'Your Nigerian Export Promotion Council registration.' },
  { key: 'bank_statement', label: 'Six month bank statement', hint: 'Statements for the corporate account funds will settle to.' },
  { key: 'board_resolution', label: 'Board resolution authorising the facility', hint: 'Board resolution naming the authorised signatories (no monetary limit required). Valid for 1 year. You can upload this later, but no invoice can be created until it is uploaded and approved.', optional: true },
  { key: 'director_id', label: 'Director government ID', hint: 'Upload a clear image of the international passport, driver’s licence or voter’s card — must match the ID type and number entered above. Not required if you provided a National ID (NIN).' },
  { key: 'proof_of_address', label: 'Director proof of address', hint: 'Utility bill or bank statement, dated within 3 months.' },
];


export default function ExporterOnboarding() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [exp, setExp] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [typeIds, setTypeIds] = useState<Record<string, string>>({});
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [submittedOpen, setSubmittedOpen] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [uploadingName, setUploadingName] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<Record<string, { file: File; message: string }>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);



  const load = useCallback(async () => {
    const { data: rows } = await supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).order('created_at', { ascending: true }).limit(1);
    const e = rows?.[0] ?? null;
    setExp(e);
    setF(e ?? {
      company_name: '', company_registration_number: '', country_of_incorporation: '', incorporation_date: '',
      tax_id: '', industry: '', commodity: '', phone: '', email: profile?.email ?? '', address: '',
      director_name: '', director_email: '', director_phone: '', director_dob: '', director_nationality: '',
      director_id_type: '', director_id_number: '', director_address: '',
      bank_details: { bank_name: '', account_name: '', account_number: '', swift: '' },
    });

    const { data: dt } = await supabase.from('document_types')
      .select('id, code').in('code', REQUIRED_DOCS.map((r) => r.key));
    const map: Record<string, string> = {};
    (dt ?? []).forEach((t: any) => { map[t.code] = t.id; });
    setTypeIds(map);

    if (e?.id) {
      const { data: d } = await supabase.from('company_documents')
        .select('id, document_type_id, original_filename, status, uploaded_at, rejection_reason')
        .eq('exporter_id', e.id).order('uploaded_at', { ascending: false });
      setDocs(d ?? []);
    }
  }, [user, profile]);

  useEffect(() => { load(); }, [load]);

  if (!f) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <span>Loading…</span>
      <SignOutButton />
    </div>
  );

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const setBank = (k: string, v: string) => setF((x: any) => ({ ...x, bank_details: { ...(x.bank_details ?? {}), [k]: v } }));
  const blur = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const latestDoc = (t: DocType) => docs.find((d) => d.document_type_id === typeIds[t]);
  // A NIN is verified electronically, so no ID image is required for it.
  const idImageRequired = String(f.director_id_type ?? '') !== 'National ID (NIN)';
  const docRequired = (key: DocType) => {
    const spec = REQUIRED_DOCS.find((r) => r.key === key);
    if (spec?.optional) return false;
    if (key === 'director_id') return idImageRequired;
    return true;
  };
  const missingDocs = REQUIRED_DOCS.filter((r) => docRequired(r.key) && !latestDoc(r.key));

  const errors: Record<string, string> = (() => {
    const e: Record<string, string> = {};
    const s = (v: any) => String(v ?? '').trim();
    const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    const phoneOk = (v: string) => /^\+?[0-9][0-9\s().-]{6,19}$/.test(v);

    if (!s(f.company_name)) e.company_name = 'Company name is required.';
    else if (s(f.company_name).length < 2) e.company_name = 'Enter the full registered company name.';

    if (!s(f.company_registration_number)) e.company_registration_number = 'Registration number is required.';
    else if (!/^[A-Za-z0-9/-]{4,20}$/.test(s(f.company_registration_number)))
      e.company_registration_number = 'Enter a valid RC / CAC number (letters and numbers, 4–20 characters).';

    if (!s(f.country_of_incorporation)) e.country_of_incorporation = 'Select the country of incorporation.';

    if (s(f.incorporation_date) && new Date(s(f.incorporation_date)) > new Date())
      e.incorporation_date = 'Incorporation date cannot be in the future.';

    if (s(f.tax_id) && !/^[A-Za-z0-9-]{6,20}$/.test(s(f.tax_id)))
      e.tax_id = 'Enter a valid TIN (6–20 characters, letters or numbers).';

    if (!s(f.phone)) e.phone = 'Company phone is required.';
    else if (!phoneOk(s(f.phone))) e.phone = 'Enter a valid phone number, e.g. +234 801 234 5678.';
    if (!s(f.address)) e.address = 'Registered address is required.';

    if (!s(f.director_name)) e.director_name = 'Director full name is required.';
    else if (!s(f.director_name).includes(' ')) e.director_name = 'Enter the director’s first and last name.';

    if (s(f.director_email) && !emailOk(s(f.director_email))) e.director_email = 'Please enter a valid email address.';
    if (s(f.director_phone) && !phoneOk(s(f.director_phone))) e.director_phone = 'Enter a valid phone number.';

    if (s(f.director_dob)) {
      const dob = new Date(s(f.director_dob));
      const age = (Date.now() - dob.getTime()) / 31557600000;
      if (age < 18) e.director_dob = 'The director must be at least 18 years old.';
      else if (age > 100) e.director_dob = 'Please check the date of birth.';
    }

    if (!s(f.director_id_type)) e.director_id_type = 'Select the ID type.';
    if (!s(f.director_id_number)) e.director_id_number = 'ID number is required.';
    else if (!/^[A-Za-z0-9-]{5,20}$/.test(s(f.director_id_number)))
      e.director_id_number = 'Enter the ID number exactly as printed (5–20 characters).';

    if (!s(f.bank_details?.bank_name)) e.bank_name = 'Select your bank.';
    const acct = s(f.bank_details?.account_number);
    if (!acct) e.account_number = 'Account number is required.';
    else if (!/^[A-Za-z0-9]{8,34}$/.test(acct)) e.account_number = 'Enter a valid account number or IBAN (8–34 characters).';
    else if (/^\d+$/.test(acct) && acct.length !== 10) e.account_number = 'A Nigerian account number (NUBAN) is 10 digits.';

    const swift = s(f.bank_details?.swift);
    if (swift && !/^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/.test(swift))
      e.swift = 'A SWIFT / BIC code is 8 or 11 characters, e.g. ABCDNGLA.';

    return e;
  })();

  const errorFor = (k: string) => ((showAllErrors || touched[k]) ? errors[k] : undefined);
  const requiredFieldsOk = Object.keys(errors).length === 0;

  // Board resolution template needs these before it is worth generating.
  const templateMissing = [
    !String(f.company_name ?? '').trim() && 'company name',
    !String(f.company_registration_number ?? '').trim() && 'registration number',
    !String(f.address ?? '').trim() && 'registered address',
    !String(f.director_name ?? '').trim() && 'director full name',
  ].filter(Boolean) as string[];

  const templateInput = () => ({
    companyName: f.company_name,
    registrationNumber: f.company_registration_number,
    registeredAddress: f.address,
    companyEmail: f.email ?? profile?.email,
    signatories: [
      { name: f.director_name, designation: 'Director', email: f.director_email ?? f.email ?? profile?.email },
      {},
    ],
  });

  const templateReady = () => {
    if (templateMissing.length === 0) return true;
    setShowAllErrors(true);
    toast({
      title: 'Complete your details first',
      description: `The template needs your ${templateMissing.join(', ')}.`,
      variant: 'destructive',
    });
    return false;
  };




  const saveProfile = async (): Promise<string | null> => {
    const payload: any = {
      company_name: f.company_name, rc_number: f.company_registration_number || null,
      company_registration_number: f.company_registration_number || null,
      country_of_incorporation: f.country_of_incorporation || null,
      incorporation_date: f.incorporation_date || null,
      tax_id: f.tax_id || null, industry: f.industry || null,
      commodity: f.commodity || null, phone: f.phone || null, email: f.email || profile?.email || null,
      address: f.address || null,
      director_name: f.director_name || null, director_email: f.director_email || null,
      director_phone: f.director_phone || null, director_dob: f.director_dob || null,
      director_nationality: f.director_nationality || null,
      director_id_type: f.director_id_type || null, director_id_number: f.director_id_number || null,
      director_address: f.director_address || null,
      bank_details: { ...(f.bank_details ?? {}), account_name: f.company_name ?? '' },
    };
    if (exp?.id) {
      const { error } = await supabase.from('v2_exporters').update(payload).eq('id', exp.id);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return null; }
      return exp.id;
    }
    const { data, error } = await supabase.from('v2_exporters').insert({
      owner_user_id: user!.id, ...payload,
      onboarding_status: 'pending', kyb_status: 'pending', kyc_status: 'pending',
    }).select('id').single();
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return null; }
    setExp((prev: any) => prev ?? { id: data.id });
    return data.id;
  };

  const uploadWithProgress = (path: string, file: File, token: string, onProgress: (pct: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/veloxis-documents/${path}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.message ?? msg; } catch { /* ignore */ }
        reject(new Error(msg));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });

  const runUpload = async (file: File, doc_type: DocType) => {
    setBusy(true);
    setUploadError((x) => { const n = { ...x }; delete n[doc_type]; return n; });
    setProgress((p) => ({ ...p, [doc_type]: 0 }));
    setUploadingName((n) => ({ ...n, [doc_type]: file.name }));
    try {
      const expId = await saveProfile();
      if (!expId) throw new Error('Could not save your company details. Check the required fields and try again.');

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Session expired — please sign in again.');
      const path = `${expId}/company/onboarding/${doc_type}-${Date.now()}-${file.name.replace(/[^a-z0-9._-]+/gi, '_')}`;
      await uploadWithProgress(path, file, token, (pct) => setProgress((p) => ({ ...p, [doc_type]: pct })));
      const typeId = typeIds[doc_type];
      if (!typeId) throw new Error('This document type is not configured. Please contact Veloxis.');
      const { data: inserted, error: insErr } = await supabase.from('company_documents').insert({
        exporter_id: expId,
        document_type_id: typeId,
        storage_path: path,
        original_filename: file.name,
        file_size_bytes: file.size,
        uploaded_by: user!.id,
      }).select('id').single();
      if (insErr) throw new Error(insErr.message);
      const { data: scan } = await supabase.functions.invoke('scan-document', {
        body: { document_id: inserted.id, document_kind: 'company' },
      });
      if ((scan as any)?.scan_status && (scan as any).scan_status !== 'clean') {
        throw new Error((scan as any).message ?? 'This file could not be accepted.');
      }

      await load();
      toast({ title: 'Uploaded', description: file.name });
    } catch (err: any) {
      setUploadError((x) => ({ ...x, [doc_type]: { file, message: err?.message ?? 'Upload failed. Please try again.' } }));
      toast({ title: 'Upload failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      setProgress((p) => { const n = { ...p }; delete n[doc_type]; return n; });
      setUploadingName((n) => { const x = { ...n }; delete x[doc_type]; return x; });
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>, doc_type: DocType) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    await runUpload(file, doc_type);
  };


  const submitForReview = async () => {
    if (!requiredFieldsOk) {
      setShowAllErrors(true);
      toast({
        title: 'Please fix the highlighted fields',
        description: `${Object.keys(errors).length} field${Object.keys(errors).length === 1 ? '' : 's'} need attention.`,
        variant: 'destructive',
      });
      document.getElementById('onboarding-error-summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (missingDocs.length) {
      setShowAllErrors(true);
      toast({
        title: 'Upload all required documents first',
        description: `Still needed: ${missingDocs.map((d) => d.label).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setBusy(true);
    const expId = await saveProfile();
    if (!expId) { setBusy(false); return; }
    const { error } = await supabase.from('v2_exporters').update({
      onboarding_status: 'pending', kyb_status: 'pending', kyc_status: 'pending',
      onboarding_submitted_at: new Date().toISOString(),
    }).eq('id', expId);
    setBusy(false);
    if (error) return toast({ title: 'Submit failed', description: error.message, variant: 'destructive' });
    setSubmittedOpen(true);
    load();
  };


  const status = exp?.onboarding_status ?? 'pending';
  const submitted = !!exp?.onboarding_submitted_at;
  const bdApproved = !!exp?.bd_approved_at;
  const bdRejected = !!exp?.bd_rejected_at;
  const isActive = status === 'active';
  const formLocked = isActive || (submitted && !bdRejected);


  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card">
        <div className="max-w-4xl mx-auto h-full flex items-center gap-4 px-6">
          <span className="wordmark text-accent">VELOXIS</span>
          <span className="ml-auto text-xs text-muted-foreground truncate">{profile?.email}</span>
          <NotificationBell />
          <SignOutButton />

        </div>
      </header>
      <main className="max-w-4xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl">Complete your onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Before you can raise invoices, we need to verify your company (KYB) and director (KYC). Your Business Developer reviews first, then Credit &amp; Compliance gives final approval.
          </p>
        </div>

        {isActive && (
          <div className="card-elevated p-4 border-primary/40 bg-primary/10 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-accent">You’re approved</div>
              <div className="text-muted-foreground">You can now use the exporter portal.</div>
              <Button size="sm" className="mt-3" onClick={() => nav('/portal', { replace: true })}>Go to dashboard</Button>
            </div>
          </div>
        )}

        {!isActive && submitted && !bdRejected && (
          <div className="card-elevated p-4 border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-amber-400">
                {bdApproved ? 'Awaiting Credit & Compliance approval' : 'Awaiting Business Developer review'}
              </div>
              <div className="text-muted-foreground">
                Your application has been submitted and your details are now locked. You won’t have access to the exporter portal until it is approved or rejected. We’ll notify you by email once a decision is made.
              </div>
            </div>
          </div>
        )}

        {bdRejected && (
          <div className="card-elevated p-4 border-destructive/60 bg-destructive/10 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-destructive">Additional information required</div>
              <div className="mt-1">{exp?.bd_rejection_reason || 'Your Business Developer requested changes.'}</div>
              <div className="text-muted-foreground mt-1">Update your details and re-submit.</div>
            </div>
          </div>
        )}

        {showAllErrors && Object.keys(errors).length > 0 && (
          <div id="onboarding-error-summary" className="card-elevated p-4 border-destructive/60 bg-destructive/10">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-destructive">
                  {Object.keys(errors).length} field{Object.keys(errors).length === 1 ? '' : 's'} need attention
                </div>
                <ul className="mt-1.5 space-y-0.5 text-muted-foreground list-disc pl-4">
                  {Object.entries(errors).map(([k, v]) => (
                    <li key={k}><span className="text-foreground">{FIELD_LABELS[k] ?? k}</span> — {v}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {formLocked && (
          <div className="card-elevated p-6 text-sm text-muted-foreground">
            Your submitted details are locked while they are under review. If anything needs changing, your reviewer will
            request it and this form will re-open.
          </div>
        )}

        {!formLocked && (
        <>
        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">1 · Company (KYB)</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company name *" error={errorFor('company_name')}><Input value={f.company_name ?? ''} onBlur={() => blur('company_name')} onChange={(e) => set('company_name', e.target.value)} /></Field>
            <Field label="Registration number (RC / CAC) *" error={errorFor('company_registration_number')}><Input value={f.company_registration_number ?? ''} onBlur={() => blur('company_registration_number')} onChange={(e) => set('company_registration_number', e.target.value)} /></Field>
            <Field label="Country of incorporation *" error={errorFor('country_of_incorporation')}><OptionSelect value={f.country_of_incorporation} onChange={(v) => { set('country_of_incorporation', v); blur('country_of_incorporation'); }} options={COUNTRIES} placeholder="Select country" /></Field>
            <Field label="Incorporation date" error={errorFor('incorporation_date')}><Input type="date" value={f.incorporation_date ?? ''} onBlur={() => blur('incorporation_date')} onChange={(e) => set('incorporation_date', e.target.value)} /></Field>
            <Field label="Tax ID / TIN" error={errorFor('tax_id')}><Input value={f.tax_id ?? ''} onBlur={() => blur('tax_id')} onChange={(e) => set('tax_id', e.target.value)} /></Field>
            <Field label="Industry"><OptionSelect value={f.industry} onChange={(v) => set('industry', v)} options={INDUSTRIES} placeholder="Select industry" /></Field>
            <Field label="Primary commodity"><Input value={f.commodity ?? ''} onChange={(e) => set('commodity', e.target.value)} /></Field>
            <Field label="Company phone *" error={errorFor('phone')}><Input value={f.phone ?? ''} onBlur={() => blur('phone')} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Company email">
              <Input value={f.email ?? profile?.email ?? ''} readOnly disabled className="opacity-70 cursor-not-allowed" />
            </Field>
            <div className="col-span-2"><Field label="Registered address *" error={errorFor('address')}><Input value={f.address ?? ''} onBlur={() => blur('address')} onChange={(e) => set('address', e.target.value)} /></Field></div>
          </div>
        </section>

        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">2 · Director (KYC)</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Director full name *" error={errorFor('director_name')}><Input value={f.director_name ?? ''} onBlur={() => blur('director_name')} onChange={(e) => set('director_name', e.target.value)} /></Field>
            <Field label="Director email" error={errorFor('director_email')}><Input type="email" value={f.director_email ?? ''} onBlur={() => blur('director_email')} onChange={(e) => set('director_email', e.target.value)} /></Field>
            <Field label="Director phone" error={errorFor('director_phone')}><Input value={f.director_phone ?? ''} onBlur={() => blur('director_phone')} onChange={(e) => set('director_phone', e.target.value)} /></Field>
            <Field label="Date of birth" error={errorFor('director_dob')}><Input type="date" value={f.director_dob ?? ''} onBlur={() => blur('director_dob')} onChange={(e) => set('director_dob', e.target.value)} /></Field>
            <Field label="Nationality"><OptionSelect value={f.director_nationality} onChange={(v) => set('director_nationality', v)} options={NATIONALITIES} placeholder="Select nationality" /></Field>
            <Field label="ID type *" error={errorFor('director_id_type')}><OptionSelect value={f.director_id_type} onChange={(v) => { set('director_id_type', v); blur('director_id_type'); }} options={ID_TYPES} placeholder="Select ID type" /></Field>
            <Field label="ID number *" error={errorFor('director_id_number')}><Input value={f.director_id_number ?? ''} onBlur={() => blur('director_id_number')} onChange={(e) => set('director_id_number', e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Director residential address"><Input value={f.director_address ?? ''} onChange={(e) => set('director_address', e.target.value)} /></Field></div>
            <div className="col-span-2 space-y-1.5 border-t border-border pt-3">
              <div className="text-sm font-medium">
                Director government ID {idImageRequired ? <span className="text-destructive">*</span> : <span className="ml-1 text-xs font-normal text-muted-foreground">(not required for National ID / NIN)</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a clear image of the {f.director_id_type || 'selected ID'} — it must match the ID type and number above.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className={`text-xs px-3 py-2 border border-border rounded inline-flex items-center gap-2 ${busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-muted/20'}`}>
                  <Upload className="h-3.5 w-3.5" />
                  {progress['director_id'] !== undefined ? `Uploading… ${progress['director_id']}%` : latestDoc('director_id') ? 'Replace ID' : 'Upload ID'}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => upload(e, 'director_id')} disabled={busy} />
                </label>
                {latestDoc('director_id') && progress['director_id'] === undefined && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-accent">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[16rem]">{latestDoc('director_id')?.original_filename || 'Uploaded'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

        </section>

        <AdditionalDirectors exporterId={exp?.id} ensureExporterId={saveProfile} />


        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">3 · Bank details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank name *" error={errorFor('bank_name')}><OptionSelect value={f.bank_details?.bank_name} onChange={(v) => { setBank('bank_name', v); blur('bank_name'); }} options={NIGERIAN_BANKS} placeholder="Select bank" /></Field>
            <Field label="Account name (must match company name)">
              <Input value={f.company_name ?? ''} readOnly disabled className="opacity-70 cursor-not-allowed" />
            </Field>

            <Field label="Account number / IBAN *" error={errorFor('account_number')}><Input value={f.bank_details?.account_number ?? ''} onBlur={() => blur('account_number')} onChange={(e) => setBank('account_number', e.target.value)} /></Field>
            <Field label="SWIFT / BIC" error={errorFor('swift')}><Input value={f.bank_details?.swift ?? ''} onBlur={() => blur('swift')} onChange={(e) => setBank('swift', e.target.value)} /></Field>
          </div>
        </section>


        <section className="card-elevated p-6 space-y-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">4 · Upload documents</h2>
          <p className="text-xs text-muted-foreground">PDF, JPG or PNG. Uploading a new file replaces the previous version for that document.</p>
          <div className="space-y-3">
            {REQUIRED_DOCS.map((r) => {
              const d = latestDoc(r.key);
              const pct = progress[r.key];
              const uploading = pct !== undefined;
              const err = uploadError[r.key];
              return (
                <div key={r.key} className="flex items-start justify-between gap-4 border-t border-border pt-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {r.label}
                      {!docRequired(r.key) && <span className="ml-2 text-xs font-normal text-muted-foreground">(can be uploaded later)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.hint}</div>
                    {r.key === 'director_id' && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Recorded above: {f.director_id_type || 'no ID type selected'}
                        {f.director_id_number ? ` · ${f.director_id_number}` : ' · no ID number entered'}
                      </div>
                    )}
                    {r.key === 'board_resolution' && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={pdfBusy}
                            onClick={() => {
                              if (!templateReady()) return;
                              const ok = openBoardResolutionTemplate(templateInput());
                              if (!ok) toast({ title: 'Allow pop-ups to print the template', variant: 'destructive' });
                            }}>
                            <Printer className="h-3.5 w-3.5 mr-1" /> Print template
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={pdfBusy}
                            onClick={async () => {
                              if (!templateReady()) return;
                              setPdfBusy(true);
                              try {
                                await downloadBoardResolutionPdf(templateInput());
                              } catch (e: any) {
                                toast({ title: 'Could not create the PDF', description: e?.message, variant: 'destructive' });
                              } finally { setPdfBusy(false); }
                            }}>
                            <FileDown className="h-3.5 w-3.5 mr-1" /> {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
                          </Button>
                        </div>
                        {templateMissing.length > 0 && (
                          <div className="text-xs text-destructive">
                            Complete {templateMissing.join(', ')} above to generate the template.
                          </div>
                        )}
                      </div>
                    )}

                    {d && !uploading && !err && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded bg-primary/15 text-accent">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[16rem]" title={d.original_filename || 'Uploaded'}>{d.original_filename || 'Uploaded'}</span>
                        </span>
                        {d.uploaded_at && (
                          <span className="text-muted-foreground">
                            Uploaded {new Date(d.uploaded_at).toLocaleDateString()}
                          </span>
                        )}
                        {d.status === 'verified' && <span className="px-2 py-0.5 rounded bg-primary/20 text-accent">Verified</span>}
                        {d.status === 'rejected' && <span className="px-2 py-0.5 rounded bg-destructive/20 text-destructive">Rejected</span>}
                        {d.status === 'pending' && <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">Awaiting review</span>}
                        {d.status === 'rejected' && (
                          <div className="w-full mt-1 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
                            <div className="font-medium text-destructive">Rejected by Credit &amp; Compliance</div>
                            <div className="mt-0.5">{d.rejection_reason || 'No reason was recorded.'}</div>
                            <div className="text-muted-foreground mt-0.5">Please upload a corrected document.</div>
                          </div>
                        )}
                      </div>
                    )}
                    {uploading && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-muted-foreground truncate" title={uploadingName[r.key]}>
                          Uploading {uploadingName[r.key]}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted/40 overflow-hidden">
                            <div className="h-full bg-accent transition-all duration-200" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
                        </div>
                      </div>
                    )}
                    {err && !uploading && (
                      <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 space-y-2">
                        <div className="flex items-start gap-2 text-xs">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-medium truncate" title={err.file.name}>{err.file.name}</div>
                            <div className="text-muted-foreground">Upload failed — {err.message}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => runUpload(err.file, r.key)}>
                            Retry upload
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy}
                            onClick={() => setUploadError((x) => { const n = { ...x }; delete n[r.key]; return n; })}>
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className={`text-xs px-3 py-2 border border-border rounded inline-flex items-center gap-2 ${busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-muted/20'}`}>
                    <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : d ? 'Replace' : 'Upload'}
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => upload(e, r.key)} disabled={busy} />
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={async () => { const id = await saveProfile(); if (id) toast({ title: 'Saved' }); }} disabled={busy}>
            Save progress
          </Button>
          <Button onClick={submitForReview} disabled={busy}>Submit for review</Button>
        </div>
        </>
        )}

      </main>

      <Dialog open={submittedOpen} onOpenChange={setSubmittedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-accent">
              <CheckCircle2 className="h-5 w-5" />
              <DialogTitle>Application submitted</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Thanks — your onboarding has been submitted for review. Your Business Developer reviews first, then Credit &amp; Compliance gives final approval.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <Lock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-muted-foreground">
              You will <span className="text-amber-400 font-medium">not have access to the exporter portal</span> until your application is approved or rejected. We’ll email you as soon as there’s a decision.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSubmittedOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  company_name: 'Company name',
  company_registration_number: 'Registration number (RC / CAC)',
  country_of_incorporation: 'Country of incorporation',
  incorporation_date: 'Incorporation date',
  tax_id: 'Tax ID / TIN',
  phone: 'Company phone',
  address: 'Registered address',
  director_name: 'Director full name',
  director_email: 'Director email',
  director_phone: 'Director phone',
  director_dob: 'Date of birth',
  director_id_type: 'ID type',
  director_id_number: 'ID number',
  bank_name: 'Bank name',
  account_number: 'Account number / IBAN',
  swift: 'SWIFT / BIC',
};

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className={`space-y-1 ${error ? '[&_input]:border-destructive [&_button]:border-destructive' : ''}`}>
      <Label className={`text-xs ${error ? 'text-destructive' : ''}`}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive flex items-start gap-1"><AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{error}</p>}
    </div>
  );
}

