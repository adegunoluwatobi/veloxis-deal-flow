import VerificationManagement from '@/components/verification/VerificationManagement';

export default function AdminVerifications() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Verifications</h1>
        <p className="text-sm text-muted-foreground">Global Smile ID dashboard. Use the trade partner filter to scope to a specific organisation. Final approval requires partner review first, unless you record a manual override.</p>
      </div>
      <VerificationManagement scope="super_admin" />
    </div>
  );
}
