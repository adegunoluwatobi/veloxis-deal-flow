import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MarketingTabs from '@/components/MarketingTabs';

interface Lead {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  whatsapp_number: string;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MarketingLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('nbcc_leads')
        .select('*')
        .order('created_at', { ascending: false });
      setLeads((data as Lead[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <Helmet><title>Marketing Leads · Veloxis</title></Helmet>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Marketing Leads</h1>
        <Badge variant="secondary">{leads.length} total</Badge>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Date Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No leads yet.</TableCell></TableRow>
            ) : leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.full_name}</TableCell>
                <TableCell>{l.company_name}</TableCell>
                <TableCell><a href={`mailto:${l.email}`} className="text-primary hover:underline">{l.email}</a></TableCell>
                <TableCell>{l.whatsapp_number}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(l.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
