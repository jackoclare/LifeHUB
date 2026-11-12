"use client";

import { Loader2, LockKeyhole, MailCheck } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorNote, Field, inputClass } from "./ui";

export function SignInCard({ reason }: { reason?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (!data.session) setCheckEmail(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(
        msg.includes("Invalid login credentials")
          ? "That email and password don't match. Try again, or create an account first."
          : msg.includes("Email not confirmed")
            ? "Please confirm your email first — check your inbox for the link from Supabase."
            : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  if (checkEmail) {
    return (
      <div className="card mx-auto max-w-md p-6 text-center sm:p-8">
        <MailCheck size={36} className="mx-auto text-accent" />
        <h2 className="mt-4 font-display text-xl font-semibold">Check your email</h2>
        <p className="mt-2 text-sm text-muted">
          We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>. Tap it, then come back here and sign in.
        </p>
        <button
          className="btn btn-ghost mt-6"
          onClick={() => {
            setCheckEmail(false);
            setMode("signin");
          }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-md p-6 sm:p-8">
      <span className="icon-tile size-12! rounded-2xl!" style={{ "--tile": "var(--accent)" } as React.CSSProperties}>
        <LockKeyhole size={22} />
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create your account"}</h2>
      <p className="mt-1 text-sm text-muted">{reason ?? "Sign in to keep your data safe and synced between your iPhone and computer."}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input
            className={inputClass}
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {mode === "signup" && <p className="text-xs text-faint">At least 8 characters. Your iPhone can suggest a strong one and save it.</p>}
        {error && <ErrorNote message={error} />}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {mode === "signin" ? "First time here? " : "Already have an account? "}
        <button
          className="font-semibold text-accent"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
