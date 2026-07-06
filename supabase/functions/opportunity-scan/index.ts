// supabase/functions/opportunity-scan/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const VELOXIS_CONTEXT = `
Veloxis Ltd is a UK-registered trade finance platform (Company No. 15663333).
- ITLC (Irrevocable Transferable Letter of Credit) invoice discounting
- Advances 80% of invoice value to African SME exporters within 24 hours of bank acceptance
- Exporters in Africa (Nigeria-first) shipping commodities to verified UK/EU buyers
STAGE: Pre-revenue, seed stage, UK-registered, founder-led. RAISING: $1M seed.
SECTORS: Agricultural commodities, solid minerals, metals, textiles, timber, processed seafood, manufactured goods.
LOOKING FOR: accelerators/incubators (fintech, trade finance, Africa, emerging markets),
seed/pre-seed investment, non-dilutive grants (UK govt, development finance, impact funds),
regulatory programmes (FCA sandbox), DFI programmes (UKEF, BII, Afreximbank, IFC, AFC),
Nigeria/West Africa corridor opportunities, B2B/working-capital fintech, financial inclusion programmes.
`

// Split into 2 batches to stay within Edge Function time limits
const QUERIES_BATCH_1 = [
  "fintech accelerator Africa 2026 open applications",
  "African fintech accelerator program apply 2026",
  "startup accelerator Nigeria fintech 2026",
  "Africa trade finance startup accelerator 2026",
  "West Africa fintech accelerator applications open",
  "emerging markets fintech accelerator 2026",
  "trade finance fintech accelerator program 2026",
  "invoice finance startup accelerator 2026",
  "cross border payments fintech accelerator 2026",
  "B2B fintech accelerator working capital 2026",
  "SME finance accelerator program 2026 apply",
  "UK fintech accelerator program 2026 open applications",
  "London fintech accelerator 2026 apply",
  "Innovate UK grant fintech 2026 apply",
  "UK government grant fintech startup 2026",
  "British Business Bank grant 2026 fintech",
  "UK Export Finance programme fintech 2026",
]

const QUERIES_BATCH_2 = [
  "development finance grant fintech Africa 2026",
  "IFC SME finance grant program 2026",
  "AfDB fintech grant program 2026",
  "Afreximbank grant program 2026 accelerator cohort",
  "BII British International Investment fintech 2026",
  "financial inclusion fintech grant 2026",
  "Mastercard Foundation fintech grant 2026",
  "seed investor Africa fintech 2026",
  "pre-seed funding Africa fintech startup 2026",
  "Nigerian fintech seed funding 2026",
  "UK fintech seed investor 2026",
  "FCA regulatory sandbox 2026 apply fintech",
  "fintech competition prize 2026 Africa",
  "African fintech startup competition 2026",
  "Visa Africa fintech accelerator cohort 2026",
  "Catalyst Fund accelerator 2026 open",
  "Techstars fintech accelerator 2026 apply",
  "Founders Factory Africa 2026",
  "Google for Startups Africa 2026",
  // opportunitiesforafricans.com targeted queries
  "site:opportunitiesforafricans.com fintech 2026",
  "site:opportunitiesforafricans.com accelerator 2026",
  "site:opportunitiesforafricans.com grant 2026",
  "site:opportunitiesforafricans.com funding 2026",
  "site:opportunitiesforafricans.com startup competition 2026",
  "site:opportunitiesforafricans.com entrepreneurs 2026",
]

async function searchSerper(q: string) {
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': Deno.env.get('SERPER_API_KEY')!
      },
      body: JSON.stringify({ q, num: 10, gl: 'gb', hl: 'en', tbs: 'qdr:m3' })
    })
    if (!res.ok) return []
    const data = await res.json()
    const out: any[] = []
    for (const item of [...(data.organic || []), ...(data.news || [])]) {
      if (item.link) out.push({ title: item.title || '', url: item.link, snippet: item.snippet || '' })
    }
    return out
  } catch { return [] }
}

async function scoreWithGemini(batch: any[]) {
  const items = batch.map((r, i) =>
    `[${i + 1}] TITLE: ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.snippet}`
  ).join('\n---\n')

  const prompt = `Analyse these search results for funding opportunities relevant to Veloxis Ltd.

