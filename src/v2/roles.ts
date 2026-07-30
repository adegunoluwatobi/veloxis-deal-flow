export type AppRole = 'exporter' | 'originator' | 'credit_officer' | 'approver' | 'super_admin';

export const STAFF_ROLES: AppRole[] = ['originator', 'credit_officer', 'approver', 'super_admin'];

export const ROLE_LABEL: Record<AppRole, string> = {
  exporter: 'Exporter',
  originator: 'Business Developer',
  credit_officer: 'Credit & Compliance',
  approver: 'Approver (MD)',
  super_admin: 'Super Admin',
};

export function isStaff(roles: AppRole[]) {
  return roles.some((r) => STAFF_ROLES.includes(r));
}
export function has(roles: AppRole[], role: AppRole) {
  return roles.includes(role);
}
export function canVerify(roles: AppRole[]) {
  return has(roles, 'credit_officer') || has(roles, 'super_admin');
}
export function canApprove(roles: AppRole[]) {
  return has(roles, 'approver') || has(roles, 'super_admin');
}
export function canCreateInvoice(roles: AppRole[]) {
  return has(roles, 'originator') || has(roles, 'super_admin') || has(roles, 'exporter');
}

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted for Review',
  information_requested: 'Information Requested',
  verified: 'Verified',
  approved: 'Approved for Funding',
  funded: 'Funded',
  monitoring: 'Monitoring',
  settled: 'Settled',
  returned_for_revision: 'Returned for Revision',
  rejected: 'Rejected',
  defaulted: 'Defaulted',
};

export function feeFromTerms(days: number) {
  if (days === 30) return 3.5;
  if (days === 45) return 4.5;
  if (days === 60) return 5.5;
  return 3.5;
}
