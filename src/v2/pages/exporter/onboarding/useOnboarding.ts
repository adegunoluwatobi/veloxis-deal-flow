import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { computeOnboardingLock } from '@/v2/lib/onboardingLock';

export type Doc = {
  id: string; document_type_id: string; code: string; label: string; person_id: string | null;
  original_filename: string | null; status: string; uploaded_at: string; rejection_reason: string | null;
  issue_date: string | null; storage_path: string;
};

export type Person = {
  id: string; person_role: 'director' | 'shareholder' | 'both'; shareholding_pct: number | null;
  full_name: string; dob: string | null; nationality: string | null; email: string | null; phone: string | null;
  address_street: string | null; address_city: string | null; address_state: string | null; address_country: string | null;
  id_type: string | null; id_number: string | null; id_expiry: string | null; bvn: string | null; is_primary: boolean;
  created_at?: string;
};

export const DOC_CODES = [
  'cac_certificate', 'cac_status_report', 'memart', 'nepc_certificate', 'business_address_proof', 'bank_statement',
  'bank_reference_letter', 'tin_certificate', 'board_resolution', 'director_id', 'proof_of_address', 'passport_photo',
];

export function blankCompany(email?: string | null) {
  return {
    company_name: '', company_registration_number: '', incorporation_date: '', tax_id: '', nepc_number: '',
    address_street: '', address_city: '', address_state: '', address_country: 'Nigeria',
    phone: '', email: email ?? '', website: '', industry: '', commodity: '', country_of_incorporation: 'Nigeria',
    banks_with_access: null as boolean | null, other_banks: [] as string[],
    bank_details: { bank_name: '', account_name: '', account_number: '', account_type: '', branch: '', swift: '' },
    proposed_signatories: [] as { name: string; designation: string; email: string; phone: string; person_id?: string }[],
    onboarding_step: 1,
  };
}

