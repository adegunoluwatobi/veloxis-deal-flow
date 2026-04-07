import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ENTITY_TYPE_LABELS, type KycStatus, type EntityType } from '@/types';
import { cn } from '@/lib/utils';
import { computeKycStatus } from '@/lib/computeKycStatus';

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  entity_type: EntityType;
  director_name: string;
  kyc_status: KycStatus;
  created_at: string;
}

// Docs per exporter for live KYC computation
interface ExporterDocRow {
  exporter_id: string;
  document_type: string;
  document_status: string;
  expiry_status: string;
  is_superseded: boolean;
}

export default function ExportersList() {
  const { user, role } = useAuth();
  const [exporters, setExporters] = useState<ExporterRow[]>([]);
  const [exporterDocs, setExporterDocs] = useState<ExporterDocRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const isVeloxis = role === 'super_admin' || role === 'deal_manager';

      if (isVeloxis) {
        // Only show exporters who have at least one deal at sent_to_veloxis or beyond
        const veloxisStatuses = [
          'sent_to_veloxis', 'under_review', 'docs_requested', 'ready_for_final_approval',
          'rejection_pending_approval', 'approved', 'rejected', 'ipu_sent', 'ipu_expired',
          'ipu_signed_awaiting_funding', 'funded_active', 'repayment_due', 'overdue',
          'closed_repaid', 'closed_partial', 'rejected_by_veloxis',
        ];
        const { data: deals } = await supabase.from('deals')
          .select('exporter_id')
          .in('status', veloxisStatuses);
        const exporterIds = [...new Set((deals ?? []).map(d => d.exporter_id))];

        if (exporterIds.length === 0) {
          setExporters([]);
          setLoading(false);
          return;
        }

        const { data } = await supabase.from('exporters')
          .select('id, company_name, rc_number, entity_type, director_name, kyc_status, created_at')
          .in('id', exporterIds)
          .order('created_at', { ascending: false });
        setExporters((data as ExporterRow[]) ?? []);

        const ids = (data ?? []).map(e => e.id);
        if (ids.length > 0) {
          const { data: docs } = await supabase
            .from('exporter_documents')
            .select('exporter_id, document_type, document_status, expiry_status, is_superseded')
            .in('exporter_id', ids)
            .eq('is_superseded', false);
          setExporterDocs((docs as ExporterDocRow[]) ?? []);
        }
      } else {
        let query = supabase.from('exporters').select('id, company_name, rc_number, entity_type, director_name, kyc_status, created_at')
          .order('created_at', { ascending: false });
        if (role === 'partner_staff' || role === 'partner_admin') {
          query = query.eq('originator_id', user.id);
        }
        const { data } = await query;
        const ids = (data ?? []).map(e => e.id);
        setExporters((data as ExporterRow[]) ?? []);

        if (ids.length > 0) {
          const { data: docs } = await supabase
            .from('exporter_documents')
            .select('exporter_id, document_type, document_status, expiry_status, is_superseded')
            .in('exporter_id', ids)
            .eq('is_superseded', false);
          setExporterDocs((docs as ExporterDocRow[]) ?? []);
        }
      }
      setLoading(false);
    };
    load();
  }, [user, role]);

  const filtered = exporters.filter((e) =>
    e.company_name.toLowerCase().includes(search.toLowerCase()) ||
    e.rc_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exporters</h1>
          <p className="text-sm text-muted-foreground">Nigerian SME profiles</p>
        </div>
        {(role === 'partner_staff' || role === 'partner_admin') && (
          <Button asChild>
            <Link to="/exporters/new"><Plus className="mr-2 h-4 w-4" />New Exporter</Link>
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by company name or RC number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {search ? 'No exporters match your search.' : 'No exporters yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((exp) => (
            <Link
              key={exp.id}
              to={`/exporters/${exp.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium text-foreground">{exp.company_name}</p>
                <p className="text-sm text-muted-foreground">
                  RC {exp.rc_number} · {ENTITY_TYPE_LABELS[exp.entity_type]} · {exp.director_name}
                </p>
              </div>
              {(() => {
                const docs = exporterDocs.filter(d => d.exporter_id === exp.id);
                const kyc = computeKycStatus(docs);
                return (
                  <Badge variant="secondary" className={cn('font-medium', kyc.color)}>
                    {kyc.label}
                  </Badge>
                );
              })()}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
