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
  signOut: () => Promise<void>;
  saveProfile: (name: string, phone: string) => Promise<string | null>;
  /** Remember the delivery address for next time. Best effort: a failure never blocks an order. */
  saveAddress: (address: string) => Promise<void>;
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
    const [withAddress, { data: admin }] = await Promise.all([
      supabase.from('profiles').select('id,email,name,phone,address').eq('id', s.user.id).maybeSingle(),
      supabase.rpc('is_admin'),
    ]);
    let p: Partial<Profile> | null = withAddress.data;
    if (withAddress.error) {
      // Migration 0005 (profiles.address) not applied yet: load the profile without it rather than losing it.
      const fallback = await supabase.from('profiles').select('id,email,name,phone').eq('id', s.user.id).maybeSingle();
      p = fallback.data ? { ...fallback.data, address: null } : null;
    }
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
    saveAddress: async (address) => {
      if (!session) return;
      const clean = address.trim();
      if (!clean || clean === profile?.address) return;
      const { error } = await supabase
        .from('profiles')
        .update({ address: clean, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (!error) setProfile((p) => (p ? { ...p, address: clean } : p));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
