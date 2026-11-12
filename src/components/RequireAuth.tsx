"use client";

import { useAuth } from "./AuthProvider";
import { SignInCard } from "./SignInCard";
import { Spinner } from "./ui";

/** Shows children only when signed in; otherwise the sign-in card. */
export function RequireAuth({ children, reason }: { children: React.ReactNode; reason?: string }) {
  const { user, loading, configured } = useAuth();
  if (!configured) {
    return <p className="card p-6 text-sm text-muted">The database isn&apos;t connected yet (missing Supabase settings).</p>;
  }
  if (loading) return <Spinner />;
  if (!user) return <SignInCard reason={reason} />;
  return <>{children}</>;
}
