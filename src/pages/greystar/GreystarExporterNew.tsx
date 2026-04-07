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
import { ArrowLeft, Building2, CheckCircle2 } from 'lucide-react';

export default function GreystarExporterNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ exporterId: string; email: string } | null>(null);
  const [form, setForm] = useState({
    company_name: '',
    rc_number: '',
    entity_type: '' as EntityType | '',
    director_name: '',
    contact_email: '',
  });

  const isValid = form.company_name.trim() && form.rc_number.trim() && form.entity_type && form.director_name.trim() && form.contact_email.trim();

  const handleSubmit = async () => {
    if (!user || !isValid) return;
    setLoading(true);
    try {
      // Create exporter profile
      const { data: exporter, error } = await supabase.from('exporters').insert({
        originator_id: user.id,
        company_name: form.company_name.trim(),
        rc_number: form.rc_number.trim(),
        entity_type: form.entity_type as EntityType,
        director_name: form.director_name.trim(),
        contact_email: form.contact_email.trim(),
      }).select('id').single();

      if (error) throw error;

      // Auto-invite: sign up the exporter user with the contact email
      // Generate a temporary password — the exporter will reset on first login
      const tempPassword = crypto.randomUUID().slice(0, 16) + 'Aa1!';
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.contact_email.trim(),
        password: tempPassword,
        options: {
          data: {
            full_name: form.director_name.trim(),
            organisation: form.company_name.trim(),
            role: 'exporter',
          },
        },
      });

      if (signUpError) {
        console.error('Auto-invite failed:', signUpError.message);
        toast({ title: 'Exporter created', description: 'Profile created but auto-invite failed. You can invite manually.', variant: 'default' });
      } else if (signUpData?.user) {
        // Link the exporter account
        await supabase.from('exporters').update({
          exporter_user_id: signUpData.user.id,
        }).eq('id', exporter.id);
      }

      // Generate upload token (48h) for secure upload option
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await supabase.from('exporter_upload_tokens').insert({
        exporter_id: exporter.id,
        created_by: user.id,
        expires_at: expiresAt,
      });

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_exporter_id: exporter.id,
        p_user_id: user.id,
        p_user_role: 'greystar_originator' as any,
        p_action_type: 'exporter_created' as any,
        p_metadata: { company_name: form.company_name.trim(), contact_email: form.contact_email.trim() },
      });

      setCreated({ exporterId: exporter.id, email: form.contact_email.trim() });
      toast({ title: 'Exporter created', description: 'Account invite sent to ' + form.contact_email.trim() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create exporter';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate('/greystar/exporters')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Exporters
        </Button>
        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <CardTitle>Exporter Created</CardTitle>
            <CardDescription>
              An account invitation has been sent to <strong>{created.email}</strong>.
              The exporter will receive setup details to log in and upload documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/greystar/exporters')}>
              Back to List
            </Button>
            <Button className="flex-1" onClick={() => navigate(`/greystar/exporters/${created.exporterId}`)}>
              View Exporter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate('/greystar/exporters')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Exporters
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Register New Exporter</CardTitle>
          <CardDescription>
            Enter the Nigerian SME's details. An account invite will automatically be sent
            to the exporter's contact email so they can log in and upload documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input id="company_name" placeholder="e.g. Adire Textiles Ltd" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rc_number">RC Number</Label>
            <Input id="rc_number" placeholder="e.g. RC123456" value={form.rc_number} onChange={(e) => setForm({ ...form, rc_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entity_type">Entity Type</Label>
            <Select value={form.entity_type} onValueChange={(v) => setForm({ ...form, entity_type: v as EntityType })}>
              <SelectTrigger><SelectValue placeholder="Select entity type" /></SelectTrigger>
              <SelectContent>
                {(Object.entries(ENTITY_TYPE_LABELS) as [EntityType, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="director_name">Director Name</Label>
            <Input id="director_name" placeholder="Full name of primary director" value={form.director_name} onChange={(e) => setForm({ ...form, director_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Exporter Contact Email</Label>
            <Input id="contact_email" type="email" placeholder="exporter@company.ng" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            <p className="text-xs text-muted-foreground">An account invitation will be sent to this email automatically.</p>
          </div>
          <Button onClick={handleSubmit} disabled={!isValid || loading} className="w-full">
            {loading ? 'Creating…' : 'Create Exporter & Send Invite'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
