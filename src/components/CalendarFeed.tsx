"use client";

import { CalendarPlus, Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

const host = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^https?:\/\//, "");

function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Subscribe the iPhone (or Google/Outlook) calendar to bills, fixtures and events. */
export function CalendarFeed({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from("user_settings")
      .select("calendar_token")
      .maybeSingle()
      .then(({ data }) => setToken((data?.calendar_token as string | null) ?? null));
  }, [user]);

  if (!user) return null;

  const ensure = async (reset = false) => {
    if (token && !reset) return token;
    setBusy(true);
    const t = newToken();
    const { error } = await createClient().from("user_settings").upsert({ user_id: user.id, calendar_token: t });
    setBusy(false);
    if (error) return null;
    setToken(t);
    return t;
  };

  const feedPath = (t: string) => `${host}/functions/v1/calendar?token=${t}`;

  const subscribe = async () => {
    const t = await ensure();
    if (t) window.location.href = `webcal://${feedPath(t)}`;
  };
  const copy = async () => {
    const t = await ensure();
    if (!t) return;
    await navigator.clipboard.writeText(`https://${feedPath(t)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact)
    return (
      <button onClick={subscribe} className="flex min-h-9 items-center gap-1.5 text-xs font-semibold text-accent" disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />} Add to iPhone Calendar
      </button>
    );

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="icon-tile" style={{ "--tile": "var(--c-travel)" } as React.CSSProperties}>
          <CalendarPlus size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">iPhone Calendar</p>
          <p className="text-xs text-muted">Bills, Villa & England fixtures and your events in the Calendar app — updates automatically.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={subscribe} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />} Subscribe
        </button>
        <button className="btn btn-ghost" onClick={copy} disabled={busy}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy link"}
        </button>
        {token && (
          <button className="btn btn-ghost" onClick={() => ensure(true)} disabled={busy} title="Make a new private link (the old one stops working)">
            <RefreshCw size={16} /> New link
          </button>
        )}
      </div>
      <p className="mt-2 text-[0.7rem] text-faint">The link is private to you — don&apos;t share it. On Google Calendar: Other calendars → From URL → paste the copied link.</p>
    </div>
  );
}
