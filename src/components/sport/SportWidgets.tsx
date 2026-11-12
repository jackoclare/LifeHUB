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
      <Link href={`/sport/match/${m.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2">
      <span className="w-20 shrink-0 text-xs text-muted">{m.kickoff ? new Date(m.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : m.date}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-sm">
        <span className={`truncate ${m.home === team ? "font-semibold" : ""}`}>{m.home}</span>
        <Crest src={m.homeBadge} alt="" size={20} />
      </span>
      <span
        className="w-14 shrink-0 rounded-md py-0.5 text-center font-display text-sm font-semibold tabular-nums"
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
