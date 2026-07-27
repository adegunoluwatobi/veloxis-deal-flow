import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { AppRole } from './roles';

interface Profile { user_id: string; name: string | null; email: string; phone: string | null; active: boolean; password_set_at?: string | null; }
export interface ExporterOnboardingState { id: string; onboarding_status: string; bd_approved_at: string | null; onboarding_submitted_at: string | null; }

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: Profile | null;
  exporterOnboarding: ExporterOnboardingState | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exporterOnboarding, setExporterOnboarding] = useState<ExporterOnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (uid: string) => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from('app_user_roles').select('role').eq('user_id', uid),
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    const roleList = (r ?? []).map((x: any) => x.role as AppRole);
    setRoles(roleList);
    setProfile((p as any) ?? null);
    if (roleList.includes('exporter')) {
      const { data: e } = await supabase
        .from('v2_exporters')
        .select('id, onboarding_status, bd_approved_at, onboarding_submitted_at')
        .eq('owner_user_id', uid).maybeSingle();
      setExporterOnboarding((e as any) ?? null);
    } else {
      setExporterOnboarding(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) {
        const uid = s.user.id;
        setTimeout(() => load(uid), 0);
        if (event === 'SIGNED_IN') {
          setTimeout(async () => {
            const nowIso = new Date().toISOString();
            await supabase.from('profiles').update({ last_login: nowIso }).eq('user_id', uid);
            await supabase.from('profiles').update({ first_signed_in_at: nowIso }).eq('user_id', uid).is('first_signed_in_at', null);
          }, 0);
        }
      } else { setRoles([]); setProfile(null); setExporterOnboarding(null); }
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setUser(session?.user ?? null);
      if (session?.user) load(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };
  const signOut = async () => { await supabase.auth.signOut(); setRoles([]); setProfile(null); setExporterOnboarding(null); };
  const refresh = async () => { if (user) await load(user.id); };

  return <Ctx.Provider value={{ user, session, roles, profile, exporterOnboarding, loading, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
