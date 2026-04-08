import { corsHeaders } from '@supabase/supabase-js/cors'

// Simple in-memory cache (persists across warm invocations)
let cachedRates: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const base = (url.searchParams.get('base') || 'GBP').toUpperCase();

    // Return cached if fresh
    if (cachedRates && cachedRates.timestamp > Date.now() - CACHE_TTL_MS) {
      return new Response(JSON.stringify({
        base,
        rates: cachedRates.rates,
        cached: true,
        updated_at: new Date(cachedRates.timestamp).toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('EXCHANGE_RATE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'EXCHANGE_RATE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`);
    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: 'Failed to fetch rates', detail: text }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    if (data.result !== 'success') {
      return new Response(JSON.stringify({ error: 'API error', detail: data }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rates: Record<string, number> = {
      GBP: data.conversion_rates.GBP ?? 1,
      USD: data.conversion_rates.USD ?? 1,
      EUR: data.conversion_rates.EUR ?? 1,
    };

    cachedRates = { rates, timestamp: Date.now() };

    return new Response(JSON.stringify({
      base,
      rates,
      cached: false,
      updated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
