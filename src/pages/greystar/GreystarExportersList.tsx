import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MailCheck, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  KYC_STATUS_LABELS, ENTITY_TYPE_LABELS,
  ONBOARDING_STATUS_LABELS, ONBOARDING_STATUS_COLORS,
  type KycStatus, type EntityType, type OnboardingStatus,
} from '@/types';
import { cn } from '@/lib/utils';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const KYC_COLORS: Record<KycStatus, string> = {
  pending_documents: 'bg-muted text-muted-foreground',
  documents_uploaded: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  verified: 'bg-success/10 text-success',
  kyc_document_expired: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
};

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  entity_type: EntityType;
  director_name: string;
  kyc_status: KycStatus;
  contact_email: string | null;
  created_at: string;
  forwarded_to_veloxis_at: string | null;
  onboarding_status: OnboardingStatus;
}

export default function GreystarExportersList() {
  const [exporters, setExporters] = useState<ExporterRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('exporters')
        .select('id, company_name, rc_number, entity_type, director_name, kyc_status, contact_email, created_at, forwarded_to_veloxis_at, onboarding_status')
        .order('created_at', { ascending: false });
      setExporters((data as ExporterRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = exporters.filter((e) =>
    e.company_name.toLowerCase().includes(search.toLowerCase()) ||
    e.rc_number.toLowerCase().includes(search.toLowerCase()) ||
    (e.contact_email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exporters</h1>
          <p className="text-sm text-muted-foreground">Nigerian SME profiles managed by your organisation</p>
        </div>
        <Button asChild>
          <Link to="/greystar/exporters/new"><Plus className="mr-2 h-4 w-4" />New Exporter</Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by company, RC number, or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">{search ? 'No match.' : 'No exporters yet.'}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((exp) => (
            <Link
              key={exp.id}
              to={`/greystar/exporters/${exp.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium text-foreground">{exp.company_name}</p>
                <p className="text-sm text-muted-foreground">
                  RC {exp.rc_number} · {ENTITY_TYPE_LABELS[exp.entity_type]} · {exp.contact_email ?? 'No email'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={cn('flex items-center gap-1 text-xs font-medium', ONBOARDING_STATUS_COLORS[exp.onboarding_status])}>
                  {exp.onboarding_status === 'invited' ? <Clock className="h-3 w-3" /> : <MailCheck className="h-3 w-3" />}
                  {ONBOARDING_STATUS_LABELS[exp.onboarding_status]}
                </Badge>
                {exp.forwarded_to_veloxis_at && (
                  <Badge variant="outline" className="text-xs">Forwarded</Badge>
                )}
                <Badge variant="secondary" className={cn('font-medium', KYC_COLORS[exp.kyc_status])}>
                  {KYC_STATUS_LABELS[exp.kyc_status]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
