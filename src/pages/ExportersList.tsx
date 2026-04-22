import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ENTITY_TYPE_LABELS, formatEntityType, type KycStatus, type EntityType } from '@/types';
import { cn } from '@/lib/utils';
import { computeKycStatus } from '@/lib/computeKycStatus';

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  entity_type: EntityType;
  director_name: string;
  kyc_status: KycStatus;
  kyc_verified_at?: string | null;
  created_at: string;
  country?: string | null;
  is_active?: boolean;
  originator_id?: string;
}

interface ExporterDocRow {
  exporter_id: string;
  document_type: string;
  document_status: string;
  expiry_status: string;
  is_superseded: boolean;
}

interface AdminExporterRow extends ExporterRow {
  partner_name: string;
  commodity: string;
  deal_count: number;
}

export default function ExportersList() {
  const { user, role } = useAuth();
  const [exporters, setExporters] = useState<ExporterRow[]>([]);
  const [adminRows, setAdminRows] = useState<AdminExporterRow[]>([]);
  const [exporterDocs, setExporterDocs] = useState<ExporterDocRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const isVeloxis = role === 'super_admin' || role === 'deal_manager';

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (isVeloxis) {
        // Admin / Veloxis view: directory of all exporters that have been activated
        // (i.e. assigned to a partner). Excludes anything still in Routed/Expansion queue.
        const { data: exps } = await supabase
          .from('exporters')
          .select('id, company_name, rc_number, entity_type, director_name, kyc_status, kyc_verified_at, created_at, country, is_active, originator_id')
          .order('created_at', { ascending: false });

        const exporterList = (exps as ExporterRow[]) ?? [];
        const ids = exporterList.map(e => e.id);
        const originatorIds = [...new Set(exporterList.map(e => e.originator_id).filter(Boolean) as string[])];

        const [rolesRes, appsRes, dealsRes, docsRes] = await Promise.all([
          originatorIds.length > 0
            ? supabase.from('user_roles')
                .select('user_id, partner_organisation_id, role, partner_organisations(name)')
                .in('user_id', originatorIds)
                .in('role', ['partner_admin', 'partner_staff'])
            : Promise.resolve({ data: [] as any[] }),
          ids.length > 0
            ? supabase.from('exporter_applications' as any)
                .select('exporter_id, commodity')
                .in('exporter_id', ids)
            : Promise.resolve({ data: [] as any[] }),
          ids.length > 0
            ? supabase.from('deals')
                .select('exporter_id')
                .in('exporter_id', ids)
            : Promise.resolve({ data: [] as any[] }),
          ids.length > 0
            ? supabase.from('exporter_documents')
                .select('exporter_id, document_type, document_status, expiry_status, is_superseded')
                .in('exporter_id', ids)
                .eq('is_superseded', false)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        setExporterDocs(((docsRes as any).data as ExporterDocRow[]) ?? []);

        const partnerByOriginator = new Map<string, string>();
        ((rolesRes as any).data ?? []).forEach((r: any) => {
          const name = r.partner_organisations?.name ?? '—';
          if (!partnerByOriginator.has(r.user_id)) partnerByOriginator.set(r.user_id, name);
        });
        const commodityByExporter = new Map<string, string>();
        ((appsRes as any).data ?? []).forEach((a: any) => {
          if (a.exporter_id && a.commodity) commodityByExporter.set(a.exporter_id, a.commodity);
        });
        const dealCountByExporter = new Map<string, number>();
        ((dealsRes as any).data ?? []).forEach((d: any) => {
          dealCountByExporter.set(d.exporter_id, (dealCountByExporter.get(d.exporter_id) ?? 0) + 1);
        });

        setAdminRows(exporterList.map(e => ({
          ...e,
          partner_name: e.originator_id ? (partnerByOriginator.get(e.originator_id) ?? '—') : '—',
          commodity: commodityByExporter.get(e.id) ?? '—',
          deal_count: dealCountByExporter.get(e.id) ?? 0,
        })));
        setLoading(false);
        return;
      }

      // Partner / originator view (unchanged)
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
      setLoading(false);
    };
    load();
  }, [user, role, isVeloxis]);

  // ===== Admin / Veloxis view =====
  if (isVeloxis) {
    const filteredAdmin = adminRows.filter(e =>
      e.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.country ?? '').toLowerCase().includes(search.toLowerCase()) ||
      e.partner_name.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exporters</h1>
          <p className="text-sm text-muted-foreground">Permanent exporter directory — populated when an application is assigned to a partner</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by company, country, or partner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <p className="py-10 text-center text-muted-foreground">Loading…</p>
        ) : filteredAdmin.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {search ? 'No exporters match your search.' : 'No exporters yet. Assign a routed application to a partner to populate this directory.'}
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {['Company', 'Country', 'Commodity', 'Assigned Partner', 'KYC Status', 'Deals'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAdmin.map(exp => {
                  const docs = exporterDocs.filter(d => d.exporter_id === exp.id);
                  const kyc = computeKycStatus(docs, 0, true, exp.kyc_verified_at ?? null);
                  return (
                    <tr key={exp.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/exporters/${exp.id}`} className="font-medium text-foreground hover:underline">
                          {exp.company_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{exp.country ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{exp.commodity}</td>
                      <td className="px-4 py-3 text-muted-foreground">{exp.partner_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={cn('font-medium', kyc.color)}>
                          {kyc.badgeLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{exp.deal_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ===== Partner / originator view =====
  const filtered = exporters.filter((e) =>
    e.company_name.toLowerCase().includes(search.toLowerCase()) ||
    e.rc_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exporters</h1>
          <p className="text-sm text-muted-foreground">Exporter profiles</p>
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
                  RC {exp.rc_number} · {formatEntityType(exp.entity_type)} · {exp.director_name}
                </p>
              </div>
              {(() => {
                const docs = exporterDocs.filter(d => d.exporter_id === exp.id);
                const kyc = computeKycStatus(docs, 0, true, exp.kyc_verified_at ?? null);
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
