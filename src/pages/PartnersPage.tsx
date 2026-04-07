import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Plus, Search, Building2, ArrowRight } from 'lucide-react';

interface PartnerOrg {
  id: string;
  name: string;
  country: string | null;
  admin_email: string | null;
  notes: string | null;
  is_active: boolean;
  suspended_at: string | null;
  created_at: string;
}

export default function PartnersPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [partners, setPartners] = useState<PartnerOrg[]>([]);
  const [exporterCounts, setExporterCounts] = useState<Record<string, number>>({});
  const [dealCounts, setDealCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add partner modal
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCountry, setNewCountry] = useState('Nigeria');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const load = async () => {
    const { data: orgs } = await supabase.from('partner_organisations').select('*').order('created_at', { ascending: false });
    setPartners((orgs ?? []) as PartnerOrg[]);

    // Count exporters per org by looking at originator's org
    const { data: roles } = await supabase.from('user_roles').select('user_id, partner_organisation_id').in('role', ['partner_admin', 'partner_staff']);
    const orgByUser: Record<string, string> = {};
    (roles ?? []).forEach((r: any) => { if (r.partner_organisation_id) orgByUser[r.user_id] = r.partner_organisation_id; });

    const { data: exporters } = await supabase.from('exporters').select('id, originator_id');
    const eCounts: Record<string, number> = {};
    (exporters ?? []).forEach((e: any) => {
      const orgId = orgByUser[e.originator_id];
      if (orgId) eCounts[orgId] = (eCounts[orgId] || 0) + 1;
    });
    setExporterCounts(eCounts);

    // Count active deals per org
    const { data: deals } = await supabase.from('deals').select('id, partner_organisation_id, status');
    const dCounts: Record<string, number> = {};
    (deals ?? []).forEach((d: any) => {
      if (d.partner_organisation_id) {
        dCounts[d.partner_organisation_id] = (dCounts[d.partner_organisation_id] || 0) + 1;
      }
    });
    setDealCounts(dCounts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) { toast({ title: 'Organisation name is required', variant: 'destructive' }); return; }
    if (!newEmail.trim()) { toast({ title: 'Admin email is required', variant: 'destructive' }); return; }
    setSaving(true);

    const { error } = await supabase.from('partner_organisations').insert({
      name: newName.trim(),
      country: newCountry,
      admin_email: newEmail.trim(),
      notes: newNotes.trim() || null,
    });

    if (error) {
      toast({ title: 'Failed to create partner', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Partner organisation created' });
      setShowAdd(false);
      setNewName('');
      setNewCountry('Nigeria');
      setNewEmail('');
      setNewNotes('');
      load();
    }
    setSaving(false);
  };

  const filtered = partners.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.admin_email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Partner Organisations</h1>
          <p className="text-sm text-muted-foreground">Manage partner intake portals</p>
        </div>
        {role === 'super_admin' && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Partner
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search partners…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Admin Email</TableHead>
                <TableHead className="text-center">Exporters</TableHead>
                <TableHead className="text-center">Deals</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Onboarded</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No partner organisations found.</TableCell>
                </TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {p.name}
                    </div>
                  </TableCell>
                  <TableCell>{p.country || '—'}</TableCell>
                  <TableCell className="text-sm">{p.admin_email || '—'}</TableCell>
                  <TableCell className="text-center">{exporterCounts[p.id] || 0}</TableCell>
                  <TableCell className="text-center">{dealCounts[p.id] || 0}</TableCell>
                  <TableCell>
                    {p.suspended_at ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : p.is_active ? (
                      <Badge className="bg-success/10 text-success border-success/30">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(p.created_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/admin/partners/${p.id}`}>
                        View <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Partner Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Partner Organisation</DialogTitle>
            <DialogDescription>Create a new partner intake portal. An invite will be sent to the admin email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Organisation Name <span className="text-destructive">*</span></Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Greystar Nigeria" />
            </div>
            <div>
              <Label>Country <span className="text-destructive">*</span></Label>
              <Input value={newCountry} onChange={e => setNewCountry(e.target.value)} placeholder="Nigeria" />
            </div>
            <div>
              <Label>Primary Admin Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@partner.com" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? 'Creating…' : 'Create Partner'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
