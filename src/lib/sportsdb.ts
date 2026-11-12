"use client";

import { useEffect, useState } from "react";

export type SdbKind = "event" | "lineup" | "timeline" | "stats" | "league-next" | "league-past" | "table";
export type Row = Record<string, string | null>;

/** Fetch from our /api/sportsdb proxy. */
export function useSportsDb(kind: SdbKind, id: string | null) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/sportsdb?kind=${kind}&id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setItems(d.items ?? []);
        setError(d.error ?? null);
      })
      .catch(() => alive && setError("Couldn't load"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [kind, id]);
  return { items, loading, error };
}

/** TheSportsDB timestamps are UTC without a zone marker. */
export function sdbTime(r: Row): Date | null {
  const ts = r.strTimestamp;
  if (ts) {
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (r.dateEvent) return new Date(`${r.dateEvent}T${r.strTime && r.strTime !== "00:00:00" ? r.strTime : "12:00:00"}Z`);
  return null;
}

export function ukDateTime(d: Date | null, withTime = true) {
  if (!d) return "TBC";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/London",
  });
}

export const LEAGUES = {
  premierLeague: "4328",
  f1: "4370",
  darts: "4554",
} as const;