export function useOnboarding() {
  const { user, profile, refresh } = useAuth();
  const [exp, setExp] = useState<any>(null);
  const [f, setF] = useState<any>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [typeIds, setTypeIds] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const expIdRef = useRef<string | null>(null);

  const loadDocs = useCallback(async (id: string) => {
    const { data } = await supabase.from('company_documents')
      .select('id, document_type_id, person_id, original_filename, status, uploaded_at, rejection_reason, issue_date, storage_path, document_types(code, label)')
      .eq('exporter_id', id).order('uploaded_at', { ascending: false });
    setDocs((data ?? []).map((d: any) => ({ ...d, code: d.document_types?.code, label: d.document_types?.label })));
  }, []);

  const loadPeople = useCallback(async (id: string) => {
    const { data } = await supabase.from('v2_exporter_directors').select('*').eq('exporter_id', id).order('created_at', { ascending: true });
    setPeople((data as any) ?? []);
  }, []);

  const load = useCallback(async () => {
    const { data: rows } = await supabase.from('v2_exporters').select('*').eq('owner_user_id', user!.id).order('created_at', { ascending: true }).limit(1);
    const e = rows?.[0] ?? null;
    setExp(e);
    expIdRef.current = e?.id ?? null;
    const base = blankCompany(profile?.email);
    setF(e ? {
      ...base, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v !== null)),
      bank_details: { ...base.bank_details, ...((e.bank_details as any) ?? {}) },
      address_street: e.address_street ?? e.address ?? '',
    } : base);
    const { data: dt } = await supabase.from('document_types').select('id, code').in('code', DOC_CODES);
    setTypeIds(Object.fromEntries((dt ?? []).map((t: any) => [t.code, t.id])));
    if (e?.id) await Promise.all([loadDocs(e.id), loadPeople(e.id)]);
  }, [user, profile, loadDocs, loadPeople]);

  useEffect(() => { void load(); }, [load]);

  const lock = computeOnboardingLock(exp as never);

  const payloadFrom = (x: any) => {
    const address = [x.address_street, x.address_city, x.address_state, x.address_country].filter((v: string) => String(v ?? '').trim()).join(', ');
    const bank = { ...(x.bank_details ?? {}) };
    if (x.banks_with_access === true) bank.bank_name = 'Access Bank';
    return {
      company_name: x.company_name || 'Untitled company',
      company_registration_number: x.company_registration_number || null, rc_number: x.company_registration_number || null,
      incorporation_date: x.incorporation_date || null, tax_id: x.tax_id || null, nepc_number: x.nepc_number || null,
      address_street: x.address_street || null, address_city: x.address_city || null, address_state: x.address_state || null,
      address_country: x.address_country || 'Nigeria', address: address || null,
      country_of_incorporation: x.country_of_incorporation || 'Nigeria',
      phone: x.phone || null, email: x.email || profile?.email || null, website: x.website || null,
      industry: x.industry || null, commodity: x.commodity || null,
      banks_with_access: x.banks_with_access, other_banks: x.other_banks ?? [], bank_details: bank,
      proposed_signatories: x.proposed_signatories ?? [], onboarding_step: x.onboarding_step ?? 1,
    };
  };

  /** Saves the company draft; creates the record on first save. Returns the exporter id. */
  const saveCompany = useCallback(async (x?: any): Promise<string | null> => {
    const data = x ?? f;
    if (!data || !user) return null;
    setSaveState('saving');
    const payload = payloadFrom(data);
    if (expIdRef.current) {
      const { error } = await supabase.from('v2_exporters').update(payload as any).eq('id', expIdRef.current);
      setSaveState(error ? 'error' : 'saved');
      return error ? null : expIdRef.current;
    }
    const { data: ins, error } = await supabase.from('v2_exporters').insert({
      owner_user_id: user.id, ...payload, onboarding_status: 'pending', kyb_status: 'pending', kyc_status: 'pending',
    } as any).select('*').single();
    if (error) { setSaveState('error'); return null; }
    expIdRef.current = ins.id;
    setExp(ins);
    setSaveState('saved');
    void refresh();
    return ins.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, user, profile]);

  // Debounced autosave of the company draft.
  const dirty = useRef(false);
  useEffect(() => {
    if (!f || !dirty.current || lock.formLocked) return;
    const t = setTimeout(() => { dirty.current = false; void saveCompany(f); }, 1200);
    return () => clearTimeout(t);
  }, [f, lock.formLocked, saveCompany]);

  const set = (k: string, v: any) => { dirty.current = true; setF((x: any) => ({ ...x, [k]: v })); };
  const setBank = (k: string, v: any) => { dirty.current = true; setF((x: any) => ({ ...x, bank_details: { ...(x.bank_details ?? {}), [k]: v } })); };

  const uploadDoc = async (file: File, code: string, opts: { personId?: string | null; issueDate?: string | null } = {}) => {
    const id = await saveCompany();
    if (!id) throw new Error('Please save your business details first.');
    const typeId = typeIds[code];
    if (!typeId) throw new Error('This document type is not configured. Please contact Veloxis.');
    const safe = file.name.replace(/\s+/g, '_').replace(/[^a-z0-9._-]+/gi, '');
    const path = `${id}/company/onboarding/${code}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('veloxis-documents').upload(path, file, { contentType: file.type });
    if (upErr) throw new Error('Upload failed. Please try again.');
    const { data: inserted, error } = await supabase.from('company_documents').insert({
      exporter_id: id, document_type_id: typeId, storage_path: path, original_filename: file.name,
      file_size_bytes: file.size, uploaded_by: user!.id, person_id: opts.personId ?? null, issue_date: opts.issueDate ?? null,
    } as any).select('id').single();
    if (error) throw new Error('Could not record the upload. Please try again.');
    const { data: scan } = await supabase.functions.invoke('scan-document', { body: { document_id: inserted.id, document_kind: 'company' } });
    await loadDocs(id);
    if ((scan as any)?.scan_status && (scan as any).scan_status !== 'clean') throw new Error((scan as any).message ?? 'This file could not be accepted.');
  };

  return {
    user, profile, exp, setExp, f, setF, set, setBank, docs, people, setPeople, typeIds, saveState,
    saveCompany, uploadDoc, reload: load, loadPeople, lock, expId: () => expIdRef.current,
  };
}

export type OnboardingCtx = ReturnType<typeof useOnboarding>;

/** Latest document for a type (optionally per person). */
export const latest = (docs: Doc[], code: string, personId: string | null = null) =>
  docs.find((d) => d.code === code && (d.person_id ?? null) === personId);
export const allOf = (docs: Doc[], code: string, personId: string | null = null) =>
  docs.filter((d) => d.code === code && (d.person_id ?? null) === personId);