VELOXIS CONTEXT:
${VELOXIS_CONTEXT}

RESULTS:
${items}

For each, score relevance 1-10 (9-10 perfect fit open now; 7-8 relevant worth investigating; 6 tangential; 1-5 irrelevant, closed, wrong geography or wrong stage).
Category must be one of: Accelerator, Incubator, Grant, Seed Investment, Regulatory Programme, Competition, Fellowship, News, Irrelevant
Deadline: YYYY-MM-DD if mentioned, otherwise ""

Return ONLY a JSON array, no markdown, no other text:
[{"index":1,"score":8,"category":"Accelerator","deadline":"","summary":"one sentence summary"}]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const scores = JSON.parse(text.replace(/```json|```/g, '').trim())
    return batch.map((r, i) => {
      const s = scores.find((x: any) => x.index === i + 1) || {}
      return {
        ...r,
        score: s.score ?? 5,
        category: s.category || 'Unknown',
        deadline: s.deadline || null,
        summary: s.summary || r.snippet
      }
    })
  } catch {
    return batch.map(r => ({ ...r, score: 5, category: 'Unknown', deadline: null, summary: r.snippet }))
  }
}

function extractOrg(url: string) {
  try {
    const d = new URL(url).hostname.replace('www.', '').split('.')[0]
    return d.charAt(0).toUpperCase() + d.slice(1)
  } catch { return '' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Authorization: cron (service role key) or staff caller (super_admin/deal_manager).
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (token !== serviceRoleKey) {
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claims, error: cErr } = await authClient.auth.getClaims(token)
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: roles } = await supabase.from('user_roles')
      .select('role').eq('user_id', claims.claims.sub)
    const ok = (roles ?? []).some((r: any) => r.role === 'super_admin' || r.role === 'deal_manager')
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }


  const { batch } = await req.json().catch(() => ({ batch: 1 }))
  const queries = batch === 2 ? QUERIES_BATCH_2 : QUERIES_BATCH_1

  const { data: existing } = await supabase.from('opportunities').select('url')
  const existingUrls = new Set((existing || []).map((r: any) => r.url))

  const seen = new Set<string>()
  const raw: any[] = []
  const allResults = await Promise.all(queries.map(q => searchSerper(q).then(rs => ({ q, rs }))))
  for (const { q, rs } of allResults) {
    for (const r of rs) {
      if (!existingUrls.has(r.url) && !seen.has(r.url)) {
        seen.add(r.url)
        raw.push({ ...r, query: q })
      }
    }
  }

  const batches: any[][] = []
  for (let i = 0; i < raw.length; i += 15) batches.push(raw.slice(i, i + 15))
  const scoredBatches = await Promise.all(batches.map(b => scoreWithGemini(b)))
  const scored: any[] = scoredBatches.flat()

  const relevant = scored.filter(r => r.score >= 6)

  if (relevant.length) {
    const rows = relevant.map(o => ({
      title: o.title,
      category: o.category,
      organisation: extractOrg(o.url),
      deadline: o.deadline || null,
      fit: o.score >= 9 ? 'HIGH' : o.score >= 7 ? 'MEDIUM' : 'LOW',
      score: o.score,
      url: o.url,
      summary: o.summary,
      status: 'To Review',
      date_found: new Date().toISOString().split('T')[0],
      search_query: o.query
    }))
    await supabase.from('opportunities').upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
  }

  await supabase.from('cron_log').insert({
    queries_run: queries.length,
    results_found: raw.length,
    new_added: relevant.length,
    status: `success-batch-${batch}`
  })

  return new Response(JSON.stringify({ batch, found: raw.length, added: relevant.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
