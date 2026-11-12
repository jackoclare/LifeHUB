"use client";

import { ChevronLeft, ChevronRight, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { type Feed, type Headline, timeAgo, useHeadlines } from "@/lib/news";

/* ---------------- LIVE badge ---------------- */

export function LiveBadge({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.14em] text-red-400">
      <span className="pulse-dot size-1.5 rounded-full bg-red-500" />
      {label}
    </span>
  );
}

/* ---------------- Scrolling ticker ---------------- */

export function NewsTicker({ feed = "news" }: { feed?: Feed }) {
  const { items } = useHeadlines(feed);
  if (!items.length) return null;
  const list = items.slice(0, 12);
  return (
    <div className="ticker card relative flex items-center overflow-hidden py-2.5" aria-label="Latest headlines">
      <div className="z-10 flex shrink-0 items-center gap-2 bg-gradient-to-r from-[var(--surface)] from-70% to-transparent pl-3 pr-6">
        <LiveBadge />
      </div>
      <div className="ticker-track flex shrink-0 gap-10 whitespace-nowrap" style={{ animationDuration: `${list.length * 7}s` }}>
        {[...list, ...list].map((h, i) => (
          <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium hover:text-accent" aria-hidden={i >= list.length}>
            <span className="size-1 rounded-full bg-accent" />
            {h.title}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Rotating headline card (dashboard) ---------------- */

export function HeadlineRotator({ feed, accent }: { feed: Feed; accent: string }) {
  const { items, loading, error, fetchedAt } = useHeadlines(feed);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const list = items.slice(0, 8);

  useEffect(() => {
    if (paused || list.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % list.length), 6000);
    return () => clearInterval(t);
  }, [paused, list.length]);

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-surface-2" />;
  if (error || !list.length) return <p className="text-sm text-muted">{error ?? "No headlines right now."}</p>;

  const h = list[i % list.length];
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}>
      <a key={h.link} href={h.link} target="_blank" rel="noopener noreferrer" className="headline-in group block" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[16/8] overflow-hidden rounded-xl bg-surface-2">
          {h.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={h.image} alt="" className="kenburns size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid size-full place-items-center text-faint">
              <Newspaper size={32} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3.5">
            <p className="line-clamp-2 font-display text-[0.98rem] font-semibold leading-snug text-white">{h.title}</p>
            <p className="mt-1 text-[0.7rem] text-white/70">BBC · {timeAgo(h.published)}</p>
          </div>
        </div>
      </a>
      {/* progress + controls */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setI((n) => (n - 1 + list.length) % list.length);
          }}
          className="grid size-8 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-ink"
          aria-label="Previous headline"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex flex-1 gap-1">
          {list.map((_, n) => (
            <span key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
              {n === i % list.length ? (
                <span key={`${i}-${paused}`} className={`block h-full rounded-full ${paused ? "w-full" : "progress-fill"}`} style={{ background: accent }} />
              ) : n < i % list.length ? (
                <span className="block h-full w-full rounded-full opacity-40" style={{ background: accent }} />
              ) : null}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setI((n) => (n + 1) % list.length);
          }}
          className="grid size-8 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-ink"
          aria-label="Next headline"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {fetchedAt && <p className="mt-1 text-[0.65rem] text-faint">Updated {timeAgo(fetchedAt)} · refreshes every 10 min</p>}
    </div>
  );
}

/* ---------------- Full list (news page) ---------------- */

export function HeadlineList({ items }: { items: Headline[] }) {
  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((h, i) => (
        <a
          key={h.link}
          href={h.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
          className={`card card-interactive group flex flex-col overflow-hidden ${i === 0 ? "sm:col-span-2 xl:row-span-2" : ""}`}
        >
          <div className={`relative overflow-hidden bg-surface-2 ${i === 0 ? "aspect-[16/9] xl:flex-1" : "aspect-[16/8]"}`}>
            {h.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
            )}
            {i === 0 && (
              <span className="absolute left-3 top-3">
                <LiveBadge label="TOP STORY" />
              </span>
            )}
          </div>
          <div className="p-4">
            <h3 className={`font-display font-semibold leading-snug ${i === 0 ? "text-xl" : "text-[0.98rem]"}`}>{h.title}</h3>
            {h.summary && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{h.summary}</p>}
            <p className="mt-2 text-xs text-faint">BBC · {timeAgo(h.published)}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
