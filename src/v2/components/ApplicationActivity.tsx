import { useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { activityLabel, packFormSchema, recipientList } from '@/v2/lib/packSharing';
import { Ban, History, Loader2, Mail } from 'lucide-react';

async function request(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('kyb-pack-sharing', { body });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const raw = await error.context.text();
      try { const details = JSON.parse(raw); message = details.error ?? raw; if (details.details) message += `: ${details.details}`; } catch { message = raw; }
    }
    throw new Error(message);
  }
  return data;
}

export function SendPack({ exporterId, companyName, onSent }: { exporterId: string; companyName: string; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(`Exporter KYB Pack: ${companyName}`);
  const [message, setMessage] = useState(`Dear colleague,\n\nPlease find the secure download link to the exporter KYB pack for ${companyName} below, for your review.\n\nPlease treat these documents as strictly confidential.\n\nKind regards,\nVeloxis`);
  const [packType, setPackType] = useState<'full' | 'summary'>('full');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = packFormSchema.safeParse({ to: recipientList(to), cc: [], subject, message, pack_type: packType });
    if (!result.success) {
      const next: Record<string, string> = {};
      result.error.issues.forEach(i => { next[String(i.path[0])] ??= i.message; });
      setErrors(next); return;
    }
    setErrors({}); setBusy(true);
    try {
      const data = await request({ action: 'send', exporter_id: exporterId, ...result.data });
      toast({ title: 'Pack email queued', description: `Download link expires ${new Date(data.expires_at).toLocaleString('en-GB')}. Delivery starts after sender verification.` });
      setOpen(false); onSent();
    } catch (error) {
      toast({ title: 'Pack not sent', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setBusy(false); }
  };
  const error = (field: string) => errors[field] ? <p id={`pack-${field}-error`} className="text-xs text-destructive">{errors[field]}</p> : null;
  return <>
    <Button size="sm" onClick={() => setOpen(true)}><Mail className="mr-2 h-4 w-4" />Send pack</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Send KYB pack</DialogTitle></DialogHeader>
        <form onSubmit={send} noValidate className="space-y-4">
          <div className="space-y-1"><Label htmlFor="pack-to">To *</Label><Input id="pack-to" type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="name@company.com" aria-invalid={!!errors.to} aria-describedby={errors.to ? 'pack-to-error' : undefined} />{error('to')}</div>
          <div className="space-y-1"><Label htmlFor="pack-subject">Subject *</Label><Input id="pack-subject" value={subject} onChange={e => setSubject(e.target.value)} aria-invalid={!!errors.subject} />{error('subject')}</div>
          <div className="space-y-1"><Label htmlFor="pack-message">Message *</Label><Textarea id="pack-message" value={message} onChange={e => setMessage(e.target.value)} rows={7} aria-invalid={!!errors.message} />{error('message')}</div>
          <div className="space-y-1"><Label htmlFor="pack-type">Pack type</Label><Select value={packType} onValueChange={v => setPackType(v === 'summary' ? 'summary' : 'full')}><SelectTrigger id="pack-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full">Full pack</SelectItem><SelectItem value="summary">Summary only</SelectItem></SelectContent></Select></div>
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}{busy ? 'Sending…' : 'Send pack'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

type Activity = { id: string; event_type: string; actor_name: string | null; actor_id: string | null; details: unknown; created_at: string };
type Pack = { id: string; expires_at: string; revoked_at: string | null };
const readable = (value: unknown): string => Array.isArray(value) ? value.map(readable).join(', ') : value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—');

export function ApplicationActivity({ exporterId, inviteId, refresh }: { exporterId: string; inviteId?: string | null; refresh: number }) {
  const [events, setEvents] = useState<Activity[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);
  const load = useCallback(async () => {
    setFailure(''); setLoading(true);
    const allEvents: Activity[] = [];
    let activityError = '';
    for (let offset = 0; ; offset += 500) {
      let query = supabase.from('kyb_application_activity').select('id,event_type,actor_name,actor_id,details,created_at').order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
      query = inviteId ? query.or(`exporter_id.eq.${exporterId},invite_id.eq.${inviteId}`) : query.eq('exporter_id', exporterId);
      const { data, error } = await query;
      if (error) { activityError = error.message; break; }
      allEvents.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
    const { data: links, error: linksError } = await supabase.from('kyb_pack_links').select('id,expires_at,revoked_at').eq('exporter_id', exporterId).eq('delivery_status', 'sent');
    if (activityError || linksError) setFailure(activityError || linksError?.message || 'Could not load activity.');
    else { setEvents(allEvents); setPacks(links ?? []); }
    setLoading(false);
  }, [exporterId, inviteId]);
  useEffect(() => { load(); }, [load, refresh]);
  const revoke = async (linkId: string) => {
    if (!window.confirm('Revoke this download link immediately? Recipients will no longer be able to download this pack.')) return;
    setBusy(linkId);
    try { await request({ action: 'revoke', link_id: linkId }); toast({ title: 'Download link revoked' }); await load(); }
    catch (error) { toast({ title: 'Could not revoke link', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }); }
    finally { setBusy(null); }
  };
  const filtered = events.filter(e => filter === 'all' || e.event_type === filter);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg"><History className="h-5 w-5" />Application activity</h2><Select value={filter} onValueChange={v => { setFilter(v); setLimit(100); }}><SelectTrigger className="w-full sm:w-64" aria-label="Filter by event type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All events</SelectItem>{[...new Set(events.map(e => e.event_type))].sort().map(type => <SelectItem key={type} value={type}>{activityLabel(type)}</SelectItem>)}</SelectContent></Select></div>
    {loading ? <p className="text-muted-foreground">Loading activity…</p> : failure ? <div className="text-destructive">{failure}<Button variant="outline" onClick={load}>Retry</Button></div> : <>
      {!filtered.length && <p className="text-muted-foreground">No activity recorded.</p>}
      <ol className="divide-y divide-border">{filtered.slice(0, limit).map(event => {
        const details = event.details && typeof event.details === 'object' ? event.details as Record<string, unknown> : {};
        const pack = packs.find(p => p.id === details.link_id);
        return <li key={event.id} className="py-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1"><div><div className="font-medium">{activityLabel(event.event_type)}</div><div className="text-xs text-muted-foreground">{event.actor_name || (event.actor_id ? 'Staff member' : event.event_type === 'shared_pack_downloaded' ? 'Link recipient' : 'System')}</div></div><time className="text-xs text-muted-foreground shrink-0" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('en-GB')}</time></div>
          <dl className="space-y-1 text-sm">{Object.entries(details).filter(([key, value]) => !['link_id', 'at'].includes(key) && value !== null && value !== '').map(([key, value]) => <div key={key} className="flex flex-col sm:flex-row gap-1 sm:gap-3"><dt className="text-muted-foreground sm:w-32 shrink-0">{activityLabel(key)}</dt><dd className="break-all min-w-0">{readable(value)}</dd></div>)}</dl>
          {event.event_type === 'pack_sent' && pack && <div className="flex flex-wrap items-center gap-3"><span className={`text-xs ${pack.revoked_at ? 'text-destructive' : 'text-muted-foreground'}`}>{pack.revoked_at ? `Revoked ${new Date(pack.revoked_at).toLocaleString('en-GB')}` : Date.parse(pack.expires_at) <= Date.now() ? 'Expired' : 'Link active'}</span>{!pack.revoked_at && Date.parse(pack.expires_at) > Date.now() && <Button size="sm" variant="outline" disabled={busy === pack.id} onClick={() => revoke(pack.id)}><Ban className="mr-2 h-4 w-4" />Revoke link</Button>}</div>}
        </li>;
      })}</ol>
      {filtered.length > limit && <Button variant="outline" onClick={() => setLimit(v => v + 100)}>Load more</Button>}
    </>}
  </section>;
}