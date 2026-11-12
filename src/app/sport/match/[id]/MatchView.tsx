"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, MapPin, Shirt, Tv, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Crest } from "@/components/sport/SportWidgets";
import { Spinner } from "@/components/ui";
import { countdown } from "@/lib/football";
import { type Row, sdbTime, ukDateTime, useSportsDb } from "@/lib/sportsdb";

const posOrder = (p: string | null) => {
  const s = (p ?? "").toLowerCase();
  if (s.includes("goal")) return 0;
  if (s.includes("back") || s.includes("defen")) return 1;
  if (s.includes("mid")) return 2;
  if (s.includes("wing") || s.includes("forward") || s.includes("striker") || s.includes("attack")) return 3;
  return 4;
};

type FullPlayer = { name: string; number: number | null; pos: string | null };
type FullLineups = {
  configured: boolean;
  error?: string;
  note?: string;
  lineups: { team: string; logo: string; formation: string | null; coach: string | null; startXI: FullPlayer[]; subs: FullPlayer[] }[];
};

const posName: Record<string, string> = { G: "GK", D: "DEF", M: "MID", F: "FWD" };

function FullLineupView({ data }: { data: FullLineups }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {data.lineups.map((t) => (
        <div key={t.team}>
          <div className="mb-3 flex items-center gap-2">
            <Crest src={t.logo} alt="" size={24} />
            <h3 className="flex-1 text-sm font-semibold">{t.team}</h3>
            {t.formation && <span className="chip">{t.formation}</span>}
          </div>
          <ul className="divide-y divide-line">
            {t.startXI.map((p) => (
              <li key={`${p.number}-${p.name}`} className="flex items-center gap-3 py-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--c-sport)] text-xs font-bold text-white tabular-nums">{p.number ?? "–"}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <span className="shrink-0 text-xs text-faint">{p.pos ? (posName[p.pos] ?? p.pos) : ""}</span>
              </li>
            ))}
          </ul>
          {t.subs.length > 0 && (
            <>
              <p className="mb-1 mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Substitutes</p>
              <ul className="divide-y divide-line opacity-75">
                {t.subs.map((p) => (
                  <li key={`s-${p.number}-${p.name}`} className="flex items-center gap-3 py-1.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 text-[0.68rem] font-bold tabular-nums">{p.number ?? "–"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    <span className="shrink-0 text-xs text-faint">{p.pos ? (posName[p.pos] ?? p.pos) : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {t.coach && <p className="mt-3 text-xs text-muted">Manager: {t.coach}</p>}
        </div>
      ))}
      <p className="text-xs text-faint sm:col-span-2">Lineups from API-Football.</p>
    </div>
  );
}

export function MatchView({ id }: { id: string }) {
  const ev = useSportsDb("event", id);
  const lu = useSportsDb("lineup", id);
  const [full, setFull] = useState<FullLineups | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const e0 = ev.items[0] as Row | undefined;
  useEffect(() => {
    if (!e0?.dateEvent || !e0.strHomeTeam || !e0.strAwayTeam) return;
    const k = sdbTime(e0);
    const ukDate = k ? k.toLocaleDateString("en-CA", { timeZone: "Europe/London" }) : e0.dateEvent;
    fetch(`/api/match-lineups?date=${ukDate}&home=${encodeURIComponent(e0.strHomeTeam)}&away=${encodeURIComponent(e0.strAwayTeam)}${e0.strTimestamp ? `&ko=${encodeURIComponent(/[zZ]|[+-]\d\d:?\d\d$/.test(e0.strTimestamp) ? e0.strTimestamp : `${e0.strTimestamp}Z`)}` : ""}`)
      .then((r) => r.json())
      .then(setFull)
      .catch(() => setFull(null));
  }, [e0?.dateEvent, e0?.strHomeTeam, e0?.strAwayTeam, e0?.strTimestamp]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ev.loading) return <Spinner label="Loading match" />;
  const e = e0;
  if (!e) return <p className="card p-6 text-sm text-muted">Match not found.</p>;

  const kickoff = sdbTime(e);
  const played = e.intHomeScore != null && e.intHomeScore !== "";
  const cd = countdown(kickoff?.toISOString() ?? null, now);
  const homeId = e.idHomeTeam;
  const homeLineup = lu.items.filter((p) => (homeId ? p.idTeam === homeId : p.strHome === "Yes"));
  const awayLineup = lu.items.filter((p) => (homeId ? p.idTeam === e.idAwayTeam : p.strHome === "No"));

  return (
    <div className="space-y-5">
      <Link href="/sport" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={16} /> Sport
      </Link>

      {/* Scoreboard */}
      <section className="hero animate-rise p-5 sm:p-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-faint">
          {e.strLeague}
          {e.intRound ? ` · Round ${e.intRound}` : ""}
        </p>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center gap-2 text-center">
            <Crest src={e.strHomeTeamBadge} alt={e.strHomeTeam ?? ""} size={72} />
            <span className="font-display text-lg font-semibold leading-tight">{e.strHomeTeam}</span>
          </div>
          <div className="text-center">
            {played ? (
              <p className="font-display text-5xl font-bold tabular-nums">
                {e.intHomeScore}
                <span className="mx-2 text-faint">–</span>
                {e.intAwayScore}
              </p>
            ) : (
              <p className="font-display text-2xl font-semibold">{kickoff ? kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "TBC"}</p>
            )}
            {cd && !played && (
              <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${cd === "Playing now" ? "bg-red-500/15 text-red-400" : "bg-accent-soft text-accent"}`}>
                {cd === "Playing now" ? "● LIVE" : `Kick-off in ${cd}`}
              </span>
            )}
            {played && <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-faint">{e.strStatus === "FT" || !e.strStatus ? "Full time" : e.strStatus}</p>}
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <Crest src={e.strAwayTeamBadge} alt={e.strAwayTeam ?? ""} size={72} />
            <span className="font-display text-lg font-semibold leading-tight">{e.strAwayTeam}</span>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={15} /> {ukDateTime(kickoff, false)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={15} /> {kickoff ? kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "TBC"} UK time
          </span>
          {e.strVenue && (
            <span className="flex items-center gap-1.5">
              <MapPin size={15} /> {e.strVenue}
            </span>
          )}
          {e.strTVStation && (
            <span className="flex items-center gap-1.5">
              <Tv size={15} /> {e.strTVStation}
            </span>
          )}
        </div>
      </section>

      {/* Lineups */}
      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users size={18} className="text-[var(--c-sport)]" />
          <h2 className="font-semibold">Lineups</h2>
        </div>
        {full?.lineups?.length ? (
          <FullLineupView data={full} />
        ) : lu.loading ? (
          <Spinner label="Loading lineups" />
        ) : lu.items.length === 0 ? (
          <p className="text-sm text-muted">
            {played ? "No lineup data for this match." : "Lineups are announced about an hour before kick-off — check back then."}
          </p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                { name: e.strHomeTeam, badge: e.strHomeTeamBadge, players: homeLineup },
                { name: e.strAwayTeam, badge: e.strAwayTeamBadge, players: awayLineup },
              ].map((side) => (
                <div key={side.name ?? "x"}>
                  <div className="mb-2 flex items-center gap-2">
                    <Crest src={side.badge} alt="" size={22} />
                    <h3 className="text-sm font-semibold">{side.name}</h3>
                  </div>
                  {side.players.length === 0 ? (
                    <p className="text-sm text-muted">Not available.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {[...side.players]
                        .sort((a, b) => Number(a.strSubstitute === "Yes") - Number(b.strSubstitute === "Yes") || posOrder(a.strPosition) - posOrder(b.strPosition))
                        .map((p) => (
                          <li key={p.idLineup ?? p.strPlayer} className={`flex items-center gap-3 py-2 ${p.strSubstitute === "Yes" ? "opacity-60" : ""}`}>
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-bold tabular-nums">{p.intSquadNumber ?? <Shirt size={13} />}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.strPlayer}</span>
                            <span className="shrink-0 text-xs text-faint">{p.strSubstitute === "Yes" ? "Sub" : p.strPosition}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {lu.items.length < 20 && (
              <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
                Showing a partial lineup ({lu.items.length} players).{" "}
                {full?.configured === false
                  ? "Full XIs appear once the API-Football key is added in Vercel."
                  : full?.error
                    ? `Full lineups unavailable: ${full.error}`
                    : "Full XIs from API-Football appear about an hour before kick-off."}
              </p>
            )}
          </>
        )}
      </section>

      <p className="text-xs text-faint">Match data from TheSportsDB. Kick-off times can change — check before you travel.</p>
    </div>
  );
}
