import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileText, CheckCircle2, Clock, XCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TradePackDoc {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  is_superseded: boolean;
  verification_status?: string;
}

interface Props {
  dealId: string;
  documents: TradePackDoc[];
  dealStatus: string;
  isVeloxis: boolean;
  onReload: () => void;
}

const TRADE_PACK_LABELS: Record<string, string> = {
  commercial_invoice: 'Commercial Invoice',
  bill_of_lading: 'Bill of Lading / Airway Bill',
  buyer_registration_doc: 'Buyer Registration Document',
  packing_list: 'Packing List',
  insurance_certificate: 'Insurance Certificate',
  nxp_form: 'NXP Form (Customs Export Declaration)',
  export_licence: 'Export Licence',
};

const TRADE_PACK_TYPES = ['commercial_invoice', 'bill_of_lading', 'buyer_registration_doc', 'packing_list', 'insurance_certificate', 'nxp_form', 'export_licence'];

export default function TradePackChecklist({
  dealId, documents, dealStatus, isVeloxis, onReload,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const activeDocs = documents.filter(d => !d.is_superseded);

  const uploadedTypes = TRADE_PACK_TYPES.filter(type =>
    activeDocs.some(d => d.document_type === type)
  );

  const getDocForType = (type: string) =>
    activeDocs.find(d => d.document_type === type);

  const handleDownload = async (filePath: string) => {
    try {
      const { data } = await supabase.storage.from('veloxis-documents').createSignedUrl(filePath, 60);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const handleVerify = async (docId: string, docType: string) => {
    setActionLoading(docType);
    const { error } = await supabase.from('deal_documents').update({
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: user?.id,
    } as any).eq('id', docId);
    if (error) {
      toast({ title: 'Failed to verify', variant: 'destructive' });
    } else {
      toast({ title: 'Document verified' });
      onReload();
    }
    setActionLoading(null);
  };

  const handleReject = async (docId: string, docType: string) => {
    setActionLoading(docType);
    const { error } = await supabase.from('deal_documents').update({
      verification_status: 'rejected',
      verified_at: new Date().toISOString(),
      verified_by: user?.id,
    } as any).eq('id', docId);
    if (error) {
      toast({ title: 'Failed to reject', variant: 'destructive' });
    } else {
      toast({ title: 'Document rejected', variant: 'destructive' });
      onReload();
    }
    setActionLoading(null);
  };

  if (uploadedTypes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Trade Pack Documents</CardTitle>
          <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">Read Only</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Uploaded by the exporter. Veloxis can verify or reject each document.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {uploadedTypes.map(type => {
            const doc = getDocForType(type);
            if (!doc) return null;
            const status = (doc.verification_status as string) || 'unverified';
            const isLoading = actionLoading === type;

            return (
              <div key={type} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  {status === 'verified' ? (
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  ) : status === 'rejected' ? (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  ) : (
                    <Clock className="h-5 w-5 text-warning shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{TRADE_PACK_LABELS[type] ?? type}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      status === 'verified' && "bg-success/10 text-success",
                      status === 'rejected' && "bg-destructive/10 text-destructive",
                      status === 'unverified' && "bg-warning/10 text-warning",
                    )}
                  >
                    {status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Unverified'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc.file_path)} title="View / Download">
                    <Download className="h-4 w-4" />
                  </Button>
                  {isVeloxis && status !== 'verified' && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleVerify(doc.id, type)} disabled={isLoading}>
                      Verify
                    </Button>
                  )}
                  {isVeloxis && status !== 'rejected' && status !== 'verified' && (
                    <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => handleReject(doc.id, type)} disabled={isLoading}>
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
