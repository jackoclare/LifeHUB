"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/** "Title ........ See all" section header */
export function SectionHeader({ title, href, action = "See all", className = "" }: { title: string; href?: string; action?: string; className?: string }) {
  return (
    <div className={`mb-3 flex items-end justify-between px-1 ${className}`}>
      <h2 className="text-[1.3rem] font-bold tracking-tight">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
          {action}
        </Link>
      )}
    </div>
  );
}

/** Horizontal strip of pill-shaped days (Mon 02, Tue 03 …), the selected one filled with the accent colour */
export function DateStrip({
  days,
  value,
  onChange,
  accent = "var(--accent)",
  dark = false,
  dots,
}: {
  days: string[]; // ISO dates
  value: string;
  onChange: (iso: string) => void;
  accent?: string;
  dark?: boolean;
  dots?: Record<string, string[]>; // iso -> colours of little markers under the day
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-iso="${value}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <div ref={ref} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {days.map((iso) => {
        const d = new Date(`${iso}T12:00:00`);
        const on = iso === value;
        return (
          <button
            key={iso}
            data-iso={iso}
            onClick={() => onChange(iso)}
            className={`flex min-w-[3.6rem] shrink-0 snap-center flex-col items-center gap-1 rounded-full px-2 pb-3 pt-2.5 transition-all duration-300 active:scale-95 ${
              on ? "text-white shadow-lg" : dark ? "bg-white/[0.06] text-white/80" : "bg-surface text-ink shadow-[var(--shadow)]"
            }`}
            style={on ? { background: accent, color: dark ? "#0b0d07" : "#fff", boxShadow: `0 10px 24px -10px ${accent}` } : undefined}
            aria-pressed={on}
          >
            <span className={`grid size-9 place-items-center rounded-full text-[0.95rem] font-bold tabular-nums ${on ? (dark ? "bg-black/10" : "bg-white text-ink") : ""}`}>{d.getDate().toString().padStart(2, "0")}</span>
            <span className="text-xs font-medium">{iso === today ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
            {dots?.[iso]?.length ? (
              <span className="flex gap-0.5">
                {dots[iso].slice(0, 3).map((c, i) => (
                  <span key={i} className="size-1.5 rounded-full" style={{ background: on ? "currentColor" : c }} />
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Rounded pill tabs, optionally with an icon/emoji bubble (like category chips) */
export function PillTabs<T extends string>({
  value,
  options,
  onChange,
  accent = "var(--accent)",
  dark = false,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  accent?: string;
  dark?: boolean;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`flex min-h-12 shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-[0.95rem] font-semibold transition-all duration-300 active:scale-95 ${
              on ? "" : dark ? "bg-white/[0.06] text-white/80" : "bg-surface text-ink shadow-[var(--shadow)]"
            } ${o.icon ? "" : "pl-4"}`}
            style={on ? { background: dark ? "transparent" : accent, color: dark ? "#fff" : "#fff", boxShadow: dark ? `inset 0 0 0 2px ${accent}` : `0 10px 24px -12px ${accent}` } : undefined}
          >
            {o.icon && <span className={`grid size-9 place-items-center rounded-full text-lg ${on && !dark ? "bg-white" : dark ? "bg-white/10" : "bg-surface-2"}`}>{o.icon}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** ISO dates for the 7 days of the week containing `iso` (Mon–Sun), or n days from a start */
export function weekOf(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return x.toLocaleDateString("en-CA");
  });
}
export function daysFrom(iso: string, n: number, back = 0) {
  const d = new Date(`${iso}T12:00:00`);
  return Array.from({ length: n + back }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i - back);
    return x.toLocaleDateString("en-CA");
  });
}
