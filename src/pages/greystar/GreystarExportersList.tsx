import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MailCheck, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ENTITY_TYPE_LABELS, type EntityType, type OnboardingStatus } from '@/types';
import { cn } from '@/lib/utils';
import { computeKycStatus, groupDocumentsByExporter, type KycDocumentLike } from '@/lib/computeKycStatus';

type DisplayStatus = OnboardingStatus | 'invite_expired';

const EXPORTER_STATUS_META: Record<DisplayStatus, { label: string; className: string; icon: 'pending' | 'accepted' | 'approved' | 'attention' | 'expired' }> = {
  invited: { label: 'Invite Pending', className: 'bg-warning/10 text-warning', icon: 'pending' },
  invite_expired: { label: 'Invite Expired', className: 'bg-destructive/10 text-destructive', icon: 'expired' },
  password_set: { label: 'Invite Accepted', className: 'bg-primary/10 text-primary', icon: 'accepted' },
  onboarding_in_progress: { label: 'Invite Accepted', className: 'bg-primary/10 text-primary', icon: 'accepted' },
  onboarding_submitted: { label: 'Onboarding Submitted', className: 'bg-warning/10 text-warning', icon: 'pending' },
  onboarding_approved: { label: 'Approved', className: 'bg-success/10 text-success', icon: 'approved' },
  onboarding_rejected: { label: 'Needs Changes', className: 'bg-destructive/10 text-destructive', icon: 'attention' },
};

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  entity_type: EntityType;
  director_name: string;
  contact_email: string | null;
  created_at: string;
  forwarded_to_veloxis_at: string | null;
  onboarding_status: OnboardingStatus;
  invite_sent_at: string | null;
  invite_accepted_at: string | null;
}

interface ExporterDocumentRow extends KycDocumentLike {
  exporter_id: string;
  is_superseded: boolean;
}

function getDisplayStatus(exporter: ExporterRow): DisplayStatus {
  if (
    exporter.onboarding_status === 'invited' &&
    !exporter.invite_accepted_at &&
    exporter.invite_sent_at &&
    Date.now() - new Date(exporter.invite_sent_at).getTime() > 7 * 24 * 60 * 60 * 1000
  ) {
    return 'invite_expired';
  }
  return exporter.onboarding_status;
}

type FilterTab = 'all';

export default function GreystarExportersList() {
  const [exporters, setExporters] = useState<ExporterRow[]>([]);
  const [exporterDocs, setExporterDocs] = useState<ExporterDocumentRow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: exporterData } = await supabase
        .from('exporters')
        .select('id, company_name, rc_number, entity_type, director_name, contact_email, created_at, forwarded_to_veloxis_at, onboarding_status, invite_sent_at, invite_accepted_at')
        .order('created_at', { ascending: false });

      const exportersList = (exporterData as ExporterRow[]) ?? [];
      const exporterIds = exportersList.map((exporter) => exporter.id);
      setExporters(exportersList);

      if (exporterIds.length > 0) {
        const { data: docsData } = await supabase
          .from('exporter_documents')
          .select('exporter_id, document_type, document_status, expiry_status, is_superseded')
          .in('exporter_id', exporterIds)
          .eq('is_superseded', false);

        setExporterDocs((docsData as ExporterDocumentRow[]) ?? []);
      } else {
        setExporterDocs([]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const docsByExporter = groupDocumentsByExporter(exporterDocs);

  const filtered = exporters.filter((exporter) => {
    const matchesSearch =
      exporter.company_name.toLowerCase().includes(search.toLowerCase()) ||
      exporter.rc_number.toLowerCase().includes(search.toLowerCase()) ||
      (exporter.contact_email ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });


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
          {filtered.map((exporter) => {
            const statusMeta = EXPORTER_STATUS_META[getDisplayStatus(exporter)];
            const kyc = computeKycStatus(docsByExporter.get(exporter.id) ?? []);

            return (
              <Link
                key={exporter.id}
                to={`/greystar/exporters/${exporter.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium text-foreground">{exporter.company_name}</p>
                  <p className="text-sm text-muted-foreground">
                    RC {exporter.rc_number} · {ENTITY_TYPE_LABELS[exporter.entity_type]} · {exporter.contact_email ?? 'No email'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={cn('flex items-center gap-1 text-xs font-medium', statusMeta.className)}>
                    {statusMeta.icon === 'pending' && <Clock className="h-3 w-3" />}
                    {statusMeta.icon === 'accepted' && <MailCheck className="h-3 w-3" />}
                    {statusMeta.icon === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                    {statusMeta.icon === 'attention' && <AlertTriangle className="h-3 w-3" />}
                    {statusMeta.icon === 'expired' && <XCircle className="h-3 w-3" />}
                    {statusMeta.label}
                  </Badge>
                  <Badge variant="secondary" className={cn('font-medium', kyc.color)}>
                    {kyc.badgeLabel}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}