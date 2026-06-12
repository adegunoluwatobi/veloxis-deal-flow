// Daily opportunity scanner: Serper search → Claude scoring → opportunities table
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Default queries — tuned for Veloxis (trade/export finance, fintech, African SMEs)
const QUERIES: { query: string; category: string }[] = [
  { query: "fintech accelerator 2026 application open", category: "Accelerator" },
  { query: "trade finance grant Africa SME 2026", category: "Grant" },
  { query: "export finance fund Nigeria 2026", category: "Grant" },
  { query: "seed investor trade finance fintech Africa", category: "Seed Investment" },
  { query: "FCA innovation pathway sandbox 2026", category: "Regulatory Programme" },
  { query: "UK fintech incubator emerging markets", category: "Incubator" },
  { query: "African Development Bank SME finance programme 2026", category: "Grant" },
  { query: "trade finance competition pitch 2026", category: "Competition" },
  { query: "Tony Elumelu fellowship entrepreneurs 2026", category: "Fellowship" },
  { query: "cross-border payments fintech news 2026", category: "News" },
];

interface SerperResult {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
}

async function serperSearch(query: string): Promise<SerperResult[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 10, gl: "uk", hl: "en" }),
  });
  if (!res.ok) {
    console.error("Serper error", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return (data.organic ?? []).map((r: any) => ({
    title: r.title, link: r.link, snippet: r.snippet, date: r.date,
  }));
}

interface Scored {
  title: string; url: string; summary: string; organisation: string;
  deadline: string | null; amount: string | null; fit: "HIGH" | "MEDIUM" | "LOW"; score: number;
}

async function scoreWithClaude(query: string, category: string, results: SerperResult[]): Promise<Scored[]> {
  if (results.length === 0) return [];
  const prompt = `You are scoring funding/programme opportunities for Veloxis — a UK-based fintech providing invoice/trade finance to African SME exporters shipping non-agricultural goods to the EU/UK/EFTA.

For each search result below, assess relevance and return a JSON array. Score 0–10:
- 8–10 (HIGH): Directly relevant accelerators, grants, investors, or regulatory programmes Veloxis could apply to / benefit from now.
- 6–7 (MEDIUM): Plausibly relevant, worth monitoring.
- 0–5 (LOW): Tangential or off-topic — exclude these from your output.

ONLY return items scoring 6 or higher. For each item return:
{ "title": string, "url": string, "summary": string (1–2 sentences, plain text), "organisation": string (issuer/host), "deadline": string|null (ISO date if found, else null), "amount": string|null (e.g. "£50k", "$2M", else null), "fit": "HIGH"|"MEDIUM"|"LOW", "score": number }

Search query: "${query}" (category: ${category})

Results:
${results.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.link}\n   ${r.snippet ?? ""}`).join("\n\n")}

Return ONLY a JSON array, no prose, no markdown fences.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    console.error("Claude error", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "[]";
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return arr.filter((x: any) => typeof x?.score === "number" && x.score >= 6);
  } catch (e) {
    console.error("Parse error", e, text.slice(0, 500));
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const runDate = new Date().toISOString().slice(0, 10);
  let queriesRun = 0;
  let resultsFound = 0;
  let newAdded = 0;
  let status = "success";

  try {
    for (const { query, category } of QUERIES) {
      queriesRun++;
      try {
        const results = await serperSearch(query);
        resultsFound += results.length;
        if (results.length === 0) continue;

        const scored = await scoreWithClaude(query, category, results);

        for (const item of scored) {
          // Dedupe by URL
          const { data: existing } = await supabase
            .from("opportunities").select("id").eq("url", item.url).maybeSingle();
          if (existing) continue;

          const { error } = await supabase.from("opportunities").insert({
            title: item.title,
            category,
            organisation: item.organisation ?? null,
            deadline: item.deadline ?? null,
            amount: item.amount ?? null,
            fit: item.fit,
            score: item.score,
            url: item.url,
            summary: item.summary,
            status: "To Review",
            date_found: runDate,
            search_query: query,
          });
          if (error) console.error("Insert error", error, item.url);
          else newAdded++;
        }
      } catch (e) {
        console.error(`Query failed: ${query}`, e);
      }
    }
  } catch (e) {
    status = "error";
    console.error("Scan failed", e);
  }

  await supabase.from("cron_log").insert({
    run_date: runDate,
    queries_run: queriesRun,
    results_found: resultsFound,
    new_added: newAdded,
    status,
  });

  return new Response(
    JSON.stringify({ run_date: runDate, queries_run: queriesRun, results_found: resultsFound, new_added: newAdded, status }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
