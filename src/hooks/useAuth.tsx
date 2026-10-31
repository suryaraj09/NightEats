import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  /** true once profile + admin status for the current session have been fetched */
  ready: boolean;
  profileComplete: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  saveProfile: (name: string, phone: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const loadUserData = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setIsAdmin(false);
      setReady(true);
      return;
    }
    setReady(false);
    const [{ data: p }, { data: admin }] = await Promise.all([
      supabase.from('profiles').select('id,email,name,phone').eq('id', s.user.id).maybeSingle(),
      supabase.rpc('is_admin'),
    ]);
    setProfile((p as Profile | null) ?? null);
    setIsAdmin(admin === true);
    setReady(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadUserData(data.session).finally(() => setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer: calling supabase inside this callback can deadlock.
      setTimeout(() => void loadUserData(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadUserData]);

  const value: AuthState = {
    session,
    profile,
    isAdmin,
    loading,
    ready,
    profileComplete: Boolean(profile?.name && profile?.phone),
    signInWithGoogle: async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    },
    signInWithEmail: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    },
    signUpWithEmail: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) return error.message;
      // With "Confirm email" enabled there is no session until the link is clicked.
      return data.session ? null : 'CONFIRM_EMAIL';
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    saveProfile: async (name, phone) => {
      if (!session) return 'Not signed in';
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim(), phone, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (error) return error.code === '23514' ? 'PHONE_FORMAT' : error.message;
      await loadUserData(session);
      return null;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
