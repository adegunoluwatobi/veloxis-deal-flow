/**
 * SWIFT/BIC and IBAN validation helpers.
 */

const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export function normaliseSwift(value: string): string {
  return (value || '').toUpperCase().replace(/\s+/g, '');
}

export function isValidSwift(value: string): boolean {
  const v = normaliseSwift(value);
  return SWIFT_REGEX.test(v);
}

export function stripIban(value: string): string {
  return (value || '').toUpperCase().replace(/\s+/g, '');
}

export function isValidIban(value: string): boolean {
  const v = stripIban(value);
  if (v.length < 15 || v.length > 34) return false;
  // First 2 chars must be letters (country code), next 2 digits (check digits)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(v)) return false;
  return true;
}

export function formatIbanForDisplay(value: string): string {
  const v = stripIban(value);
  return v.replace(/(.{4})/g, '$1 ').trim();
}
