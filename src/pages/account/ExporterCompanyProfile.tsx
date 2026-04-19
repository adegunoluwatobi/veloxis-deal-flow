import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Info, Loader2, Building2, History } from 'lucide-react';

const TEAL = '#0BA4A4';

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  director_name: string;
  vat_number: string | null;
  primary_commodity: string | null;
  registered_address_line1: string | null;
  registered_address_line2: string | null;
  registered_city: string | null;
  registered_postcode: string | null;
  registered_country: string | null;
  trading_address_line1: string | null;
  trading_address_line2: string | null;
  trading_city: string | null;
  trading_postcode: string | null;
  trading_country: string | null;
  trading_address_same_as_registered: boolean;
  kyc_status: string;
}

const FIELDS: Array<keyof ExporterRow> = [
  'company_name', 'rc_number', 'director_name', 'vat_number', 'primary_commodity',
  'registered_address_line1', 'registered_address_line2', 'registered_city',
  'registered_postcode', 'registered_country',
  'trading_address_line1', 'trading_address_line2', 'trading_city',
  'trading_postcode', 'trading_country', 'trading_address_same_as_registered',
];

export default function ExporterCompanyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<ExporterRow>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: exporter, isLoading } = useQuery({
    queryKey: ['exporter_self', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('exporters')
        .select('*')
        .eq('exporter_user_id', user.id)
        .maybeSingle();
      return data as ExporterRow | null;
    },
    enabled: !!user?.id,
  });

  const { data: pendingRequest } = useQuery({
    queryKey: ['exporter_change_request_pending', exporter?.id],
    queryFn: async () => {
      if (!exporter?.id) return null;
      const { data } = await supabase
        .from('kyc_profile_change_requests')
        .select('*')
        .eq('exporter_id', exporter.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!exporter?.id,
  });

  const { data: history } = useQuery({
    queryKey: ['exporter_change_history', exporter?.id],
    queryFn: async () => {
      if (!exporter?.id) return [];
      const { data } = await supabase
        .from('kyc_profile_change_requests')
        .select('*')
        .eq('exporter_id', exporter.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!exporter?.id,
  });

  useEffect(() => {
    if (exporter) {
      const init: Partial<ExporterRow> = {};
      FIELDS.forEach((f) => {
        let val = (exporter as any)[f] ?? '';
        // Strip legacy "PENDING" placeholder so the field shows empty
        if (f === 'rc_number' && typeof val === 'string' && val.trim().toUpperCase() === 'PENDING') {
          val = '';
        }
        (init as any)[f] = val;
      });
      setForm(init);
    }
  }, [exporter]);

  const update = (k: keyof ExporterRow, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!user?.id || !exporter) return;
    if (!form.company_name?.toString().trim()) { toast.error('Company name is required'); return; }
    if (!form.director_name?.toString().trim()) { toast.error('Director name is required'); return; }

    // Build payload directly for the exporters table
    const cleanString = (v: unknown) => {
      if (typeof v !== 'string') return v ?? null;
      const t = v.trim();
      return t === '' ? null : t;
    };

    const payload = {
      company_name: cleanString(form.company_name) ?? exporter.company_name,
      rc_number: cleanString(form.rc_number) ?? '',
      director_name: cleanString(form.director_name) ?? exporter.director_name,
      vat_number: cleanString(form.vat_number),
      primary_commodity: cleanString(form.primary_commodity),
      registered_address_line1: cleanString(form.registered_address_line1),
      registered_address_line2: cleanString(form.registered_address_line2),
      registered_city: cleanString(form.registered_city),
      registered_postcode: cleanString(form.registered_postcode),
      registered_country: cleanString(form.registered_country),
      trading_address_same_as_registered: !!form.trading_address_same_as_registered,
      trading_address_line1: cleanString(form.trading_address_line1),
      trading_address_line2: cleanString(form.trading_address_line2),
      trading_city: cleanString(form.trading_city),
      trading_postcode: cleanString(form.trading_postcode),
      trading_country: cleanString(form.trading_country),
    };

    setSubmitting(true);
    const { error } = await supabase
      .from('exporters')
      .update(payload as any)
      .eq('id', exporter.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Company profile updated.');
    queryClient.invalidateQueries({ queryKey: ['exporter_self', user.id] });
  };

  if (isLoading) return <Skeleton className="h-96" />;
  if (!exporter) return <p className="text-muted-foreground">No company profile found.</p>;

  const statusLabel = pendingRequest
    ? 'Pending Review'
    : exporter.kyc_status === 'verified' ? 'Verified'
    : exporter.kyc_status === 'rejected' ? 'Requires Update'
    : 'Pending Review';

  const statusVariant = pendingRequest || exporter.kyc_status !== 'verified' ? 'secondary' : 'default';

  return (
    <div className="space-y-6 max-w-4xl">
      <Helmet><title>Company Profile · Veloxis</title></Helmet>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" /> Company Profile</h1>
          <p className="text-sm text-muted-foreground">Edit your KYC company details. Changes require partner approval.</p>
        </div>
        <Badge variant={statusVariant as any}>Profile status: {statusLabel}</Badge>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Changes to your company profile will be reviewed by your assigned partner before taking effect.
        </AlertDescription>
      </Alert>

      {pendingRequest && (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertDescription>
            You have a pending change request awaiting partner review. Submitting again will create another request.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name *" value={form.company_name as string} onChange={(v) => update('company_name', v)} />
            <Field
              label="Company registration number"
              value={form.rc_number as string}
              onChange={(v) => update('rc_number', v)}
              placeholder="e.g. RC-123456"
            />
            <Field label="Director name(s) *" value={form.director_name as string} onChange={(v) => update('director_name', v)} />
            <Field label="VAT number" value={form.vat_number as string} onChange={(v) => update('vat_number', v)} />
            <Field label="Primary commodity / trade type" value={form.primary_commodity as string} onChange={(v) => update('primary_commodity', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Registered Address</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Address line 1" value={form.registered_address_line1 as string} onChange={(v) => update('registered_address_line1', v)} />
            <Field label="Address line 2" value={form.registered_address_line2 as string} onChange={(v) => update('registered_address_line2', v)} />
            <Field label="City" value={form.registered_city as string} onChange={(v) => update('registered_city', v)} />
            <Field label="Postcode" value={form.registered_postcode as string} onChange={(v) => update('registered_postcode', v)} />
            <Field label="Country" value={form.registered_country as string} onChange={(v) => update('registered_country', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trading Address</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id="same_as_registered"
              checked={!!form.trading_address_same_as_registered}
              onCheckedChange={(v) => update('trading_address_same_as_registered', !!v)}
            />
            <Label htmlFor="same_as_registered" className="text-sm font-normal">Same as registered address</Label>
          </div>
        </CardHeader>
        {!form.trading_address_same_as_registered && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Address line 1" value={form.trading_address_line1 as string} onChange={(v) => update('trading_address_line1', v)} />
              <Field label="Address line 2" value={form.trading_address_line2 as string} onChange={(v) => update('trading_address_line2', v)} />
              <Field label="City" value={form.trading_city as string} onChange={(v) => update('trading_city', v)} />
              <Field label="Postcode" value={form.trading_postcode as string} onChange={(v) => update('trading_postcode', v)} />
              <Field label="Country" value={form.trading_country as string} onChange={(v) => update('trading_country', v)} />
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ backgroundColor: TEAL, color: '#fff' }}
          className="hover:opacity-90"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Submission History</CardTitle>
          <CardDescription>Profile change submissions and their review status.</CardDescription>
        </CardHeader>
        <CardContent>
          {(!history || history.length === 0) ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <ul className="space-y-3">
              {history.map((h: any) => {
                const fieldsChanged = Object.keys(h.proposed_changes ?? {});
                return (
                  <li key={h.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0">
                    <div className="text-sm">
                      <p className="font-medium">{fieldsChanged.length} field{fieldsChanged.length === 1 ? '' : 's'} updated</p>
                      <p className="text-xs text-muted-foreground">
                        {fieldsChanged.slice(0, 5).join(', ')}{fieldsChanged.length > 5 ? '…' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(h.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={h.status === 'approved' ? 'default' : h.status === 'rejected' ? 'destructive' : 'secondary'}
                    >
                      {h.status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
