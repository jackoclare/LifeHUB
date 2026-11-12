"use client";

import { HeadlineRotator, LiveBadge } from "@/components/news/NewsWidgets";
import { Crest, FormChips, MatchRow, NextMatch } from "@/components/sport/SportWidgets";
import { Spinner } from "@/components/ui";
import { DEFAULT_TEAMS, countdown, useTeams } from "@/lib/football";
import { LEAGUES, type Row, sdbTime, ukDateTime, useSportsDb } from "@/lib/sportsdb";
import { Segmented } from "@/components/ui";
import { useEffect, useState } from "react";

type Tab = "football" | "f1" | "darts";

export function SportView() {
  const [tab, setTab] = useState<Tab>("football");
  return (
    <div className="space-y-5">
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "football", label: "⚽ Football" },
          { value: "f1", label: "🏎️ F1" },
          { value: "darts", label: "🎯 Darts" },
        ]}
      />
      {tab === "football" ? <FootballTab /> : tab === "f1" ? <EventsTab league={LEAGUES.f1} accent="#ef4444" title="Formula 1" /> : <EventsTab league={LEAGUES.darts} accent="#22c55e" title="PDC Darts" />}
    </div>
  );
}

function FootballTab() {
  const { data, loading } = useTeams(DEFAULT_TEAMS);
  if (loading) return <Spinner label="Loading fixtures" />;

  return (
    <div className="space-y-6">
      <div className="stagger grid gap-4 md:grid-cols-2">
        {DEFAULT_TEAMS.map((t, i) => {
          const d = data[t.id];
          if (!d) return null;
          const name = d.team.name ?? t.name;
          return (
            <section key={t.id} className="card overflow-hidden" style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-center gap-3 p-4" style={{ background: d.team.colour ? `linear-gradient(120deg, ${d.team.colour}55, transparent 70%)` : undefined }}>
                <Crest src={d.team.badge} alt={name} size={44} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold">{name}</h2>
                  <p className="text-xs text-muted">{d.team.league ?? ""}</p>
                </div>
                <FormChips data={d} />
              </div>
              <div className="space-y-4 p-4 pt-0">
                {d.error ? <p className="text-sm text-muted">{d.error}</p> : <NextMatch data={d} />}
                {d.next.length > 1 && (
                  <div>
                    <h3 className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Coming up</h3>
                    <ul className="divide-y divide-line">
                      {d.next.slice(1, 5).map((m) => (
                        <MatchRow key={m.id} m={m} team={name} />
                      ))}
                    </ul>
                  </div>
                )}
                {d.last.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Recent results</h3>
                    <ul className="divide-y divide-line">
                      {d.last.slice(0, 5).map((m) => (
                        <MatchRow key={m.id} m={m} team={name} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <LeagueTable />

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Aston Villa news</h2>
          <LiveBadge />
        </div>
        <HeadlineRotator feed="villa" accent="#7a003c" />
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Football headlines</h2>
          <LiveBadge />
        </div>
        <HeadlineRotator feed="football" accent="var(--c-sport)" />
      </section>

      <p className="text-xs text-faint">
        Fixtures and results from TheSportsDB (free tier, refreshed hourly) — kick-off times can change, so check before travelling. Full league tables and live
        minute-by-minute scores need a free football-data.org key, which you can add later.
      </p>
    </div>
  );
}

function LeagueTable() {
  const { items, loading } = useSportsDb("table", LEAGUES.premierLeague);
  if (loading || !items.length) return null;
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-sm font-semibold">Premier League — top {items.length}</h2>
        <span className="text-[0.68rem] text-faint">Updated {items[0].dateUpdated ? new Date(items[0].dateUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</span>
      </div>
      <table className="mt-2 w-full text-sm">
        <thead className="text-xs text-faint">
          <tr>
            <th className="w-10 py-2 pl-5 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">Team</th>
            <th className="py-2 text-right font-medium">P</th>
            <th className="py-2 text-right font-medium">GD</th>
            <th className="py-2 pr-5 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((r: Row) => (
            <tr key={r.idTeam ?? r.strTeam} className={r.strTeam === "Aston Villa" ? "bg-accent-soft" : ""}>
              <td className="py-2 pl-5 tabular-nums text-muted">{r.intRank}</td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <Crest src={r.strBadge} alt="" size={20} />
                  <span className="truncate font-medium">{r.strTeam}</span>
                </span>
              </td>
              <td className="py-2 text-right tabular-nums text-muted">{r.intPlayed}</td>
              <td className="py-2 text-right tabular-nums text-muted">{r.intGoalDifference}</td>
              <td className="py-2 pr-5 text-right font-semibold tabular-nums">{r.intPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-5 pb-4 pt-2 text-xs text-faint">The free data shows the top {items.length} only.</p>
    </section>
  );
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function EventsTab({ league, accent, title }: { league: string; accent: string; title: string }) {
  const next = useSportsDb("league-next", league);
  const past = useSportsDb("league-past", league);
  const now = useNow();
  if (next.loading && past.loading) return <Spinner label={`Loading ${title}`} />;
  const upcoming = next.items;
  const recent = [...past.items].sort((a, b) => (sdbTime(b)?.getTime() ?? 0) - (sdbTime(a)?.getTime() ?? 0));

  return (
    <div className="space-y-5">
      {upcoming.length === 0 ? (
        <p className="card p-6 text-sm text-muted">No upcoming {title} events listed.</p>
      ) : (
        upcoming.map((e) => {
          const t = sdbTime(e);
          const cd = countdown(t?.toISOString() ?? null, now);
          const img = e.strThumb ?? e.strPoster ?? e.strBanner;
          return (
            <section key={e.idEvent} className="card animate-rise overflow-hidden">
              {img && (
                <div className="relative aspect-[16/7] overflow-hidden bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="kenburns size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                      Next up{e.intRound ? ` · Round ${e.intRound}` : ""}
                    </p>
                    <h2 className="font-display text-xl font-semibold text-white">{e.strEvent}</h2>
                  </div>
                </div>
              )}
              <div className="space-y-3 p-4">
                {!img && <h2 className="font-display text-lg font-semibold">{e.strEvent}</h2>}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <span>{ukDateTime(t, Boolean(e.strTime && e.strTime !== "00:00:00"))} UK</span>
                  {(e.strVenue || e.strCity) && <span>{[e.strVenue, e.strCity ?? e.strCountry].filter(Boolean).join(", ")}</span>}
                  {cd && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}>
                      {cd === "Playing now" ? "● LIVE" : `in ${cd}`}
                    </span>
                  )}
                </div>
                {e.strResult && <ResultText text={e.strResult} label="Schedule" />}
              </div>
            </section>
          );
        })
      )}

      {recent.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-2 text-sm font-semibold">Recent</h2>
          <ul className="divide-y divide-line">
            {recent.map((e) => (
              <li key={e.idEvent} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{e.strEvent}</span>
                  <span className="shrink-0 text-xs text-faint">{ukDateTime(sdbTime(e), false)}</span>
                </div>
                {e.strResult && <ResultText text={e.strResult} label="Results" />}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-faint">{title} data from TheSportsDB (free tier: next event and the latest results). Times shown in UK time.</p>
    </div>
  );
}

function ResultText({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const shown = open ? lines : lines.slice(0, 4);
  return (
    <div className="mt-2 rounded-xl bg-surface-2/70 p-3">
      <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-faint">{label}</p>
      <ul className="space-y-0.5 text-sm">
        {shown.map((l, i) => (
          <li key={i} className="text-muted">
            {l}
          </li>
        ))}
      </ul>
      {lines.length > 4 && (
        <button onClick={() => setOpen((o) => !o)} className="mt-1 text-xs font-semibold text-accent">
          {open ? "Show less" : `Show all ${lines.length}`}
        </button>
      )}
    </div>
  );
}
