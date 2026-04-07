import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find funded_active deals where repayment_due_date has passed
    const today = new Date().toISOString().split('T')[0];

    const { data: overdue, error } = await supabase
      .from('deals')
      .select('id, deal_reference, repayment_due_date, exporter_id')
      .eq('status', 'funded_active')
      .not('repayment_due_date', 'is', null)
      .lte('repayment_due_date', today);

    if (error) throw error;

    let updated = 0;
    for (const deal of overdue ?? []) {
      const { error: updateErr } = await supabase
        .from('deals')
        .update({ status: 'overdue' })
        .eq('id', deal.id);

      if (!updateErr) {
        updated++;
        // Log the auto-transition
        await supabase.rpc('insert_audit_log', {
          p_deal_id: deal.id,
          p_action_type: 'deal_overdue',
          p_metadata: {
            auto: true,
            repayment_due_date: deal.repayment_due_date,
            checked_at: today,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({ checked: (overdue ?? []).length, updated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
