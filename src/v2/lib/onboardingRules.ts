// Validation rules for the exporter onboarding wizard. Error messages never echo
// sensitive values (BVN, ID or account numbers).

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
export const PHOTO_MIME = ['image/jpeg', 'image/png'];

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

export const PERSON_ID_TYPES = ['International Passport', 'National ID (NIN)', "Driver's Licence"];
export const isNin = (t?: string | null) => t === 'National ID (NIN)';

const s = (v: unknown) => String(v ?? '').trim();

export function fileError(file: File, opts: { photoOnly?: boolean } = {}): string | null {
  const allowed = opts.photoOnly ? PHOTO_MIME : DOC_MIME;
  if (!allowed.includes(file.type)) return opts.photoOnly ? 'Photo must be a JPG or PNG.' : 'File must be a PDF, JPG or PNG.';
  if (file.size > MAX_UPLOAD_BYTES) return 'File is larger than 10MB.';
  return null;
}

export function rcError(v: string): string | null {
  if (!s(v)) return 'CAC RC number is required.';
  if (!/^(RC)?\s?\d{4,8}$/i.test(s(v))) return 'Enter digits only, optionally starting with RC (e.g. RC1234567).';
  return null;
}

export function pastDateError(v: string, label: string, today = new Date()): string | null {
  if (!s(v)) return `${label} is required.`;
  const d = new Date(v);
  if (isNaN(d.getTime())) return `Enter a valid ${label.toLowerCase()}.`;
  if (d.getTime() > today.getTime()) return `${label} cannot be in the future.`;
  return null;
}

/** Issue date must be within the last 3 months and not in the future. */
export function issueDateError(v: string | null | undefined, today = new Date()): string | null {
  if (!s(v)) return 'Enter the date this document was issued.';
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return 'Enter a valid issue date.';
  if (d.getTime() > today.getTime()) return 'Issue date cannot be in the future.';
  const limit = new Date(today); limit.setMonth(limit.getMonth() - 3);
  if (d.getTime() < limit.getTime()) return 'This document is older than 3 months. Please upload a more recent one.';
  return null;
}

export function ngPhoneError(v: string, required = true): string | null {
  if (!s(v)) return required ? 'Phone number is required.' : null;
  if (!/^\+234\s?[789][01]\d(\s?\d){7}$/.test(s(v))) return 'Enter a Nigerian number in +234 format, e.g. +234 801 234 5678.';
  return null;
}

export function emailError(v: string, required = false): string | null {
  if (!s(v)) return required ? 'Email is required.' : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s(v))) return 'Enter a valid email address, like name@company.com.';
  return null;
}

export function websiteError(v: string): string | null {
  if (!s(v)) return null;
  if (!/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s(v))) return 'Enter a valid website, e.g. www.company.com.';
  return null;
}

export const nubanError = (v: string) => (!s(v) ? 'Account number is required.' : /^\d{10}$/.test(s(v)) ? null : 'Account number must be exactly 10 digits.');
export const bvnError = (v: string) => (!s(v) ? 'BVN is required.' : /^\d{11}$/.test(s(v)) ? null : 'BVN must be exactly 11 digits.');

export function ageError(dob: string, today = new Date()): string | null {
  if (!s(dob)) return 'Date of birth is required.';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 'Enter a valid date of birth.';
  const adult = new Date(d); adult.setFullYear(adult.getFullYear() + 18);
  if (adult.getTime() > today.getTime()) return 'Must be at least 18 years old.';
  return null;
}

export function idExpiryError(idType: string, expiry: string, today = new Date()): string | null {
  if (isNin(idType)) return null;
  if (!s(expiry)) return 'ID expiry date is required.';
  const d = new Date(expiry);
  if (isNaN(d.getTime())) return 'Enter a valid expiry date.';
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  if (d.getTime() < t.getTime()) return 'This ID has expired. Please use a valid ID.';
  return null;
}

export type PersonRole = 'director' | 'shareholder' | 'both';
export const holdsShares = (r: PersonRole | string) => r === 'shareholder' || r === 'both';
export const isDirector = (r: PersonRole | string) => r === 'director' || r === 'both';

export function shareError(role: string, pct: unknown): string | null {
  if (!holdsShares(role)) return null;
  if (pct === null || pct === undefined || s(pct) === '') return 'Shareholding % is required.';
  const n = Number(pct);
  if (isNaN(n) || n < 0 || n > 100) return 'Shareholding must be between 0 and 100.';
  return null;
}

export function peopleListError(people: { person_role: string; shareholding_pct?: unknown }[]): string | null {
  if (!people.some((p) => isDirector(p.person_role))) return 'Add at least one Director.';
  const total = people.filter((p) => holdsShares(p.person_role)).reduce((a, p) => a + (Number(p.shareholding_pct) || 0), 0);
  if (total > 100) return `Total shareholding is ${total}%. It cannot exceed 100%.`;
  return null;
}

export const maskTail = (v: string | null | undefined) => {
  const x = s(v);
  return x.length <= 4 ? x : `${'•'.repeat(Math.min(x.length - 4, 8))}${x.slice(-4)}`;
};

export type WizardStatus = 'draft' | 'submitted' | 'under_review' | 'more_info' | 'approved' | 'rejected';
export const WIZARD_STATUS_LABEL: Record<WizardStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  more_info: 'More Information Requested', approved: 'Approved', rejected: 'Rejected',
};

export function wizardStatus(e: {
  onboarding_status?: string | null; onboarding_submitted_at?: string | null;
  bd_approved_at?: string | null; bd_rejected_at?: string | null;
} | null | undefined): WizardStatus {
  if (!e) return 'draft';
  if (e.onboarding_status === 'active') return 'approved';
  if (e.onboarding_status === 'suspended') return 'rejected';
  const sub = e.onboarding_submitted_at ? new Date(e.onboarding_submitted_at).getTime() : 0;
  const rej = e.bd_rejected_at ? new Date(e.bd_rejected_at).getTime() : 0;
  if (rej && rej > sub) return 'more_info';
  if (!sub) return 'draft';
  if (e.bd_approved_at) return 'under_review';
  return 'submitted';
}
