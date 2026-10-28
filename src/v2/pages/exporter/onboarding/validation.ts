import {
  rcError, pastDateError, ngPhoneError, emailError, websiteError, nubanError, bvnError, ageError,
  idExpiryError, shareError, peopleListError, issueDateError, isNin, holdsShares,
} from '@/v2/lib/onboardingRules';
import { latest, allOf, type Doc, type Person } from './useOnboarding';

const s = (v: unknown) => String(v ?? '').trim();

export function personDoc(docs: Doc[], code: string, p: Person) {
  return latest(docs, code, p.id) ?? (p.is_primary ? latest(docs, code, null) : undefined);
}

export function businessErrors(f: any, docs: Doc[]): Record<string, string> {
  const e: Record<string, string> = {};
  const put = (k: string, m: string | null) => { if (m) e[k] = m; };
  if (!s(f.company_name)) e.company_name = 'Registered company name is required.';
  put('company_registration_number', rcError(f.company_registration_number));
  put('incorporation_date', pastDateError(f.incorporation_date, 'Date of incorporation'));
  if (!s(f.tax_id)) e.tax_id = 'TIN is required.';
  else if (!/^[A-Za-z0-9-]{6,20}$/.test(s(f.tax_id))) e.tax_id = 'Enter a valid TIN (6–20 letters or numbers).';
  if (!s(f.nepc_number)) e.nepc_number = 'NEPC export registration number is required.';
  if (!s(f.address_street)) e.address_street = 'Street address is required.';
  if (!s(f.address_city)) e.address_city = 'City is required.';
  if (!s(f.address_state)) e.address_state = 'Select a state.';
  if (!s(f.address_country)) e.address_country = 'Country is required.';
  put('phone', ngPhoneError(f.phone));
  put('email', emailError(f.email));
  put('website', websiteError(f.website));

  const b = f.bank_details ?? {};
  if (f.banks_with_access === null || f.banks_with_access === undefined) e.banks_with_access = 'Tell us whether you bank with Access Bank.';
  else if (f.banks_with_access) {
    if (!s(b.account_name)) e.account_name = 'Account name is required.';
    put('account_number', nubanError(b.account_number));
    if (!s(b.account_type)) e.account_type = 'Select the account type.';
    if (!s(b.branch)) e.branch = 'Branch is required.';
  } else {
    if (!(f.other_banks ?? []).length) e.other_banks = 'Select at least one bank.';
    else if (!s(b.bank_name)) e.bank_name = 'Select which bank holds your main account.';
    if (!s(b.account_name)) e.account_name = 'Account name is required.';
    put('account_number', nubanError(b.account_number));
  }

  const need: [string, string][] = [
    ['cac_certificate', 'Upload the CAC certificate of incorporation.'],
    ['cac_status_report', 'Upload the CAC status report.'],
    ['memart', 'Upload the MEMART.'],
    ['nepc_certificate', 'Upload the NEPC registration certificate.'],
    ['tin_certificate', 'Upload the TIN certificate (a FIRS screenshot is fine).'],
    ['bank_statement', 'Upload your business bank statements (last 6 to 12 months).'],
  ];
  for (const [code, msg] of need) if (!latest(docs, code)) e[`doc_${code}`] = msg;
  const addr = latest(docs, 'business_address_proof');
  if (!addr) e.doc_business_address_proof = 'Upload a proof of business address.';
  else { const ie = issueDateError(addr.issue_date); if (ie) e.doc_business_address_proof = ie; }
  return e;
}

export function personErrors(p: Person, docs: Doc[]): Record<string, string> {
  const e: Record<string, string> = {};
  const put = (k: string, m: string | null) => { if (m) e[k] = m; };
  if (!s(p.person_role)) e.person_role = 'Select a role.';
  put('shareholding_pct', shareError(p.person_role, p.shareholding_pct));
  if (!s(p.full_name)) e.full_name = 'Full legal name is required.';
  put('dob', ageError(p.dob ?? ''));
  if (!s(p.nationality)) e.nationality = 'Nationality is required.';
  put('email', emailError(p.email ?? '', true));
  put('phone', ngPhoneError(p.phone ?? ''));
  if (!s(p.address_street)) e.address_street = 'Street address is required.';
  if (!s(p.address_city)) e.address_city = 'City is required.';
  if (!s(p.address_state)) e.address_state = 'State is required.';
  if (!s(p.address_country)) e.address_country = 'Country is required.';
  if (!s(p.id_type)) e.id_type = 'Select an ID type.';
  if (!s(p.id_number)) e.id_number = 'ID number is required.';
  put('id_expiry', idExpiryError(p.id_type ?? '', p.id_expiry ?? ''));
  put('bvn', bvnError(p.bvn ?? ''));
  if (!personDoc(docs, 'director_id', p)) e.doc_id = 'Upload the ID document.';
  const addr = personDoc(docs, 'proof_of_address', p);
  if (!addr) e.doc_address = 'Upload a proof of residential address.';
  else { const ie = issueDateError(addr.issue_date); if (ie) e.doc_address = ie; }
  if (!personDoc(docs, 'passport_photo', p)) e.doc_photo = 'Upload a passport photograph.';
  return e;
}

export function peopleErrors(people: Person[], docs: Doc[]) {
  const list = peopleListError(people);
  const byPerson: Record<string, Record<string, string>> = {};
  let count = 0;
  for (const p of people) { const pe = personErrors(p, docs); if (Object.keys(pe).length) { byPerson[p.id] = pe; count += Object.keys(pe).length; } }
  return { list, byPerson, count: count + (list ? 1 : 0) };
}

export { isNin, holdsShares, allOf };
