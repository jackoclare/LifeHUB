import { NextResponse } from "next/server";

/**
 * Fixtures and results for a team from TheSportsDB (v1 API).
 * Uses THESPORTSDB_KEY if set (premium), otherwise the free public key "123"
 * (fine for a personal dashboard; limited results, 30 requests/min).
 * Cached for an hour.
 */
export const revalidate = 3600;

type Raw = Record<string, string | null>;

export type Match = {
  id: string;
  league: string | null;
  home: string;
  away: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoff: string | null; // ISO UTC
  date: string | null; // YYYY-MM-DD
  venue: string | null;
  status: string | null;
};

const toMatch = (e: Raw): Match => {
  const ts = e.strTimestamp ? (e.strTimestamp.endsWith("Z") || e.strTimestamp.includes("+") ? e.strTimestamp : `${e.strTimestamp}Z`) : null;
  const num = (v: string | null) => (v == null || v === "" ? null : Number(v));
  return {
    id: String(e.idEvent),
    league: e.strLeague ?? null,
    home: e.strHomeTeam ?? "",
    away: e.strAwayTeam ?? "",
    homeBadge: e.strHomeTeamBadge ?? null,
    awayBadge: e.strAwayTeamBadge ?? null,
    homeScore: num(e.intHomeScore),
    awayScore: num(e.intAwayScore),
    kickoff: ts && !Number.isNaN(new Date(ts).getTime()) ? new Date(ts).toISOString() : null,
    date: e.dateEvent ?? null,
    venue: e.strVenue ?? null,
    status: e.strStatus ?? null,
  };
};

export async function GET(req: Request) {
  const team = new URL(req.url).searchParams.get("team") ?? "";
  if (!/^\d{3,8}$/.test(team)) return NextResponse.json({ error: "Bad team id" }, { status: 400 });
  const key = process.env.THESPORTSDB_KEY || "123";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;
  try {
    const [nextRes, lastRes, teamRes] = await Promise.all([
      fetch(`${base}/eventsnext.php?id=${team}`, { next: { revalidate: 3600 } }),
      fetch(`${base}/eventslast.php?id=${team}`, { next: { revalidate: 3600 } }),
      fetch(`${base}/lookupteam.php?id=${team}`, { next: { revalidate: 86400 } }),
    ]);
    const [n, l, t] = await Promise.all([nextRes.json(), lastRes.json(), teamRes.json()]);
    const info = (t?.teams?.[0] ?? {}) as Raw;
    return NextResponse.json(
      {
        source: "TheSportsDB",
        team: { id: team, name: info.strTeam ?? null, badge: info.strBadge ?? info.strTeamBadge ?? null, colour: info.strColour1 ?? null, league: info.strLeague ?? null },
        next: ((n?.events ?? []) as Raw[]).map(toMatch),
        last: ((l?.results ?? []) as Raw[]).map(toMatch),
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } },
    );
  } catch (e) {
    return NextResponse.json({ error: `Couldn't load fixtures (${(e as Error).message})`, next: [], last: [] }, { status: 502 });
  }
}
