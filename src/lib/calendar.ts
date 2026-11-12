"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Calendar events.
 *
 * Phase 1: events you add yourself are saved on this device only.
 * Phase 2: moves to Supabase (synced across iPhone + computer), and bills add
 *          their due dates automatically.
 * Phase 4: favourite-team fixtures (Aston Villa, England) are added automatically.
 */

export type EventKind = "personal" | "reminder" | "bill" | "football" | "travel";

export type CalendarEvent = {
  id: string;
  title: string;
  /** Local date, YYYY-MM-DD */
  date: string;
  /** Optional local time, HH:MM */
  time?: string;
  kind: EventKind;
  notes?: string;
};

export const kindInfo: Record<EventKind, { label: string; color: string; auto?: string }> = {
  personal: { label: "Personal", color: "var(--accent)" },
  reminder: { label: "Reminder", color: "var(--c-shop)" },
  bill: { label: "Bill", color: "var(--c-money)", auto: "Added automatically from Bills (Phase 2)" },
  football: { label: "Football", color: "var(--c-sport)", auto: "Aston Villa & England fixtures added automatically (Phase 4)" },
  travel: { label: "Travel", color: "var(--c-travel)", auto: "Saved trips added automatically (Phase 3)" },
};

/** Kinds you can add by hand right now. */
export const manualKinds: EventKind[] = ["personal", "reminder"];

const KEY = "mlh.calendar.v1";

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function read(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(events: CalendarEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    /* storage full or blocked */
  }
}

export function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEvents(read().sort(sortEvents));
    setLoaded(true);
  }, []);

  const save = useCallback((next: CalendarEvent[]) => {
    const sorted = [...next].sort(sortEvents);
    setEvents(sorted);
    write(sorted);
  }, []);

  const add = useCallback(
    (e: Omit<CalendarEvent, "id">) => save([...read(), { ...e, id: crypto.randomUUID() }]),
    [save],
  );
  const remove = useCallback((id: string) => save(read().filter((e) => e.id !== id)), [save]);

  return { events, loaded, add, remove };
}

export function upcoming(events: CalendarEvent[], days = 14) {
  const today = toISODate(new Date());
  const end = new Date();
  end.setDate(end.getDate() + days);
  const last = toISODate(end);
  return events.filter((e) => e.date >= today && e.date <= last).sort(sortEvents);
}

export function formatDay(iso: string) {
  const d = fromISODate(iso);
  const today = toISODate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === today) return "Today";
  if (iso === toISODate(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
