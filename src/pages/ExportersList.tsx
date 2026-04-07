import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { KYC_STATUS_LABELS, ENTITY_TYPE_LABELS, type KycStatus, type EntityType } from '@/types';
import { cn } from '@/lib/utils';

interface ExporterRow {
  id: string;
  company_name: string;
  rc_number: string;
  entity_type: EntityType;
  director_name: string;
  kyc_status: KycStatus;
  created_at: string;
}

const KYC_COLORS: Record<KycStatus, string> = {
  pending_documents: 'bg-muted text-muted-foreground',
  documents_uploaded: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  verified: 'bg-success/10 text-success',
  kyc_document_expired: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function ExportersList() {
  const { user, role } = useAuth();
  const [exporters, setExporters] = useState<ExporterRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      let query = supabase.from('exporters').select('id, company_name, rc_number, entity_type, director_name, kyc_status, created_at')
        .order('created_at', { ascending: false });
      if (role === 'partner_staff' || role === 'partner_admin') {
        query = query.eq('originator_id', user.id);
      }
      const { data } = await query;
      setExporters((data as ExporterRow[]) ?? []);
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
        {(role === 'originator_staff' || role === 'originator_admin') && (
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
              <Badge variant="secondary" className={cn('font-medium', KYC_COLORS[exp.kyc_status])}>
                {KYC_STATUS_LABELS[exp.kyc_status]}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
