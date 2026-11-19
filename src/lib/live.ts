"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTeams, type FavTeam, type Match } from "@/lib/football";
import type { LiveEvent, LiveMatch } from "@/app/api/live/route";

/**
 * Matchday mode: finds a favourite team's match that's about to start / under way / just finished,
 * and polls the live score every 60s while it's on. Add ?matchday=demo to any page to watch a
 * pretend game play out at high speed (handy for trying it before a real match).
 */

export type LiveState = {
  match: Match; // TheSportsDB fixture (for the match page link)
  data: LiveMatch | null;
  phase: "soon" | "live" | "ht" | "ft";
  ours: "home" | "away"; // which side is the favourite team
  score: [number, number]; // [home, away]
  minuteLabel: string; // "63'", "HT", "FT", "15:00"
  demo?: boolean;
};

const LIVE = new Set(["1H", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);
const DONE = new Set(["FT", "AET", "PEN"]);
const ukDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

function isDemo() {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("matchday");
    if (q === "demo") sessionStorage.setItem("mlh.matchday", String(Date.now()));
    if (q === "off") sessionStorage.removeItem("mlh.matchday");
    return Boolean(sessionStorage.getItem("mlh.matchday"));
  } catch {
    return false;
  }
}

/** A pretend Villa game: every 4 seconds of real time = 3 match minutes. */
function demoState(): LiveState {
  let started = Date.now();
  try {
    started = Number(sessionStorage.getItem("mlh.matchday")) || started;
  } catch {}
  const mins = Math.floor(((Date.now() - started) / 4000) * 3) + 1;
  const script: LiveEvent[] = [
    { minute: 12, extra: null, side: "home", player: "O. Watkins", kind: "goal" },
    { minute: 34, extra: null, side: "away", player: "W. Isidor", kind: "goal" },
    { minute: 58, extra: null, side: "home", player: "M. Rogers", kind: "goal" },
    { minute: 81, extra: null, side: "home", player: "O. Watkins", kind: "pen" },
  ];
  const clock = mins <= 45 ? mins : mins <= 60 ? 45 : Math.min(90, mins - 15);
  const phase: LiveState["phase"] = mins > 45 && mins <= 60 ? "ht" : mins > 105 ? "ft" : "live";
  const events = script.filter((e) => e.minute <= clock);
  const score: [number, number] = [events.filter((e) => e.side === "home" && e.kind !== "red").length, events.filter((e) => e.side === "away" && e.kind !== "red").length];
  return {
    demo: true,
    match: { id: "demo", league: "Premier League", home: "Aston Villa", away: "Sunderland", homeBadge: null, awayBadge: null, homeScore: score[0], awayScore: score[1], kickoff: new Date(started).toISOString(), date: ukDate(new Date()), venue: "Villa Park", status: null },
    data: { configured: true, status: phase === "ft" ? "FT" : phase === "ht" ? "HT" : mins > 60 ? "2H" : "1H", elapsed: clock, league: "Premier League", home: { name: "Aston Villa", logo: "", goals: score[0] }, away: { name: "Sunderland", logo: "", goals: score[1] }, events },
    phase,
    ours: "home",
    score,
    minuteLabel: phase === "ft" ? "FT" : phase === "ht" ? "HT" : `${clock}'`,
  };
}

/** The favourite team's match in the matchday window: 20 min before kick-off → 2h45 after (or 30 min after full time). */
function pickMatch(teams: Record<string, { team: { name: string | null }; next: Match[]; last: Match[] }>, fav: FavTeam[], now: number) {
  for (const t of fav) {
    const d = teams[t.id];
    if (!d) continue;
    for (const m of [...d.next, ...d.last]) {
      const ko = m.kickoff ? Date.parse(m.kickoff) : NaN;
      if (Number.isNaN(ko)) continue;
      if (now > ko - 20 * 60e3 && now < ko + 165 * 60e3) {
        const name = d.team.name ?? t.name;
        return { m, ours: (m.away === name || m.away === t.name ? "away" : "home") as "home" | "away" };
      }
    }
  }
  return null;
}

export function useLiveMatch(fav: FavTeam[]): LiveState | null {
  const { data: teams } = useTeams(fav);
  const [now, setNow] = useState(() => Date.now());
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState<LiveMatch | null>(null);

  useEffect(() => {
    setDemo(isDemo());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // In demo mode, tick quickly so the pretend game moves
  useEffect(() => {
    if (!demo) return;
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, [demo]);

  const picked = useMemo(() => (demo ? null : pickMatch(teams, fav, now)), [teams, fav, now, demo]);
  const matchKey = picked ? `${picked.m.id}` : "";

  useEffect(() => {
    if (!picked) {
      setData(null);
      return;
    }
    let alive = true;
    const m = picked.m;
    const ko = new Date(m.kickoff!);
    const url = `/api/live?date=${ukDate(ko)}&home=${encodeURIComponent(m.home)}&away=${encodeURIComponent(m.away)}&ko=${encodeURIComponent(m.kickoff!)}`;
    const load = () =>
      fetch(url)
        .then((r) => r.json())
        .then((j: LiveMatch) => alive && setData(j))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  return useMemo(() => {
    if (demo) return demoState();
    if (!picked) return null;
    const m = picked.m;
    const status = data?.status ?? "NS";
    const ko = new Date(m.kickoff!);
    const done = DONE.has(status);
    // Hide 30 min after full time
    if (done && now > ko.getTime() + 150 * 60e3) return null;
    const phase: LiveState["phase"] = done ? "ft" : status === "HT" ? "ht" : LIVE.has(status) ? "live" : "soon";
    const score: [number, number] = [data?.home?.goals ?? m.homeScore ?? 0, data?.away?.goals ?? m.awayScore ?? 0];
    const minuteLabel =
      phase === "ft" ? "FT" : phase === "ht" ? "HT" : phase === "live" ? `${data?.elapsed ?? ""}${data?.extra ? `+${data.extra}` : ""}'` : hhmm(ko);
    return { match: m, data, phase, ours: picked.ours, score, minuteLabel };
  }, [demo, picked, data, now]);
}

/** +1 if the favourite team is winning, -1 losing, 0 level */
export function margin(s: LiveState) {
  const [h, a] = s.score;
  return Math.sign(s.ours === "home" ? h - a : a - h);
}

/** Fires `onGoal(ours)` whenever the score goes up after the first load. */
export function useGoalWatcher(s: LiveState | null, onGoal: (ours: boolean) => void) {
  const prev = useRef<[number, number] | null>(null);
  const key = s ? `${s.match.id}` : "";
  const cb = useRef(onGoal);
  cb.current = onGoal;
  useEffect(() => {
    prev.current = null;
  }, [key]);
  useEffect(() => {
    if (!s) return;
    const p = prev.current;
    prev.current = s.score;
    if (!p) return;
    if (s.score[0] > p[0]) cb.current(s.ours === "home");
    if (s.score[1] > p[1]) cb.current(s.ours === "away");
  }, [s]);
}
