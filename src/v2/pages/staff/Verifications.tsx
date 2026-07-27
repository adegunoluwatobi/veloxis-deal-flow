import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { FileText, Building2 } from 'lucide-react';

export default function Verifications() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verifications</h1>
        <p className="text-sm text-muted-foreground">
          Covers the five-point funding gate: Deed of Assignment, Tripartite Domiciliation, Notice of Assignment,
          Buyer credit &amp; sanctions, and Bill of Lading.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/app/invoices">
          <Card className="p-6 hover:border-accent transition-colors">
            <FileText className="h-5 w-5 text-accent mb-3" />
            <div className="font-medium">Document verifications</div>
            <p className="text-sm text-muted-foreground mt-1">
              Verify assignment documents and Bill of Lading per invoice.
            </p>
          </Card>
        </Link>
        <Link to="/app/buyers">
          <Card className="p-6 hover:border-accent transition-colors">
            <Building2 className="h-5 w-5 text-accent mb-3" />
            <div className="font-medium">Buyer verifications</div>
            <p className="text-sm text-muted-foreground mt-1">
              Credit checks, sanctions screening and credit limits by buyer.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
