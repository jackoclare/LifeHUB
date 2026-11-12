"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, Bell, CalendarDays, Check, Eye, EyeOff, Mic, Plus, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { cards, type CardDef, useDashboardPrefs } from "@/lib/dashboard";
import { formatDay, fromISODate, kindInfo, upcoming, useCalendarEvents } from "@/lib/calendar";
import { phaseNames } from "@/lib/nav";
import { HeadlineRotator, LiveBadge, NewsTicker } from "@/components/news/NewsWidgets";
import { DailyBriefing } from "./DailyBriefing";
import { useAlerts } from "@/app/alerts/AlertsView";
import { WeatherSummary } from "@/components/weather/WeatherWidgets";
import { Crest, NextMatch } from "@/components/sport/SportWidgets";
import { DEFAULT_TEAMS, kickoffLabel, useTeams } from "@/lib/football";
import { useAuth } from "@/components/AuthProvider";
import { BillLogo } from "@/components/BillLogo";
import { money } from "@/components/ui";
import { useRows } from "@/lib/useRows";
import { dueLabel, isOverdue, monthlyEquivalent } from "@/lib/bills";
import type { Bill } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { usePlace } from "@/lib/weather";
import { readCache, writeCache } from "@/lib/cache";

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const { prefs, toggle, move, reset } = useDashboardPrefs();
  const { events } = useCalendarEvents();
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const byId = new Map(cards.map((c) => [c.id, c]));
  const ordered = prefs.order.map((id) => byId.get(id)!).filter(Boolean);
  const visible = ordered.filter((c) => !prefs.hidden.includes(c.id));

  return (
    <>
      <Hero now={now} next={upcoming(events, 60)[0]} editing={editing} onToggleEdit={() => setEditing((e) => !e)} />
      {!editing && !prefs.hidden.includes("news") && (
        <div className="animate-rise -mt-2 mb-6">
          <NewsTicker />
        </div>
      )}
      {!editing && <DailyBriefing events={events} />}

      {editing ? (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Show, hide and reorder sections</p>
            <button onClick={reset} className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
              <RotateCcw size={13} /> Reset
            </button>
          </div>
          <ul className="divide-y divide-line">
            {ordered.map((c, i) => {
              const hidden = prefs.hidden.includes(c.id);
              const Icon = c.icon;
              return (
                <li key={c.id} className={`flex items-center gap-3 px-4 py-2.5 ${hidden ? "opacity-50" : ""}`}>
                  <span className="icon-tile" style={{ "--tile": c.color } as React.CSSProperties}>
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 text-sm font-medium">{c.title}</span>
                  <IconBtn label="Move up" disabled={i === 0} onClick={() => move(c.id, -1)}>
                    <ArrowUp size={16} />
                  </IconBtn>
                  <IconBtn label="Move down" disabled={i === ordered.length - 1} onClick={() => move(c.id, 1)}>
                    <ArrowDown size={16} />
                  </IconBtn>
                  <IconBtn label={hidden ? `Show ${c.title}` : `Hide ${c.title}`} onClick={() => toggle(c.id)}>
                    {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconBtn>
                </li>
              );
            })}
          </ul>
        </section>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Every section is hidden. Tap <span className="font-semibold text-ink">Customise</span> to bring some back.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Live sections — real information */}
          {visible.some((c) => LIVE.has(c.id)) && (
            <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
              {visible
                .filter((c) => LIVE.has(c.id))
                .map((c, i) => (
                  <DashCard key={c.id} card={c} index={i} wholeLink={!["news", "sport-news", "weather", "football", "calendar", "reminders", "shopping"].includes(c.id)}>
                    {c.id === "football" ? (
                      <FootballSummary />
                    ) : c.id === "weather" ? (
                      <WeatherSummary />
                    ) : c.id === "news" ? (
                      <HeadlineRotator feed="news" accent="var(--accent)" />
                    ) : c.id === "sport-news" ? (
                      <HeadlineRotator feed="football" accent="var(--c-sport)" />
                    ) : c.id === "calendar" ? (
                      <EventList items={upcoming(events, 14).slice(0, 5)} empty="Nothing in the next two weeks." />
                    ) : c.id === "bills" ? (
                      <BillsSummary />
                    ) : c.id === "fuel" ? (
                      <FuelSummary />
                    ) : c.id === "shopping" ? (
                      <DealsSummary />
                    ) : (
                      <EventList items={upcoming(events, 30).filter((e) => e.kind === "reminder").slice(0, 4)} empty="No reminders set — add one from the calendar." />
                    )}
                  </DashCard>
                ))}
            </div>
          )}

          {/* Planned sections — compact tiles */}
          {visible.some((c) => !LIVE.has(c.id)) && (
            <section>
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="font-display text-lg font-semibold">Coming soon</h2>
                <span className="text-xs text-faint">Being built in stages</span>
              </div>
              <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {visible
                  .filter((c) => !LIVE.has(c.id))
                  .map((c, i) => (
                    <SoonTile key={c.id} card={c} index={i} />
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function Hero({ now, next, editing, onToggleEdit }: { now: Date | null; next?: ReturnType<typeof upcoming>[number]; editing: boolean; onToggleEdit: () => void }) {
  const alerts = useAlerts().filter((a) => a.days <= 3).length;
  return (
    <section className="animate-rise mb-5">
      {/* Greeting row: avatar · hello · bell */}
      <div className="flex items-center gap-3">
        <Link href="/settings" aria-label="Profile" className="grid size-14 shrink-0 place-items-center rounded-full font-display text-lg font-black italic text-[#fff4ea] shadow-lg transition-transform active:scale-95" style={{ background: "linear-gradient(135deg, #0a0c1c 0%, #4c1d95 60%, #ff5e3a 100%)" }}>
          JC
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted" suppressHydrationWarning>
            {now ? `${greeting(now.getHours())}!` : "Hello!"}
          </p>
          <h1 className="truncate text-2xl font-bold tracking-tight">Jack Clare</h1>
        </div>
        <Link href="/alerts" aria-label={`Alerts${alerts ? ` (${alerts})` : ""}`} className="relative grid size-12 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow)] transition-transform active:scale-95">
          <Bell size={20} />
          {alerts > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-bold text-white">{alerts}</span>}
        </Link>
      </div>

      {/* Ask anything — opens the assistant */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("lifehub-assistant"))}
          className="flex min-h-13 flex-1 items-center gap-3 rounded-2xl bg-surface px-4 text-left text-muted shadow-[var(--shadow)] transition-transform active:scale-[0.98]"
        >
          <Search size={19} />
          <span className="flex-1 truncate">Ask LifeHub anything…</span>
          <Mic size={18} className="text-accent" />
        </button>
        <button className="grid size-13 shrink-0 place-items-center rounded-2xl bg-accent text-white shadow-lg transition-transform active:scale-95" onClick={onToggleEdit} aria-label={editing ? "Finish customising" : "Customise dashboard"}>
          {editing ? <Check size={20} /> : <SlidersHorizontal size={20} />}
        </button>
      </div>

      {/* Date · next up */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        <span className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-sm font-medium shadow-[var(--shadow)]" suppressHydrationWarning>
          {now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : " "}
        </span>
        <Link href={next?.id.startsWith("match-") ? `/sport/match/${next.id.slice(6)}` : next?.kind === "bill" ? "/bills" : "/calendar"} className="flex min-w-0 shrink-0 items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-sm shadow-[var(--shadow)] transition-transform active:scale-95">
          <CalendarDays size={15} className="shrink-0 text-accent" />
          {next ? (
            <span className="truncate">
              <span className="font-semibold">{next.title}</span>
              <span className="text-muted"> · {formatDay(next.date)}{next.time ? ` ${next.time}` : ""}</span>
            </span>
          ) : (
            <span className="text-muted">Nothing planned</span>
          )}
        </Link>
        <Link href="/calendar" className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-accent shadow-[var(--shadow)]" aria-label="Add an event">
          <Plus size={16} />
        </Link>
      </div>
    </section>
  );
}

function DashCard({ card, index, children, wholeLink = true }: { card: CardDef; index: number; children: React.ReactNode; wholeLink?: boolean }) {
  const Icon = card.icon;
  const style = { "--tile": card.color, "--i": index } as React.CSSProperties;
  const cls = `card card-interactive flex flex-col p-4 sm:p-5 ${card.wide ? "md:col-span-2" : ""}`;
  const header = (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="icon-tile">
        <Icon size={18} />
      </span>
      <h2 className="flex-1 text-sm font-semibold">{card.title}</h2>
      {(card.id === "news" || card.id === "sport-news") && <LiveBadge />}
      <ArrowUpRight size={16} className="card-arrow text-faint" />
    </div>
  );
  if (!wholeLink) {
    // Cards whose content has its own links (e.g. news) — only the header links through
    return (
      <div style={style} className={cls}>
        <Link href={card.href}>{header}</Link>
        <div className="flex-1">{children}</div>
      </div>
    );
  }
  return (
    <Link href={card.href} style={style} className={cls}>
      {header}
      <div className="flex-1">{children}</div>
    </Link>
  );
}

function BillsSummary() {
  const { user, loading } = useAuth();
  const { rows, loading: billsLoading } = useRows<Bill>("bills", [{ column: "next_due_date" }]);
  if (loading || (user && billsLoading)) return <p className="text-sm text-muted">Loading…</p>;
  if (!user) return <p className="text-sm text-muted">Sign in (Settings) to see what&apos;s due and anything overdue.</p>;
  const active = rows.filter((b) => b.is_active);
  if (!active.length) return <p className="text-sm text-muted">No bills added yet.</p>;
  const overdue = active.filter((b) => isOverdue(b));
  const monthly = active.reduce((s, b) => s + monthlyEquivalent(b), 0);
  return (
    <div>
      {overdue.length > 0 && (
        <p className="mb-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400">
          {overdue.length} overdue · {money(overdue.reduce((s, b) => s + Number(b.amount), 0))}
        </p>
      )}
      <ul className="space-y-2">
        {active.slice(0, 3).map((b) => (
          <li key={b.id} className="flex items-center gap-2.5">
            <BillLogo website={b.website} category={b.category} tone="var(--c-money)" size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{b.name}</span>
              <span className="block text-xs text-muted">{dueLabel(b.next_due_date)}</span>
            </span>
            <span className="text-sm font-semibold tabular-nums">{money(b.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-2 text-xs text-muted">About {money(monthly)} a month in total</p>
    </div>
  );
}

type MiniDeal = { id: string; title: string; link: string; merchant: string | null; price: string | null; heat: number | null; image: string | null };

function DealsSummary() {
  const [deals, setDeals] = useState<MiniDeal[] | null>(null);
  useEffect(() => {
    let alive = true;
    const cached = readCache<MiniDeal[]>("deals:hot:3", 3 * 3600e3);
    if (cached?.length) setDeals(cached);
    fetch("/api/deals?feed=hot")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const top = (d.deals ?? []).slice(0, 3);
        if (top.length) writeCache("deals:hot:3", top);
        setDeals(top);
      })
      .catch(() => alive && setDeals([]));
    return () => {
      alive = false;
    };
  }, []);
  if (!deals) return <div className="h-24 animate-pulse rounded-xl bg-surface-2" />;
  if (!deals.length) return <p className="text-sm text-muted">Couldn&apos;t load deals right now.</p>;
  return (
    <ul className="space-y-2">
      {deals.map((d) => (
        <li key={d.id}>
          <a href={d.link} target="_blank" rel="noopener noreferrer" className="-mx-1 flex items-center gap-2.5 rounded-xl px-1 py-1 transition-colors hover:bg-surface-2">
            {d.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.image} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg bg-white object-contain p-0.5" />
            ) : (
              <span className="size-10 shrink-0 rounded-lg bg-surface-2" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{d.title}</span>
              <span className="block truncate text-xs text-muted">
                {[d.price, d.merchant].filter(Boolean).join(" · ")} {d.heat != null && <span className="font-semibold text-orange-400">· {d.heat}°</span>}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

type CheapFuel = { name: string; brand: string | null; price: number; distance_km: number };

function FuelSummary() {
  const { place, ready } = usePlace();
  const [rows, setRows] = useState<{ label: string; s: CheapFuel | null }[] | null>(null);
  useEffect(() => {
    if (!place) return;
    let alive = true;
    const supabase = createClient();
    const fuels = [
      { id: "E10", label: "Unleaded" },
      { id: "B7_Standard", label: "Diesel" },
    ];
    Promise.all(fuels.map((f) => supabase.rpc("nearby_fuel", { p_lat: place.lat, p_lon: place.lon, p_radius_km: 16, p_fuel: f.id }))).then((res) => {
      if (!alive) return;
      setRows(fuels.map((f, i) => ({ label: f.label, s: ((res[i].data as CheapFuel[]) ?? [])[0] ?? null })));
    });
    return () => {
      alive = false;
    };
  }, [place]);
  if (!ready) return null;
  if (!place) return <p className="text-sm text-muted">Set your location on the weather card to see the cheapest fuel near you.</p>;
  if (!rows) return <div className="h-20 animate-pulse rounded-xl bg-surface-2" />;
  return (
    <ul className="space-y-2.5">
      {rows.map(({ label, s }) => (
        <li key={label} className="flex items-center gap-3">
          <span className="grid min-w-16 place-items-center rounded-xl bg-emerald-500/15 px-2 py-1.5 font-display text-base font-semibold tabular-nums text-emerald-500">
            {s ? `${Number(s.price).toFixed(1)}p` : "—"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block truncate text-xs text-muted">{s ? `${s.brand ?? s.name} · ${(s.distance_km * 0.621371).toFixed(1)} mi` : "None listed within 10 miles"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function FootballSummary() {
  const { data, loading } = useTeams(DEFAULT_TEAMS);
  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-surface-2" />;
  const teams = DEFAULT_TEAMS.map((t) => data[t.id]).filter(Boolean);
  const first = teams[0];
  return (
    <div className="space-y-3">
      {first && <NextMatch data={first} compact />}
      {teams.slice(1).map((d) =>
        d.next[0] ? (
          <Link
            key={d.team.id}
            href={`/sport/match/${d.next[0].id}`}
            className="-mx-1 flex min-h-11 items-center gap-2 rounded-xl border-t border-line px-1 pt-2 text-xs text-muted transition-colors hover:bg-surface-2 active:scale-[0.99]"
          >
            <Crest src={d.team.badge} alt="" size={18} />
            <span className="min-w-0 flex-1 truncate font-medium text-ink">
              {d.next[0].home} v {d.next[0].away}
            </span>
            <span className="shrink-0">{kickoffLabel(d.next[0])}</span>
          </Link>
        ) : null,
      )}
    </div>
  );
}

const LIVE = new Set<CardDef["id"]>(["calendar", "weather", "bills", "football", "fuel", "shopping", "news", "sport-news", "reminders"]);

function SoonTile({ card, index }: { card: CardDef; index: number }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      title={card.promise}
      style={{ "--tile": card.color, "--i": index } as React.CSSProperties}
      className="card card-interactive flex flex-col gap-3 p-3.5"
    >
      <span className="icon-tile size-10! rounded-xl!">
        <Icon size={20} />
      </span>
      <span>
        <span className="block text-sm font-semibold leading-tight">{card.title}</span>
        <span className="mt-1 block text-[0.68rem] font-medium text-faint">
          Phase {card.phase} · {phaseNames[card.phase].split(" ")[0]}
        </span>
      </span>
    </Link>
  );
}

function EventList({ items, empty }: { items: ReturnType<typeof upcoming>; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((e) => {
        const d = fromISODate(e.date);
        const color = kindInfo[e.kind].color;
        return (
          <li key={e.id}>
            <Link
              href={e.id.startsWith("match-") ? `/sport/match/${e.id.slice(6)}` : e.kind === "bill" ? "/bills" : "/calendar"}
              className="-mx-1 flex items-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-surface-2 active:scale-[0.99]"
            >
            <span
              className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none"
              style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
            >
              <span className="text-[0.6rem] font-bold uppercase tracking-wider">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
              <span className="mt-0.5 font-display text-base font-semibold">{d.getDate()}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{e.title}</span>
              <span className="block text-xs text-muted">
                {formatDay(e.date)}
                {e.time ? ` · ${e.time}` : ""} · {e.kind === "bill" && e.amount != null ? money(e.amount) : kindInfo[e.kind].label}
              </span>
            </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
