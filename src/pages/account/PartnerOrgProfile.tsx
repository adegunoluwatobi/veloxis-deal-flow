import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Info, Loader2, Building2 } from 'lucide-react';

const TEAL = '#0BA4A4';

export default function PartnerOrgProfile() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [countriesText, setCountriesText] = useState('');

  const { data: orgRoleRow } = useQuery({
    queryKey: ['user_role_org', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('user_roles').select('partner_organisation_id, role').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const orgId = orgRoleRow?.partner_organisation_id ?? null;

  const { data: org, isLoading } = useQuery({
    queryKey: ['partner_org_self', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase.from('partner_organisations').select('*').eq('id', orgId).maybeSingle();
      return data;
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name ?? '',
        registered_address_line1: org.registered_address_line1 ?? '',
        registered_address_line2: org.registered_address_line2 ?? '',
        registered_city: org.registered_city ?? '',
        registered_postcode: org.registered_postcode ?? '',
        registered_country: org.registered_country ?? '',
        primary_contact_name: org.primary_contact_name ?? '',
        primary_contact_email: org.primary_contact_email ?? '',
        primary_contact_phone: org.primary_contact_phone ?? '',
      });
      setCountriesText((org.operating_countries ?? []).join(', '));
    }
  }, [org]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!orgId) return;
    if (role !== 'partner_admin') {
      toast.error('Only Partner Admins can edit organisation details');
      return;
    }
    if (!form.name?.trim()) { toast.error('Organisation name is required'); return; }
    setSaving(true);
    const operating_countries = countriesText.split(',').map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from('partner_organisations').update({
      name: form.name.trim(),
      registered_address_line1: form.registered_address_line1?.trim() || null,
      registered_address_line2: form.registered_address_line2?.trim() || null,
      registered_city: form.registered_city?.trim() || null,
      registered_postcode: form.registered_postcode?.trim() || null,
      registered_country: form.registered_country?.trim() || null,
      primary_contact_name: form.primary_contact_name?.trim() || null,
      primary_contact_email: form.primary_contact_email?.trim() || null,
      primary_contact_phone: form.primary_contact_phone?.trim() || null,
      operating_countries,
    }).eq('id', orgId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('✓ Organisation updated successfully.');
    queryClient.invalidateQueries({ queryKey: ['partner_org_self', orgId] });
  };

  if (isLoading) return <Skeleton className="h-96" />;
  if (!org) return <p className="text-muted-foreground">No organisation found for your account.</p>;

  const readOnly = role !== 'partner_admin';

  return (
    <div className="space-y-6 max-w-4xl">
      <Helmet><title>Organisation Profile · Veloxis</title></Helmet>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" /> Organisation Profile</h1>
        <p className="text-sm text-muted-foreground">{readOnly ? 'View your organisation details.' : 'Update your organisation contact details.'}</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Organisation details are visible to Veloxis administrators.</AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle>Organisation Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Organisation name *" value={form.name} onChange={(v) => update('name', v)} disabled={readOnly} />
            <Field label="Operating countries (comma separated)" value={countriesText} onChange={setCountriesText} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Registered Address</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Address line 1" value={form.registered_address_line1} onChange={(v) => update('registered_address_line1', v)} disabled={readOnly} />
            <Field label="Address line 2" value={form.registered_address_line2} onChange={(v) => update('registered_address_line2', v)} disabled={readOnly} />
            <Field label="City" value={form.registered_city} onChange={(v) => update('registered_city', v)} disabled={readOnly} />
            <Field label="Postcode" value={form.registered_postcode} onChange={(v) => update('registered_postcode', v)} disabled={readOnly} />
            <Field label="Country" value={form.registered_country} onChange={(v) => update('registered_country', v)} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Primary Contact</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Contact name" value={form.primary_contact_name} onChange={(v) => update('primary_contact_name', v)} disabled={readOnly} />
            <Field label="Contact email" type="email" value={form.primary_contact_email} onChange={(v) => update('primary_contact_email', v)} disabled={readOnly} />
            <Field label="Contact phone" value={form.primary_contact_phone} onChange={(v) => update('primary_contact_phone', v)} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: TEAL, color: '#fff' }} className="hover:opacity-90">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
          </Button>
        </div>
      )}

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle>Your profile as Veloxis sees it</CardTitle>
          <CardDescription>Read-only summary visible to Veloxis administrators.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm grid gap-2">
          <Row k="Organisation" v={org.name} />
          <Row k="Country" v={org.registered_country ?? org.country ?? '—'} />
          <Row k="Primary contact" v={org.primary_contact_name ? `${org.primary_contact_name} · ${org.primary_contact_email ?? ''}` : '—'} />
          <Row k="Operating countries" v={(org.operating_countries ?? []).length ? (org.operating_countries ?? []).join(', ') : '—'} />
          <Row k="Status" v={<Badge variant={org.is_active ? 'default' : 'destructive'}>{org.is_active ? 'Active' : 'Suspended'}</Badge>} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, disabled, type }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value ?? ''} type={type} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>;
}
