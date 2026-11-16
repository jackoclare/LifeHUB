"use client";

import { Check, Loader2, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { celebrate } from "@/lib/celebrate";

type Sender = { addr: string; name: string; count: number; unread: number; marketing: number; sample: string; latest: string; protected: boolean };

const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mail`;

async function call(body: object) {
  const { data: s } = await createClient().auth.getSession();
  const r = await fetch(FN, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  return r.json();
}

/**
 * Inbox clean-up: finds senders that mostly send newsletters / sales mail (they carry an "unsubscribe" header),
 * lets you untick any you want to keep, then MOVES their emails to Yahoo's Trash (recoverable — nothing is
 * permanently deleted). Banks, council, gov, deliveries and rental alerts are never ticked automatically.
 */
export function CleanUp({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "review" | "moving" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [senders, setSenders] = useState<Sender[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [moved, setMoved] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const scan = async () => {
    setPhase("scanning");
    setErr(null);
    const all = new Map<string, Sender>();
    let from: number | null = 1;
    try {
      while (from) {
        const r = (await call({ scan: true, from })) as { total?: number; next?: number | null; senders?: Sender[]; error?: string };
        if (r.error) throw new Error(r.error);
        for (const s of r.senders ?? []) {
          const cur = all.get(s.addr);
          if (cur) {
            cur.count += s.count;
            cur.unread += s.unread;
            cur.marketing += s.marketing;
            if (s.latest > cur.latest) {
              cur.latest = s.latest;
              cur.sample = s.sample;
            }
          } else all.set(s.addr, { ...s });
        }
        setProgress({ done: r.next ? r.next - 1 : (r.total ?? 0), total: r.total ?? 0 });
        from = r.next ?? null;
      }
      const list = [...all.values()].sort((a, b) => b.count - a.count);
      setSenders(list);
      setPicked(new Set(list.filter((s) => !s.protected).map((s) => s.addr)));
      setPhase("review");
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  };

  const total = senders.filter((s) => picked.has(s.addr)).reduce((a, s) => a + s.count, 0);

  const move = async () => {
    setPhase("moving");
    setConfirm(false);
    let left = senders.filter((s) => picked.has(s.addr)).map((s) => s.addr);
    let count = 0;
    try {
      while (left.length) {
        const batch = left.slice(0, 15);
        const r = (await call({ trash: true, senders: batch })) as { moved?: number; done?: string[]; error?: string };
        if (r.error) throw new Error(r.error);
        count += r.moved ?? 0;
        setMoved(count);
        const done = new Set(r.done ?? []);
        if (!done.size) throw new Error("Yahoo is slow right now — try again in a minute.");
        left = left.filter((a) => !done.has(a));
      }
      setPhase("done");
      celebrate(null, 60);
      onDone();
    } catch (e) {
      setErr(`${(e as Error).message} (${count} moved so far)`);
      setPhase("review");
    }
  };

  if (phase === "idle")
    return (
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <span className="icon-tile shrink-0" style={{ "--tile": "#ff9500" } as React.CSSProperties}>
            <Sparkles size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Clear out sales and newsletter emails</p>
            <p className="mt-0.5 text-sm text-muted">Finds senders that only send marketing, shows you the list, and moves what you tick to Trash. Nothing is permanently deleted.</p>
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-muted">{err}</p>}
        <button className="btn btn-primary mt-3 w-full" onClick={scan}>
          Find sales emails
        </button>
      </section>
    );

  if (phase === "scanning")
    return (
      <section className="card p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Loader2 size={16} className="animate-spin" /> Looking through your inbox…
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">{progress.total ? `${progress.done.toLocaleString("en-GB")} of ${progress.total.toLocaleString("en-GB")} emails checked` : "Connecting to Yahoo…"}</p>
      </section>
    );

  if (phase === "done")
    return (
      <section className="card flex items-center gap-3 p-4">
        <span className="icon-tile shrink-0" style={{ "--tile": "#34c759" } as React.CSSProperties}>
          <Check size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{moved.toLocaleString("en-GB")} emails moved to Trash</p>
          <p className="text-xs text-muted">Changed your mind? They&apos;re in Yahoo&apos;s Trash folder — open it and tap “Restore”. Yahoo empties Trash on its own after a while.</p>
        </div>
      </section>
    );

  return (
    <section className="card overflow-hidden">
      <div className="p-4">
        <p className="font-semibold">
          {senders.length} sales and newsletter senders · {total.toLocaleString("en-GB")} emails ticked
        </p>
        <p className="mt-0.5 text-xs text-muted">Untick anything you want to keep. Banks, council, deliveries and rental alerts start unticked.</p>
        <div className="mt-2 flex gap-2 text-xs font-semibold">
          <button className="chip min-h-8" onClick={() => setPicked(new Set(senders.map((s) => s.addr)))}>
            Tick all
          </button>
          <button className="chip min-h-8" onClick={() => setPicked(new Set())}>
            Untick all
          </button>
        </div>
      </div>
      <ul className="max-h-[50dvh] divide-y divide-line overflow-y-auto border-y border-line">
        {senders.map((s) => (
          <li key={s.addr}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-[var(--accent)]"
                checked={picked.has(s.addr)}
                onChange={() =>
                  setPicked((p) => {
                    const n = new Set(p);
                    if (n.has(s.addr)) n.delete(s.addr);
                    else n.add(s.addr);
                    return n;
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">{s.name}</span>
                  {s.protected && <ShieldCheck size={13} className="shrink-0 text-[#34c759]" />}
                </span>
                <span className="block truncate text-xs text-muted">{s.sample || s.addr}</span>
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-muted">{s.count.toLocaleString("en-GB")}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="space-y-2 p-4">
        {err && <p className="text-sm text-muted">{err}</p>}
        {phase === "moving" ? (
          <p className="flex items-center justify-center gap-2 text-sm font-semibold">
            <Loader2 size={16} className="animate-spin" /> Moving to Trash… {moved.toLocaleString("en-GB")} so far
          </p>
        ) : confirm ? (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
              Cancel
            </button>
            <button className="btn text-white" style={{ background: "#ff3b30" }} onClick={move}>
              Yes, move {total.toLocaleString("en-GB")}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary w-full" disabled={!total} onClick={() => setConfirm(true)}>
            <Trash2 size={16} /> Move {total.toLocaleString("en-GB")} emails to Trash
          </button>
        )}
      </div>
    </section>
  );
}
