import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/v2/useAuth';

export default function StaffSettings() {
  const { user } = useAuth();
  const [capital, setCapital] = useState('');
  const [currency, setCurrency] = useState('USD');
  useEffect(() => {
    supabase.from('v2_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) { setCapital(String(data.capital_base)); setCurrency(data.currency); }
    });
  }, []);
  const save = async () => {
    const { error } = await supabase.from('v2_settings').update({ capital_base: Number(capital), currency: currency as any, updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Saved' });
  };
  return (
    <div className="max-w-lg space-y-6">
      <div><h1 className="text-2xl">Settings</h1><p className="text-sm text-muted-foreground">Global system configuration</p></div>
      <div className="card-elevated p-6 space-y-4">
        <div><Label>Capital base</Label><Input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} /></div>
        <div><Label>Base currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{['USD', 'GBP', 'EUR'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={save}>Save</Button>
      </div>
    </div>
  );
}
