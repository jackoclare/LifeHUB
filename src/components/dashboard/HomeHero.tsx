"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Bell,
  CalendarPlus,
  Check,
  Fuel,
  HeartPulse,
  Map as MapIcon,
  Mic,
  PoundSterling,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Tv,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useAlerts } from "@/app/alerts/AlertsView";
import { WeatherIcon } from "@/components/weather/WeatherWidgets";
import { upcoming, type CalendarEvent } from "@/lib/calendar";
import { describe, usePlace, useWeather } from "@/lib/weather";

/* ---------- helpers ---------- */

function greeting(h: number) {
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Background for the hero card that follows the time of day */
function skyFor(h: number) {
  if (h >= 5 && h < 9) return "linear-gradient(140deg, #ff8a5c 0%, #ff5e7e 45%, #7b5cff 100%)"; // sunrise
  if (h >= 9 && h < 16) return "linear-gradient(140deg, #2f80ff 0%, #4f5bff 50%, #8a4dff 100%)"; // day
  if (h >= 16 && h < 19) return "linear-gradient(140deg, #ff9f43 0%, #ff4f81 50%, #6a3cff 100%)"; // golden hour
  return "linear-gradient(140deg, #141a3d 0%, #3b2a8f 55%, #7a2e9c 100%)"; // night
}

/** "Today 15:00", "Tomorrow", "In 3 days", "Sat 21 Nov" */
export function whenLabel(e: Pick<CalendarEvent, "date" | "time">, now: Date) {
  const d = new Date(`${e.date}T12:00:00`);
  const t = new Date(`${now.toLocaleDateString("en-CA")}T12:00:00`);
  const days = Math.round((d.getTime() - t.getTime()) / 86400e3);
  if (days === 0) {
    if (e.time) {
      const [h, m] = e.time.split(":").map(Number);
      const mins = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
      if (mins > 0 && mins < 60) return `In ${mins} min`;
      if (mins >= 60 && mins < 6 * 60) return `In ${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ""}`.trim();
      return `Today ${e.time}`;
    }
    return "Today";
  }
  if (days === 1) return e.time ? `Tomorrow ${e.time}` : "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function eventHref(e: CalendarEvent) {
  return e.id.startsWith("match-") ? `/sport/match/${e.id.slice(6)}` : e.kind === "bill" ? "/bills" : "/calendar";
}

/* ---------- Spotlight: cards light up where your finger / mouse is ---------- */

export function useSpotlight() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const el = t && typeof t.closest === "function" ? (t.closest(".dash-card, .hero-card, .quick-tile") as HTMLElement | null) : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, []);
}

/* ---------- Hero ---------- */

