import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Copy, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import MarketingTabs from '@/components/MarketingTabs';

type Channel = 'SOCIAL' | 'LANDING_PAGE' | 'EMAIL' | 'COMMUNITY';
type Mode = 'REDRAFT' | 'SOURCE';
type SubCategory = 'MARKET_INTEL' | 'SEEDED_QUESTION' | 'WIN_AMPLIFICATION' | 'DM_PIVOT';

function parseDrafts(text: string): string[] {
  if (!text) return [];
  const regex = /(?:^|\n)\s*(?:Option\s*)?(\d+)[\.\):]\s*/gi;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) indices.push(m.index);
  if (indices.length === 0) return [text.trim()];
  const parts: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : text.length;
    const chunk = text.slice(start, end).replace(/^\s*(?:Option\s*)?\d+[\.\):]\s*/i, '').trim();
    if (chunk) parts.push(chunk);
  }
  return parts;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function AdminContentGeneration() {
  const [channel, setChannel] = useState<Channel>('SOCIAL');
  const [mode, setMode] = useState<Mode>('REDRAFT');
  const [campaignName, setCampaignName] = useState('');
  const [subCategory, setSubCategory] = useState<SubCategory>('MARKET_INTEL');
  const [recentTopics, setRecentTopics] = useState('');
  const [memberContext, setMemberContext] = useState('');
  const [suppliedMaterial, setSuppliedMaterial] = useState('');
  const [suppliedImage, setSuppliedImage] = useState<string>('');
  const [imageName, setImageName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [rawText, setRawText] = useState('');

  const isCommunity = channel === 'COMMUNITY';
  const isRedraft = mode === 'REDRAFT';

  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setSuppliedImage(dataUrl);
    setImageName(file.name);
  };

  const submit = async () => {
    if (isCommunity && !subCategory) {
      toast.error('Sub-category is required for COMMUNITY');
      return;
    }
    if (isCommunity && !subCategory) {
      toast.error('Sub-category is required for COMMUNITY');
      return;
    }
    if (isRedraft && !suppliedMaterial.trim() && !suppliedImage) {
      toast.error('REDRAFT mode needs supplied text or an image');
      return;
    }
    setLoading(true);
    setDrafts([]);
    setRawText('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          channel,
          mode,
          campaign_name: campaignName.trim() || undefined,
          sub_category: isCommunity ? subCategory : undefined,
          recent_topics_covered: recentTopics.trim() || undefined,
          known_member_context: isCommunity ? memberContext.trim() || undefined : undefined,
          supplied_material: isRedraft ? suppliedMaterial.trim() || undefined : undefined,
          supplied_image: isRedraft ? suppliedImage || undefined : undefined,
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
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REDRAFT">Redraft (I supply material)</SelectItem>
                  <SelectItem value="SOURCE">Source (find recent development)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Campaign name <span className="text-muted-foreground font-normal">(optional — model will propose one if left blank)</span></Label>
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. nbcc, lagos-trade-summit" />
          </div>

          {isCommunity && (
            <div className="space-y-2">
              <Label>Sub-category</Label>
              <Select value={subCategory} onValueChange={(v) => setSubCategory(v as SubCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKET_INTEL">Market intel</SelectItem>
                  <SelectItem value="SEEDED_QUESTION">Seeded question</SelectItem>
                  <SelectItem value="WIN_AMPLIFICATION">Win amplification</SelectItem>
                  <SelectItem value="DM_PIVOT">DM pivot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isRedraft && (
            <>
              <div className="space-y-2">
                <Label>Supplied material</Label>
                <Textarea
                  rows={5}
                  value={suppliedMaterial}
                  onChange={(e) => setSuppliedMaterial(e.target.value)}
                  placeholder="Paste the note, update, or rough draft to turn into polished content"
                />
              </div>
              <div className="space-y-2">
                <Label>Supplied image <span className="text-muted-foreground font-normal">(optional, e.g. screenshot, flyer)</span></Label>
                <div className="flex items-center gap-3">
                  <Input type="file" accept="image/*" onChange={onImageChange} className="max-w-sm" />
                  {suppliedImage && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="truncate max-w-[200px]">{imageName}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setSuppliedImage(''); setImageName(''); }}
                        className="h-6 w-6"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Recent topics covered <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea rows={2} value={recentTopics} onChange={(e) => setRecentTopics(e.target.value)} placeholder="Topics recently posted so the model can avoid repetition" />
          </div>

          {isCommunity && (
            <div className="space-y-2">
              <Label>Known member context <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea rows={3} value={memberContext} onChange={(e) => setMemberContext(e.target.value)} placeholder="Names, engagement history, flagged cash gaps" />
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
