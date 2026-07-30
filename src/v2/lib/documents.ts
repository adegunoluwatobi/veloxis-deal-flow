import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type DocumentKind = 'invoice' | 'company';

/**
 * The only sanctioned way to obtain a download link for a stored document.
 * Signing happens server-side in the `get-document-url` edge function with a
 * hardcoded 900s expiry; clients never call createSignedUrl directly.
 */
export async function getDocumentUrl(documentId: string, kind: DocumentKind): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('get-document-url', {
    body: { document_id: documentId, document_kind: kind },
  });
  if (error || !data?.url) {
    toast({
      title: 'Unable to open document',
      description: error?.message ?? 'You do not have access to this document.',
      variant: 'destructive',
    });
    return null;
  }
  return data.url as string;
}

export async function openDocument(documentId: string, kind: DocumentKind) {
  const url = await getDocumentUrl(documentId, kind);
  if (url) window.open(url, '_blank');
}

/** Canonical v2 storage path shapes. */
export const invoiceDocPath = (exporterId: string, invoiceId: string, fileName: string) =>
  `${exporterId}/invoices/${invoiceId}/${Date.now()}-${fileName.replace(/[^a-z0-9._-]+/gi, '_')}`;

export const companyDocPath = (exporterId: string, folder: string, fileName: string) =>
  `${exporterId}/company/${folder}/${Date.now()}-${fileName.replace(/[^a-z0-9._-]+/gi, '_')}`;