export function HomeHero({ now, events, editing, onToggleEdit }: { now: Date | null; events: CalendarEvent[]; editing: boolean; onToggleEdit: () => void }) {
  const hour = now?.getHours() ?? 12;
  // Bills live on the Bills page only, so they're left out of Home
  const alerts = useAlerts().filter((a) => a.href !== "/bills");
  const soon = alerts.filter((a) => a.days <= 3).length;
  const next = upcoming(events, 60).filter((e) => e.kind !== "bill")[0];
  return (
    <section className="animate-rise mb-5">
      <div className="hero-card hero-dark relative overflow-hidden rounded-[2rem] p-5 sm:p-6">
        {/* futuristic layers: fine grid, electric glow, light sweep */}
        <span aria-hidden className="hero-grid" />
        <span aria-hidden className="hero-glow hero-glow-a" />
        <span aria-hidden className="hero-glow hero-glow-b" />
        <span aria-hidden className="hero-sweep" />
        {/* avatar · greeting · bell */}
        <div className="relative flex items-center gap-3">
          <Link href="/settings" aria-label="Profile" className="avatar-ring grid size-12 shrink-0 place-items-center rounded-full font-display text-base font-bold text-white transition-transform active:scale-90">
            JC
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted" suppressHydrationWarning>
              {now ? `${greeting(hour)},` : "Hello,"}
            </p>
            <h1 className="truncate text-[1.45rem] font-bold leading-tight tracking-tight">Jack</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-faint">
              <span className="status-dot" /> {soon ? `${soon} need${soon === 1 ? "s" : ""} attention` : "All systems normal"}
            </p>
          </div>
          <Link href="/alerts" aria-label={`Alerts${soon ? ` (${soon})` : ""}`} className="hero-glass relative grid size-11 shrink-0 place-items-center rounded-full transition-transform active:scale-90">
            <Bell size={19} className={soon ? "bell-ring" : ""} />
            {soon > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-bold ring-2 ring-surface text-white">{soon}</span>}
          </Link>
        </div>

        {/* time · weather */}
        <div className="relative mt-6 flex items-end justify-between gap-3">
          <div>
            <p className="hero-clock font-display text-[3.8rem] font-extralight leading-none tracking-tight tabular-nums" suppressHydrationWarning>
              {now ? (
                <>
                  {String(now.getHours()).padStart(2, "0")}
                  <span className="clock-colon">:</span>
                  {String(now.getMinutes()).padStart(2, "0")}
                </>
              ) : (
                "--:--"
              )}
            </p>
            <p className="mt-2 text-sm font-medium text-muted" suppressHydrationWarning>
              {now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : " "}
            </p>
          </div>
          <HeroWeather />
        </div>

        {/* glass stat chips */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link href={next ? eventHref(next) : "/calendar"} className="hero-glass hero-chip col-span-2">
            <span className="hero-chip-label">Next up</span>
            {next ? (
              <>
                <span className="truncate text-[0.95rem] font-semibold">{next.title}</span>
                <span className="text-xs text-muted" suppressHydrationWarning>
                  {now ? whenLabel(next, now) : ""}
                </span>
              </>
            ) : (
              <span className="text-[0.95rem] font-semibold">Nothing planned</span>
            )}
          </Link>
          <Link href="/alerts" className="hero-glass hero-chip col-span-1">
            <span className="hero-chip-label">Alerts</span>
            <span className="text-[0.95rem] font-semibold">{alerts.length || "All clear"}</span>
            <span className="text-xs text-muted">{soon ? `${soon} in 3 days` : alerts.length ? "Nothing urgent" : "✓"}</span>
          </Link>
          {/* the assistant */}
          <button onClick={() => window.dispatchEvent(new CustomEvent("lifehub-assistant"))} className="hero-glass hero-chip col-span-1 items-start text-left">
            <span className="hero-chip-label">Assistant</span>
            <Sparkles size={18} className="mt-0.5" />
            <span className="text-xs text-muted">Ask me</span>
          </button>
        </div>
      </div>

      {/* Ask anything + customise */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("lifehub-assistant"))}
          className="flex min-h-13 flex-1 items-center gap-3 rounded-2xl bg-surface px-4 text-left text-muted shadow-[var(--shadow)] ring-1 ring-line transition-transform active:scale-[0.98]"
        >
          <Search size={19} />
          <span className="flex-1 truncate">Ask LifeHub anything…</span>
          <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent">
            <Mic size={16} />
          </span>
        </button>
        <button
          className="grid size-13 shrink-0 place-items-center rounded-2xl bg-ink text-bg shadow-lg transition-transform active:scale-90"
          onClick={onToggleEdit}
          aria-label={editing ? "Finish customising" : "Customise dashboard"}
        >
          {editing ? <Check size={20} /> : <SlidersHorizontal size={20} />}
        </button>
      </div>
    </section>
  );
}

function HeroWeather() {
  const { place } = usePlace();
  const { data } = useWeather(place);
  if (!place) {
    return (
      <Link href="/weather" className="hero-glass rounded-2xl px-3 py-2 text-xs font-semibold">
        Set location
      </Link>
    );
  }
  if (!data) return <span className="hero-glass block h-16 w-24 animate-pulse rounded-2xl" />;
  const c = data.current;
  const d = data.daily[0];
  return (
    <Link href="/weather" className="flex items-center gap-2 text-right transition-transform active:scale-95">
      <span className="weather-float">
        <WeatherIcon code={c.code} isDay={c.isDay} size={46} />
      </span>
      <span>
        <span className="block font-display text-3xl font-bold leading-none tabular-nums">{Math.round(c.temp)}°</span>
        <span className="mt-1 block text-xs font-medium text-muted">{describe(c.code).label}</span>
        {d && (
          <span className="block text-[0.7rem] text-faint tabular-nums">
            H {Math.round(d.max)}° · L {Math.round(d.min)}°
          </span>
        )}
      </span>
    </Link>
  );
}

/* ---------- Quick actions ---------- */

const ACTIONS: { label: string; href?: string; assistant?: boolean; icon: LucideIcon; from: string; to: string }[] = [
  { label: "Add event", href: "/calendar", icon: CalendarPlus, from: "#4f8cff", to: "#2f5bff" },
  { label: "Shopping", href: "/shopping", icon: ShoppingCart, from: "#ffb341", to: "#ff7a1a" },
  { label: "Money", href: "/money", icon: PoundSterling, from: "#3ddc84", to: "#16a34a" },
  { label: "Ask AI", assistant: true, icon: Sparkles, from: "#c084fc", to: "#7c3aed" },
  { label: "Fuel", href: "/fuel", icon: Fuel, from: "#34d3c8", to: "#0e9f9a" },
  { label: "Map", href: "/map", icon: MapIcon, from: "#60a5fa", to: "#0ea5e9" },
  { label: "Eat out", href: "/explore", icon: Utensils, from: "#fb7185", to: "#e11d48" },
  { label: "TV", href: "/tv", icon: Tv, from: "#818cf8", to: "#4f46e5" },
  { label: "Health", href: "/health", icon: HeartPulse, from: "#ff6b8b", to: "#ff2d55" },
];

export function QuickActions() {
  return (
    <div className="stagger -mx-4 mb-6 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-9 sm:overflow-visible sm:px-0">
      {ACTIONS.map((a, i) => {
        const Icon = a.icon;
        const inner = (
          <>
            <span className="quick-tile" style={{ color: a.to }}>
              <Icon size={22} strokeWidth={2.2} />
            </span>
            <span className="mt-1.5 block w-16 truncate text-center text-xs font-medium text-muted">{a.label}</span>
          </>
        );
        const cls = "quick-action flex shrink-0 snap-start flex-col items-center";
        return a.assistant ? (
          <button key={a.label} style={{ "--i": i } as React.CSSProperties} className={cls} onClick={() => window.dispatchEvent(new CustomEvent("lifehub-assistant"))}>
            {inner}
          </button>
        ) : (
          <Link key={a.label} href={a.href!} style={{ "--i": i } as React.CSSProperties} className={cls}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

/* ---------- Filter groups for the cards below ---------- */

export type HomeFilter = "all" | "today" | "money" | "sport" | "out" | "health";
export const HOME_FILTERS: { value: HomeFilter; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "✨" },
  { value: "today", label: "Today", icon: "☀️" },
  { value: "money", label: "Fuel & deals", icon: "🏷️" },
  { value: "sport", label: "Sport & TV", icon: "⚽" },
  { value: "out", label: "Out & about", icon: "🧭" },
  { value: "health", label: "Health", icon: "❤️" },
];
export const FILTER_CARDS: Record<Exclude<HomeFilter, "all">, string[]> = {
  today: ["calendar", "weather", "reminders", "tv"],
  money: ["fuel", "shopping"],
  sport: ["football", "sport-news", "tv", "news"],
  out: ["weather", "fuel", "local", "travel"],
  health: ["activity", "nutrition"],
};
