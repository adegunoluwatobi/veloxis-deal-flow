import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, CheckCircle2, Clock, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitiseFilename } from '@/lib/sanitiseFilename';
import type { CommodityType } from '@/types';

interface TradePackDoc {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  is_superseded: boolean;
}

interface TradePackItem {
  type: string;
  label: string;
  required: boolean;
  condition?: (commodityType: CommodityType | null, destination: string | null) => boolean;
}

const TRADE_PACK_ITEMS: TradePackItem[] = [
  { type: 'commercial_invoice', label: 'Commercial Invoice', required: true },
  { type: 'bill_of_lading', label: 'Bill of Lading / Airway Bill', required: true },
  { type: 'buyer_registration_doc', label: 'Buyer Registration Document', required: true },
  {
    type: 'export_licence',
    label: 'Export Licence',
    required: true,
    condition: (commodity) => commodity === 'solid_minerals',
  },
];

interface Props {
  dealId: string;
  documents: TradePackDoc[];
  commodityType: CommodityType | null;
  exportDestination: string | null;
  dealStatus: string;
  isVeloxis: boolean;
  onReload: () => void;
}

type VerifiedMap = Record<string, boolean>;

export default function TradePackChecklist({
  dealId, documents, commodityType, exportDestination,
  dealStatus, isVeloxis, onReload,
}: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [verifiedMap, setVerifiedMap] = useState<VerifiedMap>({});

  const activeDocs = documents.filter(d => !d.is_superseded);

  const applicableItems = TRADE_PACK_ITEMS.filter(item =>
    !item.condition || item.condition(commodityType, exportDestination)
  );

  const requiredItems = applicableItems.filter(i => i.required);
  const uploadedRequired = requiredItems.filter(item =>
    activeDocs.some(d => d.document_type === item.type)
  );

  const getDocForType = (type: string) =>
    activeDocs.find(d => d.document_type === type);

  const handleUpload = async (docType: string, file: File) => {
    if (!user) return;
    setUploading(docType);
    try {
      const safeName = sanitiseFilename(file.name);
      const path = `deals/${dealId}/${docType}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('veloxis-documents')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('deal_documents').insert({
        deal_id: dealId,
        document_type: docType as any,
        file_name: file.name,
        file_path: path,
        uploaded_by: user.id,
        file_size_bytes: file.size,
        mime_type: file.type,
      });
      if (insertError) throw insertError;

      await supabase.rpc('insert_audit_log', {
        p_deal_id: dealId,
        p_user_id: user.id,
        p_user_role: role as any,
        p_action_type: 'deal_document_uploaded' as any,
        p_metadata: { document_type: docType, file_name: file.name },
      });

      toast({ title: 'Document uploaded' });
      onReload();
    } catch (err: unknown) {
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const handleVerify = async (docId: string, docType: string) => {
    setVerifiedMap(prev => ({ ...prev, [docType]: true }));
    toast({ title: 'Document verified' });
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data } = await supabase.storage.from('veloxis-documents').createSignedUrl(filePath, 60);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Trade Pack</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {uploadedRequired.length} of {requiredItems.length} required uploaded
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {applicableItems.map(item => {
            const doc = getDocForType(item.type);
            const verified = verifiedMap[item.type];
            const isUploading = uploading === item.type;

            return (
              <div key={item.type} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  {doc ? (
                    verified ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-warning shrink-0" />
                    )
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {doc && (
                      <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className={cn("text-xs", item.required ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                    {item.required ? 'Required' : 'Optional'}
                  </Badge>
                  {doc ? (
                    <>
                      <Badge variant="secondary" className={cn("text-xs", verified ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                        {verified ? 'Verified' : 'Uploaded'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc.file_path, doc.file_name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {isVeloxis && !verified && (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleVerify(doc.id, item.type)}>
                          Verify
                        </Button>
                      )}
                    </>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(item.type, file);
                        }}
                        disabled={isUploading}
                      />
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 pointer-events-none" disabled={isUploading}>
                        <Upload className="h-3 w-3" />
                        {isUploading ? 'Uploading…' : 'Upload'}
                      </Button>
                    </label>
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
