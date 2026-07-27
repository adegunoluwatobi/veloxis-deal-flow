import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { AppRole } from './roles';

interface Profile { user_id: string; name: string | null; email: string; phone: string | null; active: boolean; }

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: Profile | null;
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
  const [loading, setLoading] = useState(true);

  const load = async (uid: string) => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from('app_user_roles').select('role').eq('user_id', uid),
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    setRoles((r ?? []).map((x: any) => x.role as AppRole));
    setProfile((p as any) ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => load(s.user.id), 0);
      else { setRoles([]); setProfile(null); }
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
  const signOut = async () => { await supabase.auth.signOut(); setRoles([]); setProfile(null); };
  const refresh = async () => { if (user) await load(user.id); };

  return <Ctx.Provider value={{ user, session, roles, profile, loading, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
