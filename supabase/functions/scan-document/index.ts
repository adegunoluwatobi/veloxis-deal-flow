import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SIGNATURES: Record<string, { label: string; test: (b: Uint8Array) => boolean }> = {
  pdf: {
    label: 'PDF',
    test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
  },
  jpeg: {
    label: 'JPEG image',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  png: {
    label: 'PNG image',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  webp: {
    label: 'WEBP image',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50, // RIFF....WEBP
  },
};

function detect(bytes: Uint8Array): string | null {
  for (const [key, sig] of Object.entries(SIGNATURES)) {
    if (sig.test(bytes)) return key;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Not signed in' }, 401);

    const body = await req.json().catch(() => ({}));
    const documentId = String(body.document_id ?? '');
    const kind = String(body.document_kind ?? '');
    if (!documentId || !['invoice', 'company'].includes(kind)) {
      return json({ error: 'document_id and document_kind are required' }, 400);
    }

    const admin = createClient(url, service);
    const table = kind === 'invoice' ? 'invoice_documents' : 'company_documents';

    const { data: doc, error: docErr } = await admin
      .from(table)
      .select('id, storage_path, original_filename, scan_status')
      .eq('id', documentId)
      .maybeSingle();
    if (docErr || !doc) return json({ error: 'Document not found' }, 404);

    const { data: file, error: dlErr } = await admin.storage.from('veloxis-documents').download(doc.storage_path);
    if (dlErr || !file) {
      await admin.from(table).update({
        scan_status: 'scan_failed', scanned_at: new Date().toISOString(),
        scan_detail: `Could not read the stored file: ${dlErr?.message ?? 'unknown error'}`,
      }).eq('id', documentId);
      return json({ scan_status: 'scan_failed', message: 'We could not check this file. Please upload it again.' }, 200);
    }

    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const detected = detect(head);

    if (!detected) {
      await admin.from(table).update({
        scan_status: 'flagged', scanned_at: new Date().toISOString(),
        scan_detail: 'File contents do not match any accepted format',
      }).eq('id', documentId);
      return json({
        scan_status: 'flagged',
        message: 'This file does not appear to be a PDF, JPEG, PNG or WEBP. Please check the file and try again.',
      }, 200);
    }

    await admin.from(table).update({
      scan_status: 'clean', scanned_at: new Date().toISOString(),
      scan_detail: `Content inspection passed, detected ${SIGNATURES[detected].label}`,
    }).eq('id', documentId);

    return json({ scan_status: 'clean', detected });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
