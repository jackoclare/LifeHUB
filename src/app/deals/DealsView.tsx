"use client";

import { ExternalLink, Flame, Gift, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ErrorNote, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { timeAgo } from "@/lib/news";
import { useRows } from "@/lib/useRows";
import type { WishlistItem } from "@/lib/types";
import type { Deal } from "@/app/api/deals/route";

const STOP = new Set(["the", "and", "for", "with", "pack", "set", "new", "a", "of", "in", "to"]);
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/** A deal matches a wish-list item when most of the item's key words appear in the deal title */
function matches(deal: Deal, item: WishlistItem) {
  const ws = words(item.name);
  if (!ws.length) return false;
  const t = deal.title.toLowerCase();
  const hit = ws.filter((w) => t.includes(w)).length;
  return hit >= Math.max(1, Math.ceil(ws.length * 0.6));
}

function heatColor(h: number | null) {
  if (h == null) return "var(--text-faint)";
  return h >= 500 ? "#ef4444" : h >= 200 ? "#f97316" : h >= 100 ? "#f59e0b" : "#38bdf8";
}

export function DealsView() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<"hot" | "new">("hot");
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const wish = useRows<WishlistItem>("wishlist_items", [{ column: "created_at", ascending: false }], Boolean(user));

  useEffect(() => {
    let alive = true;
    setDeals(null);
    setError(null);
    fetch(`/api/deals?feed=${feed}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setDeals(d.deals ?? []);
        setError(d.error ?? null);
      })
      .catch(() => alive && setError("Couldn't load deals right now"));
    return () => {
      alive = false;
    };
  }, [feed]);

  const wanted = useMemo(() => wish.rows.filter((w) => !w.purchased), [wish.rows]);
  const wishMatches = useMemo(() => {
    const m = new Map<string, WishlistItem>();
    for (const d of deals ?? []) {
      const w = wanted.find((i) => matches(d, i));
      if (w) m.set(d.id, w);
    }
    return m;
  }, [deals, wanted]);

  const cats = useMemo(() => ["All", ...Array.from(new Set((deals ?? []).map((d) => d.category).filter(Boolean) as string[])).sort()], [deals]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (deals ?? [])
      .filter((d) => cat === "All" || d.category === cat)
      .filter((d) => !s || `${d.title} ${d.merchant ?? ""}`.toLowerCase().includes(s))
      .sort((a, b) => Number(wishMatches.has(b.id)) - Number(wishMatches.has(a.id)));
  }, [deals, cat, q, wishMatches]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-surface-2 p-1">
          {(["hot", "new"] as const).map((f) => (
            <button key={f} onClick={() => setFeed(f)} className={`min-h-9 rounded-full px-4 text-sm font-semibold ${feed === f ? "bg-accent text-white" : "text-muted"}`}>
              {f === "hot" ? "🔥 Hottest" : "✨ Newest"}
            </button>
          ))}
        </div>
        <label className="flex min-h-10 flex-1 items-center gap-2 rounded-full border border-line bg-bg-elevated px-4 focus-within:border-accent sm:max-w-xs">
          <Search size={15} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals or shops" className="w-full bg-transparent text-base outline-none" aria-label="Search deals" />
        </label>
      </div>

      {cats.length > 2 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${cat === c ? "bg-ink text-bg" : "card text-muted"}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {wishMatches.size > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
          <Gift size={16} /> {wishMatches.size} deal{wishMatches.size > 1 ? "s" : ""} match your wish list — shown first.
        </p>
      )}

      {error && <ErrorNote message={error} />}
      {!deals ? (
        <Spinner label="Finding deals" />
      ) : list.length === 0 ? (
        <p className="card p-6 text-sm text-muted">No deals match that.</p>
      ) : (
        <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d, i) => {
            const w = wishMatches.get(d.id);
            return (
              <li key={d.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <a href={d.link} target="_blank" rel="noopener noreferrer" className={`card card-interactive flex h-full gap-3 p-3 ${w ? "ring-2 ring-accent" : ""}`}>
                  {d.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image} alt="" loading="lazy" className="size-20 shrink-0 rounded-xl bg-white object-contain p-1" />
                  ) : (
                    <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-surface-2 text-faint">
                      <Sparkles size={20} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    {w && <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white">On your wish list</span>}
                    <span className="line-clamp-2 text-sm font-semibold leading-snug">{d.title}</span>
                    <span className="mt-auto flex items-center gap-2 pt-2 text-xs">
                      {d.price && <span className="font-display text-base font-semibold text-emerald-500">{d.price}</span>}
                      {d.merchant && <span className="truncate text-muted">{d.merchant}</span>}
                      <span className="ml-auto flex shrink-0 items-center gap-0.5 font-semibold" style={{ color: heatColor(d.heat) }}>
                        <Flame size={12} /> {d.heat ?? "–"}°
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-faint">
                      {timeAgo(d.published)} <ExternalLink size={10} />
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-faint">
        Deals are posted and voted on by the HotUKDeals community (° = how hot people rate it). Prices and codes can change or expire — check on the shop&apos;s site before buying.
      </p>
    </div>
  );
}
