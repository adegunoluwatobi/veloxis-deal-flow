import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ENTITY_TYPE_LABELS, type EntityType } from '@/types';
import { ArrowLeft, Building2, Copy, ExternalLink } from 'lucide-react';

export default function ExporterNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    rc_number: '',
    entity_type: '' as EntityType | '',
    director_name: '',
  });
  const [created, setCreated] = useState<{ exporterId: string; token: string; expiresAt: string } | null>(null);

  const isValid = form.company_name.trim() && form.rc_number.trim() && form.entity_type && form.director_name.trim();

  const handleSubmit = async () => {
    if (!user || !isValid) return;
    setLoading(true);
    try {
      const { data: exporter, error } = await supabase.from('exporters').insert({
        originator_id: user.id,
        company_name: form.company_name.trim(),
        rc_number: form.rc_number.trim(),
        entity_type: form.entity_type as EntityType,
        director_name: form.director_name.trim(),
      }).select('id').single();

      if (error) throw error;

      // Generate upload token (48h expiry)
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: tokenData, error: tokenErr } = await supabase.from('exporter_upload_tokens').insert({
        exporter_id: exporter.id,
        created_by: user.id,
        expires_at: expiresAt,
      }).select('token').single();

      if (tokenErr) throw tokenErr;

      setCreated({ exporterId: exporter.id, token: tokenData.token, expiresAt });
      toast({ title: 'Exporter created', description: 'Upload token generated successfully.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create exporter';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const uploadUrl = created ? `${window.location.origin}/upload/${created.token}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(uploadUrl);
    toast({ title: 'Copied', description: 'Upload link copied to clipboard.' });
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Please upload your KYC documents for Veloxis Deal Room using this secure link (expires in 48 hours):\n\n${uploadUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (created) {
    return (
      <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate('/exporters')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Exporters
        </Button>

        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 mb-2">
              <Building2 className="h-5 w-5 text-success" />
            </div>
            <CardTitle>Exporter Created</CardTitle>
            <CardDescription>
              Share the upload link below with the SME so they can submit their KYC documents.
              The link expires in 48 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Secure Upload Link</Label>
              <div className="mt-1 flex gap-2">
                <Input value={uploadUrl} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-2" onClick={shareWhatsApp}>
                <ExternalLink className="h-4 w-4" /> Share via WhatsApp
              </Button>
              <Button className="flex-1" onClick={() => navigate(`/exporters/${created.exporterId}`)}>
                View Exporter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate('/exporters')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Exporters
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Register New Exporter</CardTitle>
          <CardDescription>
            Enter the Nigerian SME's company details. After creation, a secure upload link
            will be generated for the SME to submit their KYC documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              placeholder="e.g. Adire Textiles Ltd"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rc_number">RC Number</Label>
            <Input
              id="rc_number"
              placeholder="e.g. RC123456"
              value={form.rc_number}
              onChange={(e) => setForm({ ...form, rc_number: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entity_type">Entity Type</Label>
            <Select value={form.entity_type} onValueChange={(v) => setForm({ ...form, entity_type: v as EntityType })}>
              <SelectTrigger>
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ENTITY_TYPE_LABELS) as [EntityType, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="director_name">Director Name</Label>
            <Input
              id="director_name"
              placeholder="Full name of primary director"
              value={form.director_name}
              onChange={(e) => setForm({ ...form, director_name: e.target.value })}
            />
          </div>
          <Button onClick={handleSubmit} disabled={!isValid || loading} className="w-full">
            {loading ? 'Creating…' : 'Create Exporter & Generate Upload Link'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
