import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL, SVC, { auth: { persistSession: false } });

const results = [];
const rec = (n, pass, detail) => { results.push({ n, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} :: ${n} :: ${detail}`); };

const PW = 'Test!Passw0rd-' + Math.random().toString(36).slice(2, 8);
const mk = async (email, role) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw error;
  await admin.from('app_user_roles').insert({ user_id: data.user.id, role });
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await c.auth.signInWithPassword({ email, password: PW });
  if (e2) throw e2;
  return { id: data.user.id, client: c, token: s.session.access_token };
};

const ids = {};
async function main() {
  const stamp = Date.now();
  const A = await mk(`rlstest.a.${stamp}@example.com`, 'exporter');
  const B = await mk(`rlstest.b.${stamp}@example.com`, 'exporter');
  const BD = await mk(`rlstest.bd.${stamp}@example.com`, 'originator');
  ids.users = [A.id, B.id, BD.id];

  const { data: dt } = await admin.from('document_types').select('id').limit(1).single();
  const { data: buyer } = await admin.from('v2_buyers').insert({ company_name: 'RLS Test Buyer', country: 'GB' }).select().single();
  const { data: expA } = await admin.from('v2_exporters').insert({ owner_user_id: A.id, company_name: 'RLS Exporter A' }).select().single();
  const { data: expB } = await admin.from('v2_exporters').insert({ owner_user_id: B.id, company_name: 'RLS Exporter B' }).select().single();
  const { data: invA } = await admin.from('v2_invoices').insert({ exporter_id: expA.id, buyer_id: buyer.id, invoice_number: 'RLS-A', invoice_amount: 1000 }).select().single();
  const { data: invB } = await admin.from('v2_invoices').insert({ exporter_id: expB.id, buyer_id: buyer.id, invoice_number: 'RLS-B', invoice_amount: 1000 }).select().single();
  const { data: docA } = await admin.from('invoice_documents').insert({ invoice_id: invA.id, document_type_id: dt.id, storage_path: `${expA.id}/a.pdf` }).select().single();
  const { data: docB } = await admin.from('invoice_documents').insert({ invoice_id: invB.id, document_type_id: dt.id, storage_path: `${expB.id}/b.pdf` }).select().single();
  const { data: coB } = await admin.from('company_documents').insert({ exporter_id: expB.id, document_type_id: dt.id, storage_path: `${expB.id}/co.pdf` }).select().single();
  const { data: brB } = await admin.from('board_resolutions').insert({ exporter_id: expB.id, authorised_limit: 5000, valid_from: '2026-01-01', valid_until: '2027-01-01' }).select().single();
  const { data: aud } = await admin.from('document_audit_log').insert({ entity_type: 'invoice_document', entity_id: docA.id, action: 'uploaded', actor_id: A.id }).select().single();
  Object.assign(ids, { buyer, expA, expB, invA, invB, docA, docB, coB, brB, aud });

  // 1
  {
    const { data, error } = await A.client.from('invoice_documents').select('id').eq('id', docB.id);
    rec('1. Exporter A SELECT invoice_documents of Exporter B', (data ?? []).length === 0, `rows=${(data ?? []).length} error=${error?.message ?? 'none'}`);
    const own = await A.client.from('invoice_documents').select('id').eq('id', docA.id);
    rec('1b. Exporter A CAN see own invoice_documents (control)', (own.data ?? []).length === 1, `rows=${(own.data ?? []).length} error=${own.error?.message ?? 'none'}`);
  }
  // 2
  {
    const c = await A.client.from('company_documents').select('id').eq('id', coB.id);
    const b = await A.client.from('board_resolutions').select('id').eq('id', brB.id);
    rec('2. Exporter A SELECT company_documents/board_resolutions of Exporter B',
      (c.data ?? []).length === 0 && (b.data ?? []).length === 0,
      `company_documents rows=${(c.data ?? []).length}, board_resolutions rows=${(b.data ?? []).length}`);
  }
  // 3
  {
    const { error } = await A.client.from('invoice_document_requests').insert({ invoice_id: invA.id, document_type_id: dt.id, reason: 'exporter attempt' });
    rec('3. Exporter INSERT into invoice_document_requests', !!error, `error=${error?.message ?? 'NO ERROR — insert succeeded'}`);
  }
  // 4
  {
    const { data, error } = await A.client.from('invoice_documents').update({ status: 'verified' }).eq('id', docA.id).select();
    const after = await admin.from('invoice_documents').select('status').eq('id', docA.id).single();
    rec('4. Exporter UPDATE invoice_documents.status on own doc', after.data.status !== 'verified',
      `returned=${(data ?? []).length} rows, error=${error?.message ?? 'none'}, status now='${after.data.status}'`);
  }
  // 5
  {
    const u = await A.client.from('document_audit_log').update({ reason: 'tampered' }).eq('id', aud.id).select();
    const d = await A.client.from('document_audit_log').delete().eq('id', aud.id).select();
    const still = await admin.from('document_audit_log').select('reason').eq('id', aud.id);
    rec('5. Exporter UPDATE/DELETE document_audit_log',
      (still.data ?? []).length === 1 && still.data[0].reason === null,
      `update err=${u.error?.message ?? 'none'} rows=${(u.data ?? []).length}; delete err=${d.error?.message ?? 'none'} rows=${(d.data ?? []).length}; row still present=${(still.data ?? []).length === 1} reason=${JSON.stringify(still.data?.[0]?.reason)}`);
  }
  // 6
  {
    const ins = await BD.client.from('invoice_document_requests').insert({ invoice_id: invA.id, document_type_id: dt.id, reason: 'bd request' }).select();
    let { data: rc } = await admin.from('regulated_commodities').select('id, active').limit(1).maybeSingle();
    if (!rc) { const r = await admin.from('regulated_commodities').insert({ name: 'RLS Test Commodity' }).select('id, active').single(); rc = r.data; ids.rc = rc; }
    const upd = await BD.client.from('regulated_commodities').update({ active: !rc.active }).eq('id', rc.id).select();
    const after = await admin.from('regulated_commodities').select('active').eq('id', rc.id).single();
    rec('6. BD (originator) CAN insert invoice_document_requests', !ins.error && (ins.data ?? []).length === 1, `error=${ins.error?.message ?? 'none'} rows=${(ins.data ?? []).length}`);
    rec('6b. BD (originator) CANNOT update regulated_commodities', after.data.active === rc.active,
      `error=${upd.error?.message ?? 'none'} rows=${(upd.data ?? []).length}, active unchanged=${after.data.active === rc.active}`);
  }
  // 7 storage
  {
    const path = `${expA.id}/signed-test.txt`;
    const up = await admin.storage.from('veloxis-documents').upload(path, new Blob(['secret-A']), { upsert: true });
    const { data: signed } = await admin.storage.from('veloxis-documents').createSignedUrl(path, 900);
    const pubUrl = `${URL}/storage/v1/object/public/veloxis-documents/${path}`;
    const pub = await fetch(pubUrl);
    const anonSigned = await fetch(signed.signedUrl);
    const asB = await fetch(signed.signedUrl, { headers: { Authorization: `Bearer ${B.token}`, apikey: ANON } });
    const bList = await B.client.storage.from('veloxis-documents').download(path);
    rec('7. Signed URL for Exporter A file, fetched by session authenticated as Exporter B',
      false,
      `upload err=${up.error?.message ?? 'none'}; signed URL status as B=${asB.status}; anonymous signed URL status=${anonSigned.status}; public URL status=${pub.status}; B RLS download err=${bList.error?.message ?? 'none (DOWNLOADED)'}`);
    ids.path = path;
  }
  console.log('\n--- storage bucket config ---');
  const { data: bk } = await admin.storage.getBucket('veloxis-documents');
  console.log(JSON.stringify(bk));
}

main().catch(e => { console.error('SCRIPT ERROR', e); }).finally(async () => {
  // cleanup
  try {
    if (ids.rc) await admin.from('regulated_commodities').delete().eq('id', ids.rc.id);
    if (ids.path) await admin.storage.from('veloxis-documents').remove([ids.path]);
    if (ids.aud) await admin.from('document_audit_log').delete().eq('id', ids.aud.id);
    if (ids.invA) await admin.from('invoice_document_requests').delete().in('invoice_id', [ids.invA.id, ids.invB.id]);
    if (ids.invA) await admin.from('invoice_documents').delete().in('invoice_id', [ids.invA.id, ids.invB.id]);
    if (ids.coB) await admin.from('company_documents').delete().eq('id', ids.coB.id);
    if (ids.brB) await admin.from('board_resolutions').delete().eq('id', ids.brB.id);
    if (ids.invA) await admin.from('v2_invoices').delete().in('id', [ids.invA.id, ids.invB.id]);
    if (ids.expA) await admin.from('v2_exporters').delete().in('id', [ids.expA.id, ids.expB.id]);
    if (ids.buyer) await admin.from('v2_buyers').delete().eq('id', ids.buyer.id);
    for (const u of ids.users ?? []) await admin.auth.admin.deleteUser(u);
    console.log('\ncleanup done');
  } catch (e) { console.error('cleanup issue', e.message); }
});
