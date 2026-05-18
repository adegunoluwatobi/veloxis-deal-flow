import VerificationManagement from '@/components/verification/VerificationManagement';

export default function GreystarVerifications() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Verifications</h1>
        <p className="text-sm text-muted-foreground">Smile ID KYC/KYB results for exporters in your organisation. Partner review must be completed before final platform approval.</p>
      </div>
      <VerificationManagement scope="partner_admin" />
    </div>
  );
}
