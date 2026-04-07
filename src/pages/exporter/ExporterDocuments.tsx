import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExporterDocumentType } from '@/types';

const DOC_TYPE_LABELS: Record<ExporterDocumentType, string> = {
  cac_certificate: 'CAC Certificate',
  director_id: 'Director ID',
  nepc_certificate: 'NEPC Certificate',
  other: 'Other',
};

export default function ExporterDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exporter, setExporter] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    document_type: '' as ExporterDocumentType | '',
    expiry_date: '',
    file: null as File | null,
  });

  const load = async () => {
    if (!user) return;
    const { data: exp } = await supabase
      .from('exporters')
      .select('id, company_name')
      .eq('exporter_user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (exp) {
      setExporter(exp);
      const { data: docs } = await supabase
        .from('exporter_documents')
        .select('*')
        .eq('exporter_id', exp.id)
        .order('uploaded_at', { ascending: false });
      setDocuments(docs ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleUpload = async () => {
    if (!user || !exporter || !form.file || !form.document_type) return;
    setUploading(true);
    try {
      const file = form.file;
      const filePath = `exporters/${exporter.id}/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage.from('veloxis-documents').upload(filePath, file);
      if (storageErr) throw storageErr;

      const { error: docErr } = await supabase.from('exporter_documents').insert({
        exporter_id: exporter.id,
        document_type: form.document_type as ExporterDocumentType,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        expiry_date: form.expiry_date || null,
        uploaded_by_user_id: user.id,
        uploaded_by_role: 'exporter',
        document_status: 'pending_review',
      });
      if (docErr) throw docErr;

      await supabase.rpc('insert_audit_log', {
        p_exporter_id: exporter.id,
        p_user_id: user.id,
        p_user_role: 'exporter' as any,
        p_action_type: 'exporter_document_uploaded' as any,
        p_metadata: { document_type: form.document_type, file_name: file.name, uploaded_by: 'exporter' },
      });

      setForm({ document_type: '', expiry_date: '', file: null });
      toast({ title: 'Document uploaded', description: 'Your document has been submitted for review.' });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;
  if (!exporter) return <div className="py-20 text-center"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-muted-foreground">No exporter profile linked.</p></div>;

  const activeDocs = documents.filter((d) => !d.is_superseded);
  const supersededDocs = documents.filter((d) => d.is_superseded);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">Upload and manage KYC documents for {exporter.company_name}</p>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Document</CardTitle>
          <CardDescription>Accepted: CAC Certificate, Director ID, NEPC Certificate. All uploads go to Greystar for review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v as ExporterDocumentType })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {(['cac_certificate', 'director_id', 'nepc_certificate'] as ExporterDocumentType[]).map((k) => (
                    <SelectItem key={k} value={k}>{DOC_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
          </div>
          <Button onClick={handleUpload} disabled={!form.document_type || !form.file || uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </CardContent>
      </Card>

      {/* Current Documents */}
      <Card>
        <CardHeader><CardTitle>Current Documents ({activeDocs.length})</CardTitle></CardHeader>
        <CardContent>
          {activeDocs.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">File</th>
                    <th className="pb-2 font-medium">Expiry</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-3">{DOC_TYPE_LABELS[doc.document_type as ExporterDocumentType] ?? doc.document_type}</td>
                      <td className="py-3 max-w-[200px] truncate">{doc.file_name}</td>
                      <td className="py-3">{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : '—'}</td>
                      <td className="py-3">
                        <Badge variant="secondary" className={cn('text-xs',
                          doc.document_status === 'verified' ? 'bg-success/10 text-success' :
                          doc.document_status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                          'bg-warning/10 text-warning'
                        )}>
                          {doc.document_status === 'pending_review' ? 'Pending Review' : doc.document_status === 'verified' ? 'Verified' : 'Rejected'}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {supersededDocs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Previous Versions ({supersededDocs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {supersededDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between text-sm text-muted-foreground border-b border-border pb-2">
                  <span>{DOC_TYPE_LABELS[doc.document_type as ExporterDocumentType] ?? doc.document_type} — {doc.file_name}</span>
                  <Badge variant="outline" className="text-xs">Superseded</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
