// Shared verification management UI used by both Partner Admin (scoped to own org)
// and Super Admin (global with trade-partner selector). Server-side RLS enforces scoping;
// this component only chooses which filters to expose.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  providerStatusLabel, providerStatusTone,
  reviewStatusLabel, reviewStatusTone,
  accessStatusLabel, accessStatusTone,
} from '@/lib/smileid-status';

interface PartnerOrgOption { id: string; name: string }

interface Job {
  id: string;
  subject_type: string;
  subject_id: string;
  partner_organisation_id: string | null;
  job_type: string;
  provider_job_id: string | null;
  provider_status: string;
  internal_status: string;
  partner_review_status: string;
  super_admin_review_status: string;
  final_access_status: string;
  partner_reviewed_at: string | null;
  super_admin_reviewed_at: string | null;
  partner_review_notes: string | null;
  super_admin_review_notes: string | null;
  manual_override_reason: string | null;
  result_payload: any;
  request_payload: any;
  created_at: string;
}

interface AuditEvent {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_role: string | null;
  details: any;
  created_at: string;
}

export default function VerificationManagement({ scope }: { scope: 'partner_admin' | 'super_admin' }) {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerOrgs, setPartnerOrgs] = useState<PartnerOrgOption[]>([]);
  const [filters, setFilters] = useState({ partnerOrg: 'all', jobType: 'all', providerStatus: 'all', partnerReview: 'all', superAdminReview: 'all' });
  const [selected, setSelected] = useState<Job | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [initiateOpen, setInitiateOpen] = useState(false);

  async function loadJobs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('verification_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) toast({ title: 'Failed to load verifications', description: error.message, variant: 'destructive' });
    setJobs((data ?? []) as any);
    setLoading(false);
  }

  async function loadPartnerOrgs() {
    if (scope !== 'super_admin') return;
    const { data } = await supabase.from('partner_organisations').select('id, name').eq('is_active', true).order('name');
    setPartnerOrgs((data ?? []) as any);
  }

  useEffect(() => { loadJobs(); loadPartnerOrgs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function loadAudit(jobId: string) {
    const { data } = await supabase
      .from('verification_audit_events')
      .select('*').eq('verification_job_id', jobId)
      .order('created_at', { ascending: false });
    setAudit((data ?? []) as any);
  }

  const filtered = useMemo(() => jobs.filter(j =>
    (filters.partnerOrg === 'all' || j.partner_organisation_id === filters.partnerOrg) &&
    (filters.jobType === 'all' || j.job_type === filters.jobType) &&
    (filters.providerStatus === 'all' || j.provider_status === filters.providerStatus) &&
    (filters.partnerReview === 'all' || j.partner_review_status === filters.partnerReview) &&
    (filters.superAdminReview === 'all' || j.super_admin_review_status === filters.superAdminReview)
  ), [jobs, filters]);

  async function runReview(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    const { error } = await supabase.functions.invoke('smileid-review', {
      body: { verification_job_id: selected.id, action, notes: noteDraft || undefined, ...extra },
    });
    if (error) {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Updated' });
    setNoteDraft('');
    await loadJobs();
    const { data: refreshed } = await supabase.from('verification_jobs').select('*').eq('id', selected.id).maybeSingle();
    setSelected((refreshed ?? null) as any);
    await loadAudit(selected.id);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Smile ID Verifications</CardTitle>
          <Button size="sm" onClick={() => setInitiateOpen(true)}>Initiate verification</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {scope === 'super_admin' && (
              <div>
                <Label className="text-xs">Trade partner</Label>
                <Select value={filters.partnerOrg} onValueChange={(v) => setFilters(f => ({ ...f, partnerOrg: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All partners</SelectItem>
                    {partnerOrgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={filters.jobType} onValueChange={(v) => setFilters(f => ({ ...f, jobType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="kyb">KYB</SelectItem>
                  <SelectItem value="kyc">KYC</SelectItem>
                  <SelectItem value="aml">AML</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Provider status</Label>
              <Select value={filters.providerStatus} onValueChange={(v) => setFilters(f => ({ ...f, providerStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['all','submitted','provider_pending','provider_verified','provider_failed','action_required'].map(s =>
                    <SelectItem key={s} value={s}>{s === 'all' ? 'All' : providerStatusLabel(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Partner review</Label>
              <Select value={filters.partnerReview} onValueChange={(v) => setFilters(f => ({ ...f, partnerReview: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['all','not_started','under_review','approved','rejected','action_required'].map(s =>
                    <SelectItem key={s} value={s}>{s === 'all' ? 'All' : reviewStatusLabel(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {scope === 'super_admin' && (
              <div>
                <Label className="text-xs">Final review</Label>
                <Select value={filters.superAdminReview} onValueChange={(v) => setFilters(f => ({ ...f, superAdminReview: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['all','not_started','under_review','approved','rejected','action_required'].map(s =>
                      <SelectItem key={s} value={s}>{s === 'all' ? 'All' : reviewStatusLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Partner review</th>
                  <th className="py-2 pr-3">Final review</th>
                  <th className="py-2 pr-3">Access</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Loading…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No verifications match.</td></tr>}
                {filtered.map(j => (
                  <tr key={j.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setSelected(j); loadAudit(j.id); }}>
                    <td className="py-2 pr-3">{new Date(j.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{j.subject_type}:{j.subject_id.slice(0, 8)}</td>
                    <td className="py-2 pr-3 uppercase">{j.job_type}</td>
                    <td className="py-2 pr-3"><span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${providerStatusTone(j.provider_status)}`}>{providerStatusLabel(j.provider_status)}</span></td>
                    <td className="py-2 pr-3"><span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${reviewStatusTone(j.partner_review_status)}`}>{reviewStatusLabel(j.partner_review_status)}</span></td>
                    <td className="py-2 pr-3"><span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${reviewStatusTone(j.super_admin_review_status)}`}>{reviewStatusLabel(j.super_admin_review_status)}</span></td>
                    <td className="py-2 pr-3"><span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${accessStatusTone(j.final_access_status)}`}>{accessStatusLabel(j.final_access_status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Verification detail</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Type</Label><div className="uppercase font-medium">{selected.job_type}</div></div>
                  <div><Label className="text-xs">Subject</Label><div className="font-mono text-xs">{selected.subject_type}:{selected.subject_id}</div></div>
                  <div><Label className="text-xs">Smile Job ID</Label><div className="font-mono text-xs break-all">{selected.provider_job_id ?? '—'}</div></div>
                  <div><Label className="text-xs">Created</Label><div>{new Date(selected.created_at).toLocaleString()}</div></div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Provider</Label><div><span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${providerStatusTone(selected.provider_status)}`}>{providerStatusLabel(selected.provider_status)}</span></div></div>
                  <div><Label className="text-xs">Partner</Label><div><span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${reviewStatusTone(selected.partner_review_status)}`}>{reviewStatusLabel(selected.partner_review_status)}</span></div></div>
                  <div><Label className="text-xs">Final</Label><div><span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${reviewStatusTone(selected.super_admin_review_status)}`}>{reviewStatusLabel(selected.super_admin_review_status)}</span></div></div>
                </div>

                <div>
                  <Label className="text-xs">Provider response summary</Label>
                  <pre className="text-xs bg-muted p-2 rounded max-h-48 overflow-auto">{JSON.stringify(selected.result_payload, null, 2)}</pre>
                </div>

                {selected.partner_review_notes && <div><Label className="text-xs">Partner notes</Label><div className="rounded border p-2 bg-muted/40">{selected.partner_review_notes}</div></div>}
                {selected.super_admin_review_notes && <div><Label className="text-xs">Super admin notes</Label><div className="rounded border p-2 bg-muted/40">{selected.super_admin_review_notes}</div></div>}
                {selected.manual_override_reason && <div><Label className="text-xs">Manual override reason</Label><div className="rounded border p-2 bg-amber-50 border-amber-200">{selected.manual_override_reason}</div></div>}

                <div>
                  <Label className="text-xs">Add a note for this action</Label>
                  <Textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={3} placeholder="Optional note (will be saved with the action)" />
                </div>

                {scope === 'partner_admin' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => runReview('partner_start_review')}>Start review</Button>
                    <Button size="sm" variant="outline" onClick={() => runReview('partner_request_action')}>Request action</Button>
                    <Button size="sm" onClick={() => runReview('partner_approve')}>Approve (Partner)</Button>
                    <Button size="sm" variant="destructive" onClick={() => runReview('partner_reject')}>Reject (Partner)</Button>
                  </div>
                )}

                {scope === 'super_admin' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => runReview('super_admin_start_review')}>Start review</Button>
                    <Button size="sm" variant="outline" onClick={() => runReview('super_admin_request_action')}>Request action</Button>
                    <Button size="sm" onClick={() => runReview('super_admin_approve')} disabled={selected.partner_review_status !== 'approved'} title={selected.partner_review_status !== 'approved' ? 'Partner must approve first' : ''}>Approve final</Button>
                    <Button size="sm" variant="destructive" onClick={() => runReview('super_admin_reject')}>Reject final</Button>
                    <Button size="sm" variant="outline" onClick={() => setOverrideOpen(true)}>Manual override…</Button>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Audit trail</Label>
                  <div className="space-y-1 max-h-64 overflow-y-auto border rounded p-2">
                    {audit.length === 0 && <div className="text-xs text-muted-foreground">No events yet.</div>}
                    {audit.map(ev => (
                      <div key={ev.id} className="text-xs border-b last:border-0 py-1">
                        <span className="font-mono">{new Date(ev.created_at).toLocaleString()}</span>
                        {' · '}<span className="font-medium">{ev.event_type}</span>
                        {' · '}<span className="text-muted-foreground">{ev.actor_role ?? 'system'}</span>
                        {ev.details && Object.keys(ev.details).length > 0 && (
                          <pre className="mt-1 text-[10px] bg-muted p-1 rounded">{JSON.stringify(ev.details, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Manual override dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manually mark as checked</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This bypasses normal verification gates and is fully audited. Provide a clear reason.</p>
          <Textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={4} placeholder="Reason (required, min 5 characters)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              await runReview('manual_override_check', { reason: overrideReason });
              setOverrideReason('');
              setOverrideOpen(false);
            }} disabled={overrideReason.trim().length < 5}>Confirm override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Initiate dialog */}
      <InitiateVerificationDialog open={initiateOpen} onOpenChange={setInitiateOpen} scope={scope} partnerOrgs={partnerOrgs} onCreated={loadJobs} />
    </div>
  );
}

function InitiateVerificationDialog({ open, onOpenChange, scope, partnerOrgs, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; scope: 'partner_admin' | 'super_admin';
  partnerOrgs: PartnerOrgOption[]; onCreated: () => void;
}) {
  const { toast } = useToast();
  const [kind, setKind] = useState<'kyb' | 'kyc' | 'aml'>('kyb');
  const [form, setForm] = useState<any>({ subject_type: 'exporter', country: 'NG' });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const fn = kind === 'kyb' ? 'smileid-kyb' : kind === 'aml' ? 'smileid-aml' : 'smileid-kyc';
    const { data, error } = await supabase.functions.invoke(fn, { body: form });
    setSubmitting(false);
    if (error || (data && (data as any).error)) {
      toast({ title: 'Failed', description: error?.message ?? (data as any).error, variant: 'destructive' });
      return;
    }
    const d = data as any;
    const desc = kind === 'aml'
      ? `Status: ${d.internal_status} · Hits: ${d.hits_count ?? 0} · Risk: ${d.risk_band ?? 'unknown'}`
      : `Status: ${d.internal_status}`;
    toast({ title: 'Verification initiated', description: desc });
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Initiate Smile ID verification</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Check type</Label>
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kyb">KYB — Business Verification</SelectItem>
                <SelectItem value="kyc">KYC — Identity Verification</SelectItem>
                <SelectItem value="aml">AML — PEP / Sanctions / Adverse Media</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Subject type</Label>
              <Select value={form.subject_type} onValueChange={(v) => setForm((f: any) => ({ ...f, subject_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exporter">Exporter</SelectItem>
                  <SelectItem value="partner_organisation">Partner organisation</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject ID (UUID)</Label>
              <Input value={form.subject_id ?? ''} onChange={e => setForm((f: any) => ({ ...f, subject_id: e.target.value }))} placeholder="00000000-0000-…" />
            </div>
          </div>
          {scope === 'super_admin' && (
            <div>
              <Label>Trade partner (optional)</Label>
              <Select value={form.partner_organisation_id ?? ''} onValueChange={(v) => setForm((f: any) => ({ ...f, partner_organisation_id: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Auto-detect from subject" /></SelectTrigger>
                <SelectContent>
                  {partnerOrgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Country</Label><Input value={form.country} onChange={e => setForm((f: any) => ({ ...f, country: e.target.value }))} /></div>
            {kind !== 'aml' && (
              <div><Label>ID type</Label><Input value={form.id_type ?? ''} onChange={e => setForm((f: any) => ({ ...f, id_type: e.target.value }))} placeholder={kind === 'kyb' ? 'BUSINESS_REGISTRATION' : 'NIN'} /></div>
            )}
            {kind !== 'aml' && (
              <div className="col-span-2"><Label>ID number</Label><Input value={form.id_number ?? ''} onChange={e => setForm((f: any) => ({ ...f, id_number: e.target.value }))} /></div>
            )}
          </div>
          {kind === 'kyb' && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Business type</Label><Input value={form.business_type ?? 'co'} onChange={e => setForm((f: any) => ({ ...f, business_type: e.target.value }))} placeholder="co | bn | it | lp" /></div>
              <div><Label>Business name</Label><Input value={form.business_name ?? ''} onChange={e => setForm((f: any) => ({ ...f, business_name: e.target.value }))} /></div>
            </div>
          )}
          {(kind === 'kyc' || kind === 'aml') && (
            <div className="grid grid-cols-3 gap-2">
              <div><Label>First name</Label><Input value={form.first_name ?? ''} onChange={e => setForm((f: any) => ({ ...f, first_name: e.target.value }))} /></div>
              <div><Label>Last name</Label><Input value={form.last_name ?? ''} onChange={e => setForm((f: any) => ({ ...f, last_name: e.target.value }))} /></div>
              <div><Label>DOB</Label><Input type="date" value={form.dob ?? ''} onChange={e => setForm((f: any) => ({ ...f, dob: e.target.value }))} /></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={
              submitting ||
              !form.subject_id ||
              (kind === 'aml'
                ? !form.first_name || !form.last_name || !form.dob
                : !form.id_number)
            }
          >{submitting ? 'Submitting…' : 'Initiate'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
