import { useState, useEffect } from 'react';
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
import { Building2, Loader2, CheckCircle2, Clock } from 'lucide-react';

export default function ExporterOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporter, setExporter] = useState<any>(null);
  const [form, setForm] = useState({
    company_name: '',
    rc_number: '',
    entity_type: '' as EntityType | '',
    director_name: '',
    contact_email: '',
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('exporters')
        .select('*')
        .eq('exporter_user_id', user.id)
        .maybeSingle();
      if (data) {
        setExporter(data);
        setForm({
          company_name: data.company_name || '',
          rc_number: data.rc_number || '',
          entity_type: data.entity_type || '',
          director_name: data.director_name || '',
          contact_email: data.contact_email || user.email || '',
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If onboarding_submitted — show pending screen
  if (exporter?.onboarding_status === 'onboarding_submitted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <Clock className="mb-4 h-12 w-12 text-warning" />
            <h2 className="text-xl font-bold text-foreground">Onboarding Pending Approval</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your onboarding details have been submitted and are awaiting review by your partner organisation. You'll be notified once approved.
            </p>
            <Button variant="outline" className="mt-6" onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If approved — redirect to dashboard
  if (exporter?.onboarding_status === 'onboarding_approved') {
    navigate('/exporter');
    return null;
  }

  const isValid = form.company_name.trim() && form.rc_number.trim() && form.entity_type && form.director_name.trim() && form.contact_email.trim();

  const handleSubmit = async () => {
    if (!user || !exporter || !isValid) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('exporters')
        .update({
          company_name: form.company_name.trim(),
          rc_number: form.rc_number.trim(),
          entity_type: form.entity_type as EntityType,
          director_name: form.director_name.trim(),
          contact_email: form.contact_email.trim(),
          onboarding_status: 'onboarding_submitted' as any,
        })
        .eq('id', exporter.id);

      if (error) throw error;

      // Audit log
      await supabase.rpc('insert_audit_log', {
        p_exporter_id: exporter.id,
        p_user_id: user.id,
        p_user_role: 'exporter' as any,
        p_action_type: 'onboarding_submitted' as any,
        p_metadata: { company_name: form.company_name.trim() },
      });

      toast({ title: 'Onboarding submitted', description: 'Your details are under review.' });
      setExporter({ ...exporter, onboarding_status: 'onboarding_submitted' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const isRejected = exporter?.onboarding_status === 'onboarding_rejected';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6 animate-fade-in">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Complete Your Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            {isRejected
              ? 'Your previous submission was returned for changes. Please update and resubmit.'
              : 'Fill in your company details to complete account setup.'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>All fields are required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input id="company_name" placeholder="e.g. Adire Textiles Ltd" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rc_number">RC Number *</Label>
              <Input id="rc_number" placeholder="e.g. RC123456" value={form.rc_number} onChange={(e) => setForm({ ...form, rc_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity_type">Entity Type *</Label>
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
              <Label htmlFor="director_name">Director Name *</Label>
              <Input id="director_name" placeholder="Full name of primary director" value={form.director_name} onChange={(e) => setForm({ ...form, director_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email *</Label>
              <Input id="contact_email" type="email" placeholder="exporter@company.ng" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <Button onClick={handleSubmit} disabled={!isValid || submitting} className="w-full">
              {submitting ? 'Submitting…' : 'Submit Onboarding'}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Trade Finance Platform</p>
      </div>
    </div>
  );
}
