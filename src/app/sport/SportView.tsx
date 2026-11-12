"use client";

import { HeadlineRotator, LiveBadge } from "@/components/news/NewsWidgets";
import { Crest, FormChips, MatchRow, NextMatch } from "@/components/sport/SportWidgets";
import { Spinner } from "@/components/ui";
import { DEFAULT_TEAMS, useTeams } from "@/lib/football";

export function SportView() {
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
