"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, CalendarDays, Check, Eye, EyeOff, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { cards, type CardDef, useDashboardPrefs } from "@/lib/dashboard";
import { formatDay, kindInfo, upcoming, useCalendarEvents } from "@/lib/calendar";
import { phaseNames } from "@/lib/nav";
import { useAuth } from "@/components/AuthProvider";
import { BillLogo } from "@/components/BillLogo";
import { money } from "@/components/ui";
import { useRows } from "@/lib/useRows";
import { dueLabel, isOverdue, monthlyEquivalent } from "@/lib/bills";
import type { Bill } from "@/lib/types";

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
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c, i) => (
            <DashCard key={c.id} card={c} index={i}>
              {c.id === "calendar" ? (
                <EventList items={upcoming(events, 14).slice(0, 4)} empty="Nothing in the next two weeks." />
              ) : c.id === "bills" ? (
                <BillsSummary />
              ) : c.id === "reminders" ? (
                <EventList items={upcoming(events, 30).filter((e) => e.kind === "reminder").slice(0, 3)} empty="No reminders set." />
              ) : (
                <NotConnected card={c} />
              )}
            </DashCard>
          ))}
        </div>
      )}
    </>
  );
}

function Hero({ now, next, editing, onToggleEdit }: { now: Date | null; next?: ReturnType<typeof upcoming>[number]; editing: boolean; onToggleEdit: () => void }) {
  const hh = now ? String(now.getHours()).padStart(2, "0") : "--";
  const mm = now ? String(now.getMinutes()).padStart(2, "0") : "--";
  return (
    <section className="hero animate-rise mb-6 p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-muted" suppressHydrationWarning>
            <span className="pulse-dot size-2 rounded-full bg-accent" />
            {now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : " "}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-tight" suppressHydrationWarning>
            {now ? greeting(now.getHours()) : "Hello"}, Jack
          </h1>
        </div>
        <p className="shrink-0 font-display text-3xl font-medium tabular-nums tracking-tight text-muted sm:text-5xl" suppressHydrationWarning aria-label="Current time">
          {hh}
          <span className="blink">:</span>
          {mm}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href="/calendar" className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl bg-surface-2/80 px-3.5 py-2 text-sm transition-colors hover:bg-surface-2">
          <CalendarDays size={16} className="shrink-0 text-accent" />
          {next ? (
            <span className="truncate">
              <span className="text-muted">Next: </span>
              <span className="font-semibold">{next.title}</span>
              <span className="text-muted"> · {formatDay(next.date)}{next.time ? ` ${next.time}` : ""}</span>
            </span>
          ) : (
            <span className="text-muted">Nothing planned yet — add something</span>
          )}
        </Link>
        <div className="ml-auto flex gap-2">
          <Link href="/calendar" className="btn btn-primary" aria-label="Add an event">
            <Plus size={16} /> <span className="hidden sm:inline">Add event</span>
          </Link>
          <button className={`btn ${editing ? "btn-primary" : "btn-ghost"}`} onClick={onToggleEdit} aria-label={editing ? "Finish customising" : "Customise dashboard"}>
            {editing ? <Check size={16} /> : <SlidersHorizontal size={16} />}
            <span className="hidden sm:inline">{editing ? "Done" : "Customise"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function DashCard({ card, index, children }: { card: CardDef; index: number; children: React.ReactNode }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      style={{ "--tile": card.color, "--i": index } as React.CSSProperties}
      className={`card card-interactive flex flex-col p-4 sm:p-5 ${card.wide ? "sm:col-span-2" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="icon-tile">
          <Icon size={18} />
        </span>
        <h2 className="flex-1 text-sm font-semibold">{card.title}</h2>
        <ArrowUpRight size={16} className="card-arrow text-faint" />
      </div>
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

function NotConnected({ card }: { card: CardDef }) {
  return (
    <div>
      <p className="text-sm text-muted">{card.promise}</p>
      <span className="chip mt-3">
        Phase {card.phase} · {phaseNames[card.phase]}
      </span>
    </div>
  );
}

function EventList({ items, empty }: { items: ReturnType<typeof upcoming>; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((e) => (
        <li key={e.id} className="flex items-center gap-3">
          <span className="h-7 w-1 rounded-full" style={{ background: kindInfo[e.kind].color }} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</span>
          <span className="shrink-0 text-xs text-muted">
            {formatDay(e.date)}
            {e.time ? ` · ${e.time}` : ""}
          </span>
        </li>
      ))}
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
