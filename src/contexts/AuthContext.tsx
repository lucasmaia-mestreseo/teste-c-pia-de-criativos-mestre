import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'owner' | 'admin' | 'manager' | 'analyst';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { name: string; email: string; approved: boolean } | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, userEmail?: string, userName?: string) => {
    let { data: p } = await supabase
      .from('profiles')
      .select('name, email, approved')
      .eq('user_id', userId)
      .single();

    // Auto-create profile if missing (handles signup race condition)
    if (!p && userEmail) {
      const fallbackName = userName || userEmail.split('@')[0];
      await supabase.from('profiles').insert({
        user_id: userId,
        name: fallbackName,
        email: userEmail.toLowerCase(),
      });
      const { data: created } = await supabase
        .from('profiles')
        .select('name, email, approved')
        .eq('user_id', userId)
        .single();
      p = created;
    }
    setProfile(p || null);

    const { data: r } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    // Pick highest role: owner > admin > manager > analyst
    const roles = (r || []).map((x: any) => x.role as AppRole);
    const priority: AppRole[] = ['owner', 'admin', 'manager', 'analyst'];
    setRole(priority.find((pr) => roles.includes(pr)) || null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user.email, user.user_metadata?.name);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await fetchProfile(sess.user.id, sess.user.email, sess.user.user_metadata?.name);
        } else {
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
