"use client";

import Link from "next/link";
import { useState } from "react";
import { celebrate } from "@/lib/celebrate";
import { margin, useGoalWatcher, type LiveState } from "@/lib/live";
import type { LiveEvent } from "@/app/api/live/route";

/** Matchday mode: the Home hero turns into a live scoreboard while a favourite team is playing. */

const short = (n: string) => (/aston villa/i.test(n) ? "Aston Villa" : n);

function Crest({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={52} height={52} className="size-13 object-contain drop-shadow-[0_0_14px_rgb(255_255_255/0.18)]" />;
  }
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return <span className="grid size-13 place-items-center rounded-full bg-white/5 text-sm font-extrabold tracking-wider ring-1 ring-white/15">{initials}</span>;
}

function Scorers({ events, side }: { events: LiveEvent[]; side: "home" | "away" }) {
  // Group by player: "Watkins 12', 81' (P)"
  const mine = events.filter((e) => e.side === side);
  if (!mine.length) return null;
  const byPlayer = new Map<string, string[]>();
  for (const e of mine) {
    const m = `${e.minute}${e.extra ? `+${e.extra}` : ""}'${e.kind === "pen" ? " (P)" : e.kind === "own" ? " (OG)" : ""}`;
    const k = e.kind === "red" ? `🟥 ${e.player}` : `⚽ ${e.player}`;
    byPlayer.set(k, [...(byPlayer.get(k) ?? []), m]);
  }
  return (
    <ul className={`mt-2 space-y-0.5 text-[0.72rem] leading-tight text-muted ${side === "home" ? "text-left" : "text-right"}`}>
      {[...byPlayer].map(([p, mins]) => (
        <li key={p} className="truncate">
          {p} {mins.join(", ")}
        </li>
      ))}
    </ul>
  );
}

export function Scoreboard({ live }: { live: LiveState }) {
  const [flash, setFlash] = useState(0);
  useGoalWatcher(live, (ours) => {
    setFlash((f) => f + 1);
    if (ours) celebrate(document.querySelector(".scoreboard-score"), 60);
    else navigator.vibrate?.([40, 60, 40]);
  });

  const { data, match, phase, score, minuteLabel } = live;
  const home = data?.home?.name ?? match.home;
  const away = data?.away?.name ?? match.away;
  const events = data?.events ?? [];
  const m = phase === "soon" ? 0 : margin(live);
  const tone = m > 0 ? "win" : m < 0 ? "lose" : "level";
  const href = live.demo ? "/sport" : `/sport/match/${match.id}`;

  return (
    <Link href={href} className={`scoreboard scoreboard-${tone} relative mt-5 block rounded-[1.5rem] p-4 ${flash ? "scoreboard-flash" : ""}`} key={flash}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#00e5ff]">
          {live.demo ? "Demo · " : ""}
          {data?.league ?? match.league ?? "Matchday"}
        </span>
        <span className={`scoreboard-clock ${phase === "live" ? "is-live" : ""}`}>
          {phase === "live" && <span className="live-dot" aria-hidden />}
          {phase === "soon" ? `Kick-off ${minuteLabel}` : phase === "live" ? `LIVE ${minuteLabel}` : minuteLabel === "HT" ? "Half time" : "Full time"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="flex min-w-0 flex-col items-start">
          <Crest src={data?.home?.logo || match.homeBadge} name={home} />
          <p className={`mt-1.5 w-full truncate text-sm font-bold ${live.ours === "home" ? "text-white" : "text-muted"}`}>{short(home)}</p>
          <Scorers events={events} side="home" />
        </div>
        <p className="scoreboard-score font-display tabular-nums" aria-label={`${home} ${score[0]}, ${away} ${score[1]}`}>
          {phase === "soon" ? (
            <span className="text-muted">v</span>
          ) : (
            <>
              <span key={`h${score[0]}`} className="num-in">
                {score[0]}
              </span>
              <span className="mx-1.5 text-white/30">–</span>
              <span key={`a${score[1]}`} className="num-in">
                {score[1]}
              </span>
            </>
          )}
        </p>
        <div className="flex min-w-0 flex-col items-end">
          <Crest src={data?.away?.logo || match.awayBadge} name={away} />
          <p className={`mt-1.5 w-full truncate text-right text-sm font-bold ${live.ours === "away" ? "text-white" : "text-muted"}`}>{short(away)}</p>
          <Scorers events={events} side="away" />
        </div>
      </div>
      {data?.error && <p className="mt-2 text-[0.7rem] text-faint">Live score paused — {data.error}</p>}
    </Link>
  );
}
