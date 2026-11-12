"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthState = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({ user: null, loading: true, configured: false, signOut: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  const signOut = async () => {
    if (!configured) return;
    await createClient().auth.signOut();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, configured, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
