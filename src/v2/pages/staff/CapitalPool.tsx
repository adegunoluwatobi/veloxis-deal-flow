import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';

export default function CapitalPool() {
  const [base, setBase] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [deployed, setDeployed] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('v2_settings').select('capital_base,currency').eq('id', 1).maybeSingle();
      if (s) { setBase(Number(s.capital_base) || 0); setCurrency(s.currency || 'USD'); }
      const { data: inv } = await supabase
        .from('v2_invoices')
        .select('invoice_amount,advance_rate,status')
        .in('status', ['funded', 'monitoring']);
      const d = (inv ?? []).reduce((sum, i: any) => sum + Number(i.invoice_amount) * (Number(i.advance_rate) / 100), 0);
      setDeployed(d);
    })();
  }, []);

  const available = Math.max(base - deployed, 0);
  const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Capital Pool</h1>
        <p className="text-sm text-muted-foreground">Base, deployed and available capital across funded invoices.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Capital base</div>
          <div className="text-2xl font-semibold mt-1">{fmt(base)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Deployed</div>
          <div className="text-2xl font-semibold mt-1">{fmt(deployed)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase text-muted-foreground">Available</div>
          <div className="text-2xl font-semibold mt-1 text-accent">{fmt(available)}</div>
        </Card>
      </div>
    </div>
  );
}
