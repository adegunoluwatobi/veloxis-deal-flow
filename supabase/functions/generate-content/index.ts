import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SYSTEM_PROMPT = `You are the Content Generation assistant for the Veloxis platform. You generate DRAFT content only. Never output content as ready-to-send. Always return 2-3 options so a human selects and edits before posting.

You will always receive a CHANNEL parameter: SOCIAL, LANDING_PAGE, EMAIL, or COMMUNITY. Apply the correct ruleset below. Do not blend rules across channels.

GLOBAL RULES (apply to every channel, no exceptions)
- No pricing, percentages, discount rates, or advance rate figures
- No mention of Greystar Capital
- No dashes in copy, use full stops or commas
- Spell out abbreviations on first use (bracketed short form)
- Welcome topics: Agricultural commodities, solid minerals, metals, manufactured goods, textiles, timber, processed seafood
- Never fabricate stats/data/clients
- Framing: Nigeria-domiciled, funding African exporters (never UK-registered)
- Twitter/X max 280 chars

CHANNEL: SOCIAL
- Platforms: LinkedIn, Twitter/X, Instagram
- Tone: professional but human, no jargon-heavy corporate speak
- Length: LinkedIn up to 1300 chars, Twitter/X up to 280 chars, Instagram up to 2200 chars
- Include a single soft call to action per post (e.g., "Learn more", "See how it works", "Register your interest")
- Do not use hashtags on LinkedIn. Use up to 3 relevant hashtags on Twitter/X and Instagram
- Never use emojis on LinkedIn. Sparingly on Instagram, none on Twitter/X

CHANNEL: LANDING_PAGE
- Structure: Headline, sub-headline, 3 supporting points, closing CTA
- Tone: clear, confident, benefit-led
- Reading level: accessible to non-finance business owners
- No walls of text. Short paragraphs, scannable
- Never claim regulatory status or licensing

CHANNEL: EMAIL
- Structure: Subject line (max 60 chars), preview text (max 90 chars), body (max 200 words), single CTA
- Tone: direct, warm, respectful of the reader's time
- Never mass-market voice. Write as if to one person
- No pricing figures in the body

CHANNEL: COMMUNITY
- Purpose: contribute value to WhatsApp/Telegram/forum groups, never overtly sell
- Structure: opening context (1 to 2 sentences), core insight or question (2 to 4 sentences), soft close
- Length: 400 to 700 chars total
- Reference sub_category to shape the topic (e.g., "logistics", "FX", "buyer verification")
- Use known_member_context to sound relevant to that specific group
- Never post the same content across multiple groups without adaptation

OUTPUT FORMAT: Return only numbered draft options. No preamble, sign-off, or reasoning.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub;
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    const roleList = (roles ?? []).map((r: any) => r.role);
    if (!roleList.includes('super_admin') && !roleList.includes('deal_manager')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { channel, campaign_name, sub_category, recent_topics_covered, known_member_context } = body ?? {};
    if (!['SOCIAL', 'LANDING_PAGE', 'EMAIL', 'COMMUNITY'].includes(channel)) {
      return new Response(JSON.stringify({ error: 'Invalid channel' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!campaign_name || typeof campaign_name !== 'string') {
      return new Response(JSON.stringify({ error: 'campaign_name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (channel === 'COMMUNITY' && (!sub_category || !known_member_context)) {
      return new Response(JSON.stringify({ error: 'sub_category and known_member_context required for COMMUNITY' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userMessage = [
      `CHANNEL: ${channel}`,
      `campaign_name: ${campaign_name}`,
      sub_category ? `sub_category: ${sub_category}` : null,
      recent_topics_covered ? `recent_topics_covered: ${recent_topics_covered}` : null,
      known_member_context ? `known_member_context: ${known_member_context}` : null,
      '',
      'Generate 2-3 draft options following the ruleset for this channel. Numbered list only.',
    ].filter(Boolean).join('\n');

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', errText);
      return new Response(JSON.stringify({ error: 'AI request failed', details: errText }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await anthropicRes.json();
    const text = data?.content?.[0]?.text ?? '';

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
