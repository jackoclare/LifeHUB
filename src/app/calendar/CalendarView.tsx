"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { ErrorNote, money } from "@/components/ui";
import { CalendarFeed } from "@/components/CalendarFeed";
import { useMemo, useState } from "react";
import {
  type EventKind,
  fromISODate,
  kindInfo,
  manualKinds,
  toISODate,
  useCalendarEvents,
} from "@/lib/calendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function CalendarView() {
  const { events, add, remove, signedIn, error: loadError } = useCalendarEvents();
  const [err, setErr] = useState<string | null>(null);
  const today = toISODate(new Date());
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [adding, setAdding] = useState(false);

  const days = useMemo(() => buildMonth(cursor.y, cursor.m), [cursor]);
  const byDate = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const shift = (n: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const goToday = () => {
    const n = new Date();
    setCursor({ y: n.getFullYear(), m: n.getMonth() });
    setSelected(today);
  };

  const dayEvents = byDate.get(selected) ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      {/* ---------- Month grid ---------- */}
      <section className="card p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-semibold">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost h-9! min-h-0! px-3! text-xs" onClick={goToday}>
              Today
            </button>
            <button className="grid size-10 place-items-center rounded-full hover:bg-surface-2" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft size={20} />
            </button>
            <button className="grid size-10 place-items-center rounded-full hover:bg-surface-2" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[0.68rem] font-semibold uppercase tracking-wider text-faint">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const iso = toISODate(d);
            const inMonth = d.getMonth() === cursor.m;
            const isToday = iso === today;
            const isSel = iso === selected;
            const evs = byDate.get(iso) ?? [];
            return (
              <button
                key={iso}
                onClick={() => setSelected(iso)}
                aria-label={`${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, ${evs.length} events`}
                aria-pressed={isSel}
                className={`flex aspect-square flex-col items-center justify-start rounded-xl pt-1.5 text-sm transition-[background-color,transform] duration-200 active:scale-90 sm:aspect-[1.1] ${
                  isSel ? "bg-accent-soft" : "hover:bg-surface-2"
                } ${inMonth ? "" : "opacity-35"}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full font-semibold transition-transform duration-300 ${
                    isToday ? "bg-accent text-white shadow-[0_6px_16px_-6px_var(--accent)]" : isSel ? "text-accent" : ""
                  } ${isSel ? "scale-110" : ""}`}
                >
                  {d.getDate()}
                </span>
                <span className="mt-1 flex gap-0.5">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className="animate-pop size-1.5 rounded-full" style={{ background: kindInfo[e.kind].color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------- Selected day ---------- */}
      <aside className="space-y-5">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">
              {fromISODate(selected).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            <button className="btn btn-primary h-9! min-h-0! px-3! text-xs" onClick={() => setAdding(true)}>
              <Plus size={14} /> Add
            </button>
          </div>

          {dayEvents.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing on this day.</p>
          ) : (
            <ul key={selected} className="stagger mt-4 space-y-2">
              {dayEvents.map((e, i) => (
                <li key={e.id} style={{ "--i": i } as React.CSSProperties}>
                  {e.readOnly ? (
                    <Link
                      href={e.kind === "bill" ? "/bills" : e.id.startsWith("match-") ? `/sport/match/${e.id.slice(6)}` : e.kind === "holiday" ? "https://www.gov.uk/bank-holidays" : "/sport"}
                      className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 transition-colors hover:brightness-110 active:scale-[0.99]"
                      aria-label={`Open ${e.title}`}
                    >
                      <span className="h-8 w-1 rounded-full" style={{ background: kindInfo[e.kind].color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.title}</p>
                        <p className="text-xs text-muted">
                          {e.kind === "bill" ? money(e.amount) : (e.time ?? "All day")} · {e.kind === "football" ? "Lineups & match details" : kindInfo[e.kind].label}
                        </p>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-faint" />
                    </Link>
                  ) : (
                  <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="h-8 w-1 rounded-full" style={{ background: kindInfo[e.kind].color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="text-xs text-muted">
                      {e.time ?? "All day"} · {kindInfo[e.kind].label}
                    </p>
                  </div>
                  {(
                    <button
                      onClick={async () => setErr(await remove(e.id))}
                      className="grid size-10 place-items-center rounded-full text-faint hover:text-ink"
                      aria-label={`Delete ${e.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {adding && (
            <AddEventForm
              date={selected}
              onCancel={() => setAdding(false)}
              onSave={async (e) => {
                const msg = await add(e);
                setErr(msg);
                if (!msg) setAdding(false);
              }}
            />
          )}
          {(err ?? loadError) && (
            <div className="mt-3">
              <ErrorNote message={(err ?? loadError)!} />
            </div>
          )}
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-semibold">What goes on the calendar</h3>
          <ul className="mt-3 space-y-2.5">
            {(Object.keys(kindInfo) as EventKind[]).map((k) => (
              <li key={k} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: kindInfo[k].color }} />
                <span>
                  <span className="font-medium">{kindInfo[k].label}</span>
                  <span className="block text-xs text-muted">{kindInfo[k].auto ?? "Add these yourself now"}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-faint">
            {signedIn ? (
              <>
                Synced to your account, so it&apos;s the same on your iPhone and computer.
                <span className="mt-2 block">
                  <CalendarFeed compact />
                </span>
              </>
            ) : (
              <>
                You&apos;re not signed in, so events are saved on this device only.{" "}
                <Link href="/settings" className="font-semibold text-accent">
                  Sign in
                </Link>{" "}
                to sync them and see your bills here.
              </>
            )}
          </p>
        </section>
      </aside>
    </div>
  );
}

function AddEventForm({
  date,
  onSave,
  onCancel,
}: {
  date: string;
  onSave: (e: { title: string; date: string; time?: string; kind: EventKind }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [d, setD] = useState(date);
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<EventKind>("personal");

  const field = "mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-base outline-none focus:border-accent"; // text-base stops iPhone zooming in

  return (
    <form
      className="mt-4 space-y-3 border-t border-line pt-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!title.trim()) return;
        onSave({ title: title.trim(), date: d, time: time || undefined, kind });
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">New event</p>
        <button type="button" onClick={onCancel} className="grid size-9 place-items-center rounded-full text-faint hover:text-ink" aria-label="Cancel">
          <X size={16} />
        </button>
      </div>
      <label className="block text-xs font-medium text-muted">
        Title
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dentist" autoFocus required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted">
          Date
          <input type="date" className={field} value={d} onChange={(e) => setD(e.target.value)} required />
        </label>
        <label className="block text-xs font-medium text-muted">
          Time (optional)
          <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        {manualKinds.map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`chip min-h-9 px-3! ${kind === k ? "text-ink! ring-1 ring-current" : ""}`}
          >
            <span className="size-2 rounded-full" style={{ background: kindInfo[k].color }} />
            {kindInfo[k].label}
          </button>
        ))}
      </div>
      <button type="submit" className="btn btn-primary w-full">
        Save event
      </button>
    </form>
  );
}
