import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import MarketingTabs from '@/components/MarketingTabs';

type Channel = 'SOCIAL' | 'LANDING_PAGE' | 'EMAIL' | 'COMMUNITY';

function parseDrafts(text: string): string[] {
  if (!text) return [];
  // Split on lines beginning with "1.", "2.", "3." (or "Option 1:", etc.)
  const regex = /(?:^|\n)\s*(?:Option\s*)?(\d+)[\.\):]\s*/gi;
  const parts: string[] = [];
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) indices.push(m.index);
  if (indices.length === 0) return [text.trim()];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : text.length;
    const chunk = text.slice(start, end).replace(/^\s*(?:Option\s*)?\d+[\.\):]\s*/i, '').trim();
    if (chunk) parts.push(chunk);
  }
  return parts;
}

export default function AdminContentGeneration() {
  const [channel, setChannel] = useState<Channel>('SOCIAL');
  const [campaignName, setCampaignName] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [recentTopics, setRecentTopics] = useState('');
  const [memberContext, setMemberContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [rawText, setRawText] = useState('');

  const isCommunity = channel === 'COMMUNITY';

  const submit = async () => {
    if (!campaignName.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    if (isCommunity && (!subCategory.trim() || !memberContext.trim())) {
      toast.error('Sub-category and known member context are required for COMMUNITY');
      return;
    }
    setLoading(true);
    setDrafts([]);
    setRawText('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          channel,
          campaign_name: campaignName.trim(),
          sub_category: isCommunity ? subCategory.trim() : undefined,
          recent_topics_covered: recentTopics.trim() || undefined,
          known_member_context: isCommunity ? memberContext.trim() : undefined,
        },
      });
      if (error) throw error;
      const text = (data as any)?.text ?? '';
      setRawText(text);
      setDrafts(parseDrafts(text));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Helmet><title>Content Generation · Veloxis</title></Helmet>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate draft marketing content. All output is drafts only — review and edit before posting.
        </p>
      </div>
      <MarketingTabs />


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOCIAL">Social (LinkedIn, X, Instagram)</SelectItem>
                  <SelectItem value="LANDING_PAGE">Landing page</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="COMMUNITY">Community (WhatsApp/Telegram)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Campaign name</Label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Cocoa exporter awareness Q1" />
            </div>
          </div>

          {isCommunity && (
            <div className="space-y-2">
              <Label>Sub-category</Label>
              <Input value={subCategory} onChange={(e) => setSubCategory(e.target.value)} placeholder="e.g. logistics, FX, buyer verification" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Recent topics covered <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea rows={2} value={recentTopics} onChange={(e) => setRecentTopics(e.target.value)} placeholder="Topics recently posted so the model can avoid repetition" />
          </div>

          {isCommunity && (
            <div className="space-y-2">
              <Label>Known member context</Label>
              <Textarea rows={3} value={memberContext} onChange={(e) => setMemberContext(e.target.value)} placeholder="Who is in this group and what do they care about?" />
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={submit} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate drafts
            </Button>
          </div>
        </CardContent>
      </Card>

      {drafts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Drafts ({drafts.length})</h2>
          {drafts.map((d, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium">Option {i + 1}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => copy(d)} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{d}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {drafts.length === 0 && rawText && (
        <Card>
          <CardContent className="pt-6">
            <pre className="whitespace-pre-wrap font-sans text-sm">{rawText}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
