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
  /** Single source of truth: true only when session AND roles/profile are fully resolved. */
  ready: boolean;
  /** Kept for backwards compatibility — always the inverse of `ready`. */
  loading: boolean;
  /** Set when roles/profile could not be fetched. UI should show a retry state, not role-based content. */
  error: string | null;
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
  const [sessionResolved, setSessionResolved] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (uid: string) => {
    setError(null);
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from('app_user_roles').select('role').eq('user_id', uid),
        supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      ]);
      if (rolesRes.error) throw new Error(rolesRes.error.message);
      if (profileRes.error) throw new Error(profileRes.error.message);

      const roleList = (rolesRes.data ?? []).map((x: any) => x.role as AppRole);
      setRoles(roleList);
      setProfile((profileRes.data as any) ?? null);

      if (roleList.includes('exporter')) {
        const { data: e, error: expErr } = await supabase
          .from('v2_exporters')
          .select('id, onboarding_status, bd_approved_at, onboarding_submitted_at')
          .eq('owner_user_id', uid).maybeSingle();
        if (expErr) throw new Error(expErr.message);
        setExporterOnboarding((e as any) ?? null);
      } else {
        setExporterOnboarding(null);
      }
    } catch (err: any) {
      console.error('[auth] failed to load roles/profile', err?.message ?? err);
      setRoles([]);
      setProfile(null);
      setExporterOnboarding(null);
      setError(err?.message || 'Could not load your account details.');
    } finally {
      setDataLoaded(true);
    }
  };

  useEffect(() => {
    // Tracks which user we have already loaded roles/profile for. Supabase fires
    // auth events on every tab focus / token refresh — reloading on those would
    // flip the app back into its loading state and make the page appear to refresh.
    let loadedFor: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Keep the SAME user object reference when the id hasn't changed. Supabase
      // emits a fresh User object on every token refresh / tab focus; swapping it
      // re-runs every `[user]` effect in the app and looks like a page refresh.
      setUser((prev) => (prev && s?.user && prev.id === s.user.id ? prev : (s?.user ?? null)));

      if (s?.user) {
        const uid = s.user.id;
        if (loadedFor !== uid) {
          loadedFor = uid;
          setDataLoaded(false);
          setTimeout(() => load(uid), 0);
        }
        if (event === 'SIGNED_IN') {
          setTimeout(async () => {
            const nowIso = new Date().toISOString();
            await supabase.from('profiles').update({ last_login: nowIso }).eq('user_id', uid);
            await supabase.from('profiles').update({ first_signed_in_at: nowIso }).eq('user_id', uid).is('first_signed_in_at', null);
          }, 0);
        }
      } else {
        loadedFor = null;
        setRoles([]); setProfile(null); setExporterOnboarding(null); setError(null); setDataLoaded(true);
      }
      setSessionResolved(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setUser(session?.user ?? null);
      if (session?.user) {
        if (loadedFor !== session.user.id) {
          loadedFor = session.user.id;
          load(session.user.id).finally(() => setSessionResolved(true));
        } else {
          setSessionResolved(true);
        }
      }
      else { setDataLoaded(true); setSessionResolved(true); }
    });

    return () => subscription.unsubscribe();
  }, []);


  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // Signing in with a password proves one exists — clear the "set password first" gate.
    if (!error && data.user) {
      await supabase.from('profiles')
        .update({ password_set_at: new Date().toISOString() })
        .eq('user_id', data.user.id)
        .is('password_set_at', null);
    }
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => { await supabase.auth.signOut(); setRoles([]); setProfile(null); setExporterOnboarding(null); setError(null); };
  const refresh = async () => { if (user) { setDataLoaded(false); await load(user.id); } };

  // Single readiness source of truth: session resolved, and (if signed in) roles/profile fetched.
  const ready = sessionResolved && (!user || dataLoaded);

  return (
    <Ctx.Provider
      value={{
        user, session, roles, profile, exporterOnboarding,
        ready, loading: !ready, error,
        signIn, signOut, refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
