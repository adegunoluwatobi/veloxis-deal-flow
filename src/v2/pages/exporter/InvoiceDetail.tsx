import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/v2/useAuth';
import { INVOICE_STATUS_LABEL } from '@/v2/roles';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { logAudit } from '@/v2/audit';
import { openDocument, invoiceDocPath } from '@/v2/lib/documents';

const DOC_TYPES = ['pro_forma', 'commercial_invoice', 'bill_of_lading', 'quality_cert', 'other'];
const DOC_LABEL: Record<string, string> = {
  pro_forma: 'Pro-forma invoice', commercial_invoice: 'Commercial invoice',
  bill_of_lading: 'Bill of lading', quality_cert: 'Quality certificate', other: 'Other',
};

export default function ExporterInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [inv, setInv] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data: i } = await supabase.from('v2_invoices').select('*, v2_buyers(company_name)').eq('id', id!).maybeSingle();
    setInv(i);
    const [{ data: d }, { data: dc }] = await Promise.all([
      supabase.from('v2_invoice_documents').select('*').eq('invoice_id', id!).order('uploaded_at', { ascending: false }),
      supabase.from('v2_decisions').select('*').eq('invoice_id', id!).order('created_at', { ascending: false }),
    ]);
    setDocs(d ?? []); setDecisions(dc ?? []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!inv) return <div className="text-muted-foreground">Loading…</div>;
  const editable = inv.status === 'draft' || inv.status === 'returned_for_revision';
  const amount = Number(inv.invoice_amount);
  const advance = amount * Number(inv.advance_rate) / 100;

  const upload = async (e: React.ChangeEvent<HTMLInputElement>, doc_type: string) => {
    const file = e.target.files?.[0]; if (!file) return;
    const path = invoiceDocPath(inv.exporter_id, id!, file.name);
    const { error } = await supabase.storage.from('veloxis-documents').upload(path, file);
    if (error) return toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    await supabase.from('v2_invoice_documents').insert({ invoice_id: id!, doc_type: doc_type as any, file_url: path, file_name: file.name, uploaded_by: user?.id });
    load();
  };
  const submit = async () => {
    await supabase.from('v2_invoices').update({ status: 'submitted', submitted_by: user?.id }).eq('id', id!);
    await logAudit({ invoice_id: id!, action: 'exporter_submitted', from_status: inv.status, to_status: 'submitted' });
    toast({ title: 'Submitted' }); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Invoice {inv.invoice_number}</h1>
        <p className="text-sm text-muted-foreground">Status: <span className="text-accent">{INVOICE_STATUS_LABEL[inv.status]}</span></p>
      </div>

      {inv.stage2_unlocked_at && !['rejected', 'settled'].includes(inv.status) && (
        <div className="card-elevated p-4 border-accent/50 bg-accent/10 space-y-2">
          <div className="text-sm font-medium">Stage 1 documents approved — Stage 2 is now open</div>
          <p className="text-sm text-muted-foreground">
            Your reviewer has approved your Stage 1 pack. You can now upload your Stage 2 documents.
          </p>
          <Button asChild size="sm"><Link to={`/portal/invoices/new?id=${inv.id}`}>Upload Stage 2 documents</Link></Button>
        </div>
      )}


      {inv.status === 'returned_for_revision' && decisions[0] && (
        <div className="card-elevated p-4 border-warning/60 bg-warning/10">
          <div className="text-sm font-medium">Returned for revision</div>
          <div className="text-sm mt-1">{decisions[0].reason}</div>
          <div className="text-xs text-muted-foreground mt-1">{new Date(decisions[0].created_at).toLocaleString()}</div>
        </div>
      )}
      {inv.status === 'rejected' && decisions[0] && (
        <div className="card-elevated p-4 border-destructive/60 bg-destructive/10">
          <div className="text-sm font-medium text-destructive">Rejected</div>
          <div className="text-sm mt-1">{decisions[0].reason}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="card-elevated p-5 space-y-1 text-sm">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Invoice</h3>
          <Row label="Buyer">{inv.v2_buyers?.company_name ?? '—'}</Row>
          <Row label="Amount">{inv.invoice_currency} {amount.toLocaleString()}</Row>
          <Row label="Terms">{inv.terms_days} days</Row>
          <Row label="Shipment">{inv.shipment_date ?? '—'}</Row>
          <Row label="Maturity">{inv.maturity_date ?? '—'}</Row>
        </div>
        <div className="card-elevated p-5 space-y-1 text-sm">
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">You will receive</h3>
          <Row label="Advance (on funding)">{inv.invoice_currency} {advance.toLocaleString()}</Row>
          <Row label="Residual (on buyer payment)">{inv.invoice_currency} {(amount - advance).toLocaleString()}</Row>
        </div>
      </div>

      <section className="card-elevated p-5 space-y-3">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground">Documents</h3>
        {docs.map((d) => (
          <div key={d.id} className="flex justify-between border-t border-border pt-2 text-sm">
            <button onClick={() => openDocument(d.id, 'invoice')} className="text-accent hover:underline">{d.file_name || d.doc_type}</button>
            <span className="text-xs text-muted-foreground">{DOC_LABEL[d.doc_type] ?? d.doc_type}</span>
          </div>
        ))}
        {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
        {editable && (
          <div className="pt-3 border-t border-border">
            <Label>Upload document</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {DOC_TYPES.map((t) => (
                <label key={t} className="text-xs px-3 py-2 border border-border rounded cursor-pointer hover:bg-muted/20">
                  {DOC_LABEL[t]}
                  <input type="file" className="hidden" onChange={(e) => upload(e, t)} />
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {editable && <Button onClick={submit}>Submit for review</Button>}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{children}</span></div>;
}
