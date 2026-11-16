"use client";

import { ExternalLink, Home, Inbox, KeyRound, Loader2, Mail, RefreshCw, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { PillTabs } from "@/components/kit";
import { readCache, writeCache } from "@/lib/cache";
import { CleanUp } from "./CleanUp";

type Msg = { uid: number; from: string; fromAddr: string; subject: string; date: string; unread: boolean; kind: "rental" | "important" | "other"; snippet: string };
type Resp = { configured?: boolean; unread?: number; messages?: Msg[]; error?: string };

const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mail`;

function when(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function MailView() {
  const { user } = useAuth();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "rental" | "important">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: s } = await createClient().auth.getSession();
    const token = s.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(FN, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ inbox: true, count: 30 }) });
      const j = (await r.json()) as Resp;
      setData(j);
      if (j.messages) writeCache("mail.inbox", j);
    } catch {
      setData((d) => ({ ...(d ?? {}), error: "Couldn't reach your inbox — check your connection." }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const c = readCache<Resp>("mail.inbox", 30 * 60e3);
    if (c) setData(c);
    if (user) load();
  }, [user, load]);

  if (data && data.configured === false) return <Setup />;

  const msgs = (data?.messages ?? []).filter((m) => tab === "all" || m.kind === tab);
  const rentals = (data?.messages ?? []).filter((m) => m.kind === "rental" && m.unread).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="card flex flex-1 items-center gap-3 p-3">
          <span className="icon-tile shrink-0" style={{ "--tile": "#6001d2" } as React.CSSProperties}>
            <Inbox size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold tabular-nums">{data?.unread ?? "–"}</p>
            <p className="text-xs text-muted">unread in Yahoo{rentals ? ` · ${rentals} rental alert${rentals > 1 ? "s" : ""}` : ""}</p>
          </div>
        </div>
        <button className="btn btn-ghost size-12 shrink-0 p-0!" onClick={load} aria-label="Refresh inbox" disabled={loading}>
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <CleanUp onDone={load} />

      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "all", label: "Inbox" },
          { value: "rental", label: "Rentals" },
          { value: "important", label: "Important" },
        ]}
      />

      {data?.error && <p className="card p-4 text-sm text-muted">{data.error}</p>}
      {loading && !data?.messages && (
        <p className="flex items-center gap-2 p-4 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Opening your inbox…
        </p>
      )}

      {data?.messages && (
        <ul className="card divide-y divide-line overflow-hidden">
          {msgs.length === 0 && <li className="p-4 text-sm text-muted">{tab === "rental" ? "No rental alerts in your latest emails yet — set up instant alerts on the Renting page." : "Nothing here."}</li>}
          {msgs.map((m) => (
            <li key={m.uid}>
              <a href="https://mail.yahoo.com/" target="_blank" rel="noopener noreferrer" className="flex gap-3 px-4 py-3 active:bg-surface-2">
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: m.unread ? "var(--accent)" : "transparent" }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`min-w-0 flex-1 truncate text-sm ${m.unread ? "font-bold" : "font-medium"}`}>{m.from}</span>
                    <span className="shrink-0 text-[11px] text-faint">{when(m.date)}</span>
                  </span>
                  <span className={`flex items-center gap-1.5 truncate text-sm ${m.unread ? "text-ink" : "text-muted"}`}>
                    {m.kind === "rental" && <Home size={13} className="shrink-0 text-[#34c759]" />}
                    {m.kind === "important" && <Star size={13} className="shrink-0 text-[#ff9500]" />}
                    <span className="truncate">{m.subject}</span>
                  </span>
                  {m.snippet && <span className="line-clamp-1 text-xs text-faint">{m.snippet}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <a href="https://mail.yahoo.com/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">
        <ExternalLink size={16} /> Open Yahoo Mail
      </a>
      <p className="px-1 text-xs text-faint">
        LifeHub never sends email or permanently deletes anything. Clean-up only moves the senders you tick to Trash, where you can restore them.
      </p>
    </div>
  );
}

function Setup() {
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <span className="icon-tile shrink-0" style={{ "--tile": "#6001d2" } as React.CSSProperties}>
            <Mail size={18} />
          </span>
          <div>
            <p className="font-semibold">Link your Yahoo inbox</p>
            <p className="mt-0.5 text-sm text-muted">
              Yahoo lets apps read your mail with an <b>app password</b> — a separate password just for LifeHub. Your normal Yahoo password is never used, and you can switch
              it off any time.
            </p>
          </div>
        </div>
        <ol className="mt-4 space-y-3 text-sm">
          {[
            <>
              On Yahoo, open <b>Account info → Account security</b> (you&apos;ll need 2-step verification switched on).
            </>,
            <>
              Tap <b>Generate app password</b> (or “Manage app passwords”), name it <b>LifeHub</b>, and copy the 16 letters it shows.
            </>,
            <>
              In Supabase → Edge Functions → <b>Secrets</b>, add <code className="rounded bg-surface-2 px-1">YAHOO_EMAIL</code> (your Yahoo address) and{" "}
              <code className="rounded bg-surface-2 px-1">YAHOO_APP_PASSWORD</code> (the 16 letters). Paste them there, not in a chat.
            </>,
            <>Come back here and pull down to refresh — your inbox appears.</>,
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">{i + 1}</span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
        <a href="https://login.yahoo.com/account/security" target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-4 w-full">
          <KeyRound size={16} /> Open Yahoo account security
        </a>
      </section>
      <p className="px-1 text-xs text-faint">Only your LifeHub account (signed in with the same Yahoo address) can see the inbox. LifeHub only reads — it never sends or deletes mail.</p>
    </div>
  );
}
