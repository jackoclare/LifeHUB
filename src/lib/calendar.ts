"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { addDays, formatDay, fromISODate, toISODate } from "./dates";
import { occurrences } from "./bills";
import type { Bill, DbCalendarEvent } from "./types";
import { DEFAULT_TEAMS, loadTeam } from "./football";

export { formatDay, fromISODate, toISODate };

/**
 * Calendar events.
 * - Signed out: events you add are saved on this device only.
 * - Signed in: events live in Supabase (synced), and bill due dates are added automatically.
 *   Any device-only events are moved into your account the first time you sign in.
 * - Phase 4: favourite-team fixtures (Aston Villa, England) will be added automatically.
 */

export type EventKind = "personal" | "reminder" | "bill" | "football" | "travel" | "holiday";

export type CalendarEvent = {
  id: string;
  title: string;
  /** Local date, YYYY-MM-DD */
  date: string;
  /** Optional local time, HH:MM */
  time?: string;
  kind: EventKind;
  notes?: string;
  /** Bill events are generated from the Bills section and edited there. */
  readOnly?: boolean;
  amount?: number;
};

export const kindInfo: Record<EventKind, { label: string; color: string; auto?: string }> = {
  personal: { label: "Personal", color: "var(--accent)" },
  reminder: { label: "Reminder", color: "var(--c-shop)" },
  bill: { label: "Bill", color: "var(--c-money)", auto: "Added automatically from Bills" },
  football: { label: "Football", color: "var(--c-sport)", auto: "Aston Villa & England fixtures added automatically" },
  travel: { label: "Travel", color: "var(--c-travel)", auto: "Saved trips added automatically (Phase 3)" },
  holiday: { label: "Bank holiday", color: "#14b8a6", auto: "UK bank holidays from GOV.UK" },
};

/** Kinds you can add by hand right now. */
export const manualKinds: EventKind[] = ["personal", "reminder"];

const KEY = "mlh.calendar.v1";

function readLocal(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(events: CalendarEvent[]) {
  try {
    if (events.length) localStorage.setItem(KEY, JSON.stringify(events));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage full or blocked */
  }
}

export function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");
}

const fromDb = (e: DbCalendarEvent): CalendarEvent => ({
  id: e.id,
  title: e.title,
  date: e.event_date,
  time: e.event_time ? e.event_time.slice(0, 5) : undefined,
  kind: e.kind,
  notes: e.notes ?? undefined,
});

export function useCalendarEvents() {
  const { user, loading: authLoading } = useAuth();
  const [own, setOwn] = useState<CalendarEvent[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [football, setFootball] = useState<CalendarEvent[]>([]);
  const [holidays, setHolidays] = useState<CalendarEvent[]>([]);

  // UK bank holidays (GOV.UK)
  useEffect(() => {
    let alive = true;
    fetch("/api/bank-holidays")
      .then((r) => r.json())
      .then((j: { holidays?: { title: string; date: string; notes: string | null }[] }) => {
        if (!alive) return;
        setHolidays((j.holidays ?? []).map((h) => ({ id: `bh-${h.date}`, title: `${h.title}${h.notes ? ` (${h.notes.toLowerCase()})` : ""}`, date: h.date, kind: "holiday" as const, readOnly: true })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Favourite teams' fixtures (Aston Villa, England) — shown to everyone, no sign-in needed
  useEffect(() => {
    let alive = true;
    Promise.all(DEFAULT_TEAMS.map((t) => loadTeam(t.id))).then((teams) => {
      if (!alive) return;
      const seen = new Set<string>();
      const evs: CalendarEvent[] = [];
      for (const d of teams)
        for (const m of d.next ?? []) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          const k = m.kickoff ? new Date(m.kickoff) : null;
          evs.push({
            id: `match-${m.id}`,
            title: `${m.home} v ${m.away}`,
            date: k ? toISODate(k) : (m.date ?? ""),
            time: k ? k.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : undefined,
            kind: "football",
            notes: m.league ?? undefined,
            readOnly: true,
          });
        }
      setFootball(evs.filter((e) => e.date));
    });
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setOwn(readLocal().sort(sortEvents));
      setBills([]);
      setLoaded(true);
      return;
    }
    const supabase = createClient();

    // One-time move of device-only events into the account
    const local = readLocal();
    if (local.length) {
      const { error } = await supabase.from("calendar_events").insert(
        local
          .filter((e) => e.kind === "personal" || e.kind === "reminder")
          .map((e) => ({ title: e.title, event_date: e.date, event_time: e.time ?? null, kind: e.kind, notes: e.notes ?? null })),
      );
      if (!error) writeLocal([]);
    }

    const [ev, bl] = await Promise.all([
      supabase.from("calendar_events").select("*").order("event_date"),
      supabase.from("bills").select("*").eq("is_active", true),
    ]);
    if (ev.error || bl.error) setError((ev.error ?? bl.error)!.message);
    else setError(null);
    setOwn(((ev.data ?? []) as DbCalendarEvent[]).map(fromDb));
    setBills((bl.data ?? []) as Bill[]);
    setLoaded(true);
  }, [user, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  /** Bills projected forward ~13 months, plus anything overdue on its due date. */
  const billEvents = useMemo<CalendarEvent[]>(() => {
    const today = toISODate(new Date());
    const from = addDays(today, -400);
    const to = addDays(today, 400);
    return bills.flatMap((b) =>
      occurrences(b, from, to).map((date) => ({
        id: `bill-${b.id}-${date}`,
        title: b.name,
        date,
        kind: "bill" as const,
        readOnly: true,
        amount: Number(b.amount),
      })),
    );
  }, [bills]);

  const events = useMemo(() => [...own, ...billEvents, ...football, ...holidays].sort(sortEvents), [own, billEvents, football, holidays]);

  const add = useCallback(
    async (e: Omit<CalendarEvent, "id">) => {
      if (!user) {
        const next = [...readLocal(), { ...e, id: crypto.randomUUID() }];
        writeLocal(next);
        setOwn(next.sort(sortEvents));
        return null;
      }
      const { error } = await createClient()
        .from("calendar_events")
        .insert({ title: e.title, event_date: e.date, event_time: e.time ?? null, kind: e.kind, notes: e.notes ?? null });
      if (error) return error.message;
      await load();
      return null;
    },
    [user, load],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user) {
        const next = readLocal().filter((e) => e.id !== id);
        writeLocal(next);
        setOwn(next);
        return null;
      }
      setOwn((prev) => prev.filter((e) => e.id !== id));
      const { error } = await createClient().from("calendar_events").delete().eq("id", id);
      if (error) {
        await load();
        return error.message;
      }
      return null;
    },
    [user, load],
  );

  return { events, loaded, error, add, remove, signedIn: Boolean(user) };
}

export function upcoming(events: CalendarEvent[], days = 14) {
  const today = toISODate(new Date());
  const last = addDays(today, days);
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  // Drop today's timed events once they're over (matches ~2 hours, everything else 1 hour after the start)
  const finished = (e: CalendarEvent) => {
    if (e.date !== today || !e.time) return false;
    const [h, m] = e.time.split(":").map(Number);
    return nowMins > h * 60 + m + (e.kind === "football" ? 120 : 60);
  };
  return events.filter((e) => e.date >= today && e.date <= last && !finished(e)).sort(sortEvents);
}
