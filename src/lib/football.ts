"use client";

import { useEffect, useState } from "react";
import { readCache, writeCache } from "./cache";

export type Match = {
  id: string;
  league: string | null;
  home: string;
  away: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoff: string | null;
  date: string | null;
  venue: string | null;
  status: string | null;
};

export type TeamData = {
  team: { id: string; name: string | null; badge: string | null; colour: string | null; league: string | null };
  next: Match[];
  last: Match[];
  error?: string;
};

export type FavTeam = { id: string; name: string };

/** Jack's favourites. (TheSportsDB team ids) */
export const DEFAULT_TEAMS: FavTeam[] = [
  { id: "133601", name: "Aston Villa" },
  { id: "133914", name: "England" },
];

const cache = new Map<string, Promise<TeamData>>();

export function loadTeam(id: string): Promise<TeamData> {
  if (!cache.has(id)) {
    cache.set(
      id,
      fetch(`/api/football?team=${id}`)
        .then((r) => r.json())
        .catch(() => ({ team: { id, name: null, badge: null, colour: null, league: null }, next: [], last: [], error: "Couldn't load fixtures" })),
    );
  }
  return cache.get(id)!;
}

export function useTeams(teams: FavTeam[] = DEFAULT_TEAMS) {
  const [data, setData] = useState<Record<string, TeamData>>({});
  const [loading, setLoading] = useState(true);
  const key = teams.map((t) => t.id).join(",");
  useEffect(() => {
    let alive = true;
    const cached = readCache<Record<string, TeamData>>(`teams:${key}`, 6 * 3600e3);
    if (cached) {
      setData(cached);
      setLoading(false);
    }
    Promise.all(teams.map((t) => loadTeam(t.id).then((d) => [t.id, d] as const))).then((pairs) => {
      if (!alive) return;
      const fresh = Object.fromEntries(pairs);
      setData(fresh);
      setLoading(false);
      if (pairs.every(([, d]) => !d.error)) writeCache(`teams:${key}`, fresh);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading };
}

/** Result from the point of view of `teamName`. */
export function outcome(m: Match, teamName: string): "W" | "D" | "L" | null {
  if (m.homeScore == null || m.awayScore == null) return null;
  const isHome = m.home === teamName;
  const us = isHome ? m.homeScore : m.awayScore;
  const them = isHome ? m.awayScore : m.homeScore;
  return us > them ? "W" : us < them ? "L" : "D";
}

export function kickoffLabel(m: Match) {
  if (!m.kickoff) return m.date ?? "TBC";
  const d = new Date(m.kickoff);
  return d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function countdown(iso: string | null, now = Date.now()) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return ms > -2 * 3600_000 ? "Playing now" : null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
