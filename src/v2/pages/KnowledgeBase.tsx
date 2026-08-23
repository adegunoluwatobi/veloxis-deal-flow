import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, BookOpen, ShieldCheck, XCircle, CheckCircle2 } from 'lucide-react';
import { SECTIONS, ROLE_GUIDE, type Audience } from '@/v2/kb/content';

export default function KnowledgeBase({ audience }: { audience: Audience }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();

  const sections = useMemo(() => {
    return SECTIONS.map((s) => ({
      ...s,
      articles: s.articles.filter((a) => {
        if (!a.audience.includes(audience)) return false;
        if (!term) return true;
        const hay = [a.title, a.summary, ...a.body, ...(a.bullets ?? []), s.title].join(' ').toLowerCase();
        return hay.includes(term);
      }),
    })).filter((s) => s.articles.length > 0);
  }, [audience, term]);

  const roles = useMemo(() => {
    if (!term) return ROLE_GUIDE;
    return ROLE_GUIDE.filter((r) =>
      [r.label, r.purpose, r.portal, ...r.performs, ...r.cannot].join(' ').toLowerCase().includes(term));
  }, [term]);

  const articleCount = sections.reduce((n, s) => n + s.articles.length, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-accent">
          <BookOpen className="h-5 w-5" />
          <h1 className="text-2xl font-semibold text-foreground">Knowledge Base</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          How Veloxis works — onboarding, applications, documents, and what each role is responsible for.
        </p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the knowledge base…"
          className="pl-9"
          aria-label="Search the knowledge base"
        />
      </div>

      <Tabs defaultValue="guides">
        <TabsList>
          <TabsTrigger value="guides">Guides {term && `(${articleCount})`}</TabsTrigger>
          <TabsTrigger value="roles">Role responsibilities {term && `(${roles.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="guides" className="mt-6 space-y-6">
          {sections.length === 0 && (
            <p className="text-sm text-muted-foreground">No articles match “{q}”.</p>
          )}
          {sections.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {s.articles.map((a) => (
                    <AccordionItem key={a.id} value={a.id}>
                      <AccordionTrigger className="text-left">
                        <span>
                          <span className="block text-sm font-medium">{a.title}</span>
                          <span className="block text-xs text-muted-foreground font-normal">{a.summary}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 text-sm text-muted-foreground">
                          {a.body.map((p, i) => <p key={i}>{p}</p>)}
                          {a.bullets && (
                            <ul className="list-disc pl-5 space-y-1">
                              {a.bullets.map((b, i) => <li key={i}>{b}</li>)}
                            </ul>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="roles" className="mt-6 space-y-4">
          {roles.length === 0 && (
            <p className="text-sm text-muted-foreground">No roles match “{q}”.</p>
          )}
          {roles.map((r) => (
            <Card key={r.role}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <CardTitle className="text-base">{r.label}</CardTitle>
                  <Badge variant="secondary" className="font-mono text-[11px]">{r.role}</Badge>
                  <Badge variant="outline" className="text-[11px]">{r.portal}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{r.purpose}</p>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground mb-2">Responsibilities</h3>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {r.performs.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground mb-2">Cannot do</h3>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {r.cannot.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
