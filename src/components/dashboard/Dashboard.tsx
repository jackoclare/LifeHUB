"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, Eye, EyeOff, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { cards, type CardDef, useDashboardPrefs } from "@/lib/dashboard";
import { formatDay, kindInfo, upcoming, useCalendarEvents } from "@/lib/calendar";
import { phaseNames } from "@/lib/nav";

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
  useEffect(() => setNow(new Date()), []);

  const byId = new Map(cards.map((c) => [c.id, c]));
  const ordered = prefs.order.map((id) => byId.get(id)!).filter(Boolean);
  const visible = ordered.filter((c) => !prefs.hidden.includes(c.id));

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted" suppressHydrationWarning>
            {now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : " "}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl" suppressHydrationWarning>
            {now ? greeting(now.getHours()) : "Hello"}, Jack
          </h1>
        </div>
        <button className={`btn ${editing ? "btn-primary" : "btn-ghost"}`} onClick={() => setEditing((e) => !e)}>
          {editing ? <Check size={16} /> : <SlidersHorizontal size={16} />}
          <span className="hidden sm:inline">{editing ? "Done" : "Customise"}</span>
        </button>
      </div>

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <DashCard key={c.id} card={c}>
              {c.id === "calendar" ? (
                <EventList items={upcoming(events, 14).slice(0, 4)} empty="Nothing in the next two weeks." />
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

function DashCard({ card, children }: { card: CardDef; children: React.ReactNode }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className={`card group flex flex-col p-4 transition-transform active:scale-[0.99] sm:p-5 ${card.wide ? "sm:col-span-2" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="icon-tile" style={{ "--tile": card.color } as React.CSSProperties}>
          <Icon size={18} />
        </span>
        <h2 className="flex-1 text-sm font-semibold">{card.title}</h2>
        <ArrowUpRight size={16} className="text-faint transition-colors group-hover:text-ink" />
      </div>
      <div className="flex-1">{children}</div>
    </Link>
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
