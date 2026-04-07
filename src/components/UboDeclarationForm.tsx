import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Users } from 'lucide-react';

interface UboRow {
  id: string;
  full_name: string;
  nationality: string;
  date_of_birth: string;
  residential_address: string;
  ownership_percentage: number;
}

interface UboFormEntry {
  id?: string;
  full_name: string;
  nationality: string;
  date_of_birth: string;
  residential_address: string;
  ownership_percentage: string;
}

const EMPTY_UBO: UboFormEntry = {
  full_name: '',
  nationality: '',
  date_of_birth: '',
  residential_address: '',
  ownership_percentage: '',
};

interface Props {
  exporterId: string;
  readOnly?: boolean;
}

export default function UboDeclarationForm({ exporterId, readOnly = false }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ubos, setUbos] = useState<UboFormEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('ubo_declarations')
        .select('*')
        .eq('exporter_id', exporterId)
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        setUbos(data.map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          nationality: u.nationality,
          date_of_birth: u.date_of_birth,
          residential_address: u.residential_address,
          ownership_percentage: String(u.ownership_percentage),
        })));
      } else {
        setUbos([{ ...EMPTY_UBO }]);
      }
      setLoaded(true);
    };
    load();
  }, [exporterId]);

  const addUbo = () => setUbos([...ubos, { ...EMPTY_UBO }]);
  
  const removeUbo = async (index: number) => {
    const entry = ubos[index];
    if (entry.id) {
      await supabase.from('ubo_declarations').delete().eq('id', entry.id);
    }
    setUbos(ubos.filter((_, i) => i !== index));
  };

  const updateUbo = (index: number, field: keyof UboFormEntry, value: string) => {
    const updated = [...ubos];
    updated[index] = { ...updated[index], [field]: value };
    setUbos(updated);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const ubo of ubos) {
        const pct = parseFloat(ubo.ownership_percentage);
        if (!ubo.full_name.trim() || !ubo.nationality.trim() || !ubo.date_of_birth || !ubo.residential_address.trim() || isNaN(pct) || pct < 25 || pct > 100) {
          toast({ title: 'Validation error', description: 'All UBO fields are required. Ownership must be 25-100%.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const payload = {
          exporter_id: exporterId,
          full_name: ubo.full_name.trim(),
          nationality: ubo.nationality.trim(),
          date_of_birth: ubo.date_of_birth,
          residential_address: ubo.residential_address.trim(),
          ownership_percentage: pct,
        };
        if (ubo.id) {
          const { error } = await supabase.from('ubo_declarations').update(payload).eq('id', ubo.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('ubo_declarations').insert(payload).select('id').single();
          if (error) throw error;
          ubo.id = data.id;
        }
      }
      toast({ title: 'UBO declarations saved' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  const totalPct = ubos.reduce((sum, u) => sum + (parseFloat(u.ownership_percentage) || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> UBO Declaration
        </CardTitle>
        <CardDescription>
          List all persons owning 25% or more of the business (Ultimate Beneficial Owners).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ubos.map((ubo, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">UBO #{i + 1}</span>
              {!readOnly && ubos.length > 1 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => removeUbo(i)}>
                  <Trash2 className="mr-1 h-3 w-3" /> Remove
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name *</Label>
                <Input value={ubo.full_name} onChange={e => updateUbo(i, 'full_name', e.target.value)} placeholder="Full legal name" disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nationality *</Label>
                <Input value={ubo.nationality} onChange={e => updateUbo(i, 'nationality', e.target.value)} placeholder="e.g. Nigerian" disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date of Birth *</Label>
                <Input type="date" value={ubo.date_of_birth} onChange={e => updateUbo(i, 'date_of_birth', e.target.value)} disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ownership % *</Label>
                <Input type="number" min="25" max="100" value={ubo.ownership_percentage} onChange={e => updateUbo(i, 'ownership_percentage', e.target.value)} placeholder="25-100" disabled={readOnly} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Residential Address *</Label>
              <Input value={ubo.residential_address} onChange={e => updateUbo(i, 'residential_address', e.target.value)} placeholder="Full residential address" disabled={readOnly} />
            </div>
          </div>
        ))}

        {totalPct > 0 && (
          <p className={`text-xs ${totalPct > 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
            Total ownership declared: {totalPct}%
          </p>
        )}

        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addUbo} className="gap-1">
              <Plus className="h-3 w-3" /> Add UBO
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save UBO Declarations'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
