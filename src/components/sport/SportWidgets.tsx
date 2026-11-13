"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { type Match, type TeamData, countdown, kickoffLabel, outcome } from "@/lib/football";

export function Crest({ src, alt, size = 28 }: { src: string | null; alt: string; size?: number }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok)
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-faint" style={{ width: size, height: size }}>
        <Trophy size={size / 2} />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} loading="lazy" onError={() => setOk(false)} />;
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Big "next match" block with a live countdown. */
export function NextMatch({ data, compact = false }: { data: TeamData; compact?: boolean }) {
  const now = useNow();
  const m = data.next[0];
  if (!m) return <p className="text-sm text-muted">No upcoming fixture listed for {data.team.name ?? "this team"}.</p>;
  const cd = countdown(m.kickoff, now);
  return (
    <Link href={`/sport/match/${m.id}`} className={`block rounded-2xl transition-colors hover:bg-surface-2 ${compact ? "-m-1 p-1" : "bg-surface-2/70 p-4"}`}>
      <div className="flex items-center justify-between gap-2 text-[0.68rem] font-semibold uppercase tracking-wider text-faint">
        <span className="truncate">{m.league}</span>
        {cd && <span className={`shrink-0 rounded-full px-2 py-0.5 ${cd === "Playing now" ? "bg-red-500/15 text-red-400" : "bg-accent-soft text-accent"}`}>{cd === "Playing now" ? "● LIVE" : `in ${cd}`}</span>}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <Crest src={m.homeBadge} alt={m.home} size={compact ? 32 : 44} />
          <span className="w-full truncate text-sm font-semibold">{m.home}</span>
        </div>
        <span className="font-display text-sm font-semibold text-faint">vs</span>
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <Crest src={m.awayBadge} alt={m.away} size={compact ? 32 : 44} />
          <span className="w-full truncate text-sm font-semibold">{m.away}</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">{kickoffLabel(m)}</p>
      {!compact && m.venue && (
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-faint">
          <MapPin size={11} /> {m.venue}
        </p>
      )}
      <p className="mt-2 flex items-center justify-center gap-0.5 text-[0.7rem] font-semibold text-accent">
        Match details & lineups <ChevronRight size={12} />
      </p>
    </Link>
  );
}

export function FormChips({ data }: { data: TeamData }) {
  const name = data.team.name ?? "";
  return (
    <div className="flex gap-1">
      {data.last.slice(0, 5).map((m) => {
        const r = outcome(m, name);
        const bg = r === "W" ? "#22c55e" : r === "L" ? "#ef4444" : "#a1a1aa";
        return (
          <span key={m.id} title={`${m.home} ${m.homeScore}–${m.awayScore} ${m.away}`} className="grid size-6 place-items-center rounded-md text-[0.65rem] font-bold text-white" style={{ background: bg }}>
            {r ?? "–"}
          </span>
        );
      })}
    </div>
  );
}

export function MatchRow({ m, team }: { m: Match; team: string }) {
  const r = outcome(m, team);
  const played = m.homeScore != null;
  return (
    <li>
      <Link href={`/sport/match/${m.id}`} className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2 sm:gap-3">
      <span className="w-11 shrink-0 text-xs text-muted sm:w-20">{m.kickoff ? new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : m.date}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-sm">
        <span className={`truncate ${m.home === team ? "font-semibold" : ""}`}>{m.home}</span>
        <Crest src={m.homeBadge} alt="" size={20} />
      </span>
      <span
        className="w-12 shrink-0 rounded-md py-0.5 text-center font-display text-sm font-semibold tabular-nums sm:w-14"
        style={played ? { background: r === "W" ? "rgb(34 197 94 / .15)" : r === "L" ? "rgb(239 68 68 / .15)" : "var(--surface-2)" } : undefined}
      >
        {played ? `${m.homeScore}–${m.awayScore}` : m.kickoff ? new Date(m.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "TBC"}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Crest src={m.awayBadge} alt="" size={20} />
        <span className={`truncate ${m.away === team ? "font-semibold" : ""}`}>{m.away}</span>
      </span>
      </Link>
    </li>
  );
}

/** Big scoreboard card (lime for the headline match, dark for the rest) */
export function ScoreCard({ m, highlight = false, label }: { m: Match; highlight?: boolean; label?: string }) {
  const now = useNow();
  const played = m.homeScore != null;
  const cd = countdown(m.kickoff, now);
  const live = cd === "Playing now";
  const status = live ? "Live" : played ? "Full time" : "Upcoming";
  const short = (n: string) => n.replace(/^(AFC|FC) /, "").replace(/ (FC|AFC)$/, "");
  const crest = (src: string | null, name: string) => (
    <span className={`grid size-[4.5rem] place-items-center rounded-full ${highlight ? "bg-white" : "bg-white/[0.08]"} shadow-lg`}>
      <Crest src={src} alt={name} size={46} />
    </span>
  );
  return (
    <Link
      href={`/sport/match/${m.id}`}
      className={`relative block overflow-hidden rounded-[1.9rem] p-5 transition-transform duration-300 active:scale-[0.98] ${highlight ? "text-[#0b0d07]" : "bg-[#1b1e18] text-white"}`}
      style={highlight ? { background: "linear-gradient(160deg, #d4ff3a, #b6f000)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-lg font-bold">{label ?? m.league ?? "Football"}</p>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${highlight ? "bg-[#0b0d07] text-white" : "bg-white/10 text-white/80"} ${live ? "animate-pulse" : ""}`}>
          {live ? "● Live" : status}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-2 text-center">
          {crest(m.homeBadge, m.home)}
          <span className="w-full truncate text-sm font-bold uppercase tracking-wide">{short(m.home)}</span>
        </div>
        <div className="text-center">
          {played ? (
            <p className="font-display text-4xl font-bold tabular-nums tracking-tight">
              {m.homeScore} : {m.awayScore}
            </p>
          ) : (
            <p className="font-display text-2xl font-bold tabular-nums">
              {m.kickoff ? new Date(m.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "TBC"}
            </p>
          )}
          <p className={`mt-1 text-xs font-semibold uppercase ${highlight ? "text-black/60" : "text-white/50"}`}>
            {played ? (m.kickoff ? new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "FT") : cd && !live ? `in ${cd}` : m.kickoff ? new Date(m.kickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : ""}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          {crest(m.awayBadge, m.away)}
          <span className="w-full truncate text-sm font-bold uppercase tracking-wide">{short(m.away)}</span>
        </div>
      </div>
      <p className={`mt-4 flex items-center justify-center gap-1 text-xs font-semibold ${highlight ? "text-black/70" : "text-[#c5f82a]"}`}>
        Lineups & match details <ChevronRight size={13} />
      </p>
    </Link>
  );
}
