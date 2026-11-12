import { NextResponse } from "next/server";

/**
 * Full lineups from API-Football (api-sports.io) when API_FOOTBALL_KEY is set.
 * Free plan = 100 requests/day, so everything is cached:
 *   1 request per match day (all fixtures that day) + 1 per match for lineups.
 * Query: ?date=YYYY-MM-DD&home=Aston%20Villa&away=Sunderland
 */
export const dynamic = "force-dynamic";

const BASE = "https://v3.football.api-sports.io";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(fc|afc|cf|the|and|hove|albion|united|utd|city)\b/g, "")
    .replace(/[^a-z]/g, "");

const same = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)));
};

type ApiFixture = { fixture: { id: number; date: string; status: { short: string } }; teams: { home: { id: number; name: string }; away: { id: number; name: string } } };
type ApiLineup = {
  team: { id: number; name: string; logo: string };
  formation: string | null;
  coach: { name: string | null } | null;
  startXI: { player: { id: number; name: string; number: number | null; pos: string | null } }[];
  substitutes: { player: { id: number; name: string; number: number | null; pos: string | null } }[];
};

async function api<T>(path: string, key: string, ttl: number): Promise<{ response: T; errors?: unknown }> {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": key }, next: { revalidate: ttl }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const key = process.env["API_FOOTBALL_KEY"];
  if (!key) return NextResponse.json({ configured: false, lineups: [] }, { headers: { "Cache-Control": "no-store" } });
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date") ?? "";
  const home = sp.get("home") ?? "";
  const away = sp.get("away") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !home || !away) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  try {
    const day = await api<ApiFixture[]>(`/fixtures?date=${date}&timezone=Europe/London`, key, 900);
    const errs = day.errors && (Array.isArray(day.errors) ? day.errors.length : Object.keys(day.errors as object).length);
    if (errs) return NextResponse.json({ configured: true, lineups: [], error: `API-Football: ${JSON.stringify(day.errors)}` });
    // Pick the right game: youth/women's/reserve sides share names (England U21 v Croatia U21), so prefer exact
    // senior names and the kick-off time closest to ours.
    const youth = /\b(u-?\d{2}|under ?\d{2}|women|ladies|w|ii|b|reserves?|youth|academy)\b/i;
    const ko = sp.get("ko") ? new Date(sp.get("ko")!).getTime() : null;
    const cands = (day.response ?? []).filter((f) => same(f.teams.home.name, home) && same(f.teams.away.name, away));
    const score = (f: ApiFixture) =>
      (norm(f.teams.home.name) === norm(home) ? 0 : 5) +
      (norm(f.teams.away.name) === norm(away) ? 0 : 5) +
      (youth.test(f.teams.home.name) && !youth.test(home) ? 50 : 0) +
      (youth.test(f.teams.away.name) && !youth.test(away) ? 50 : 0) +
      (ko ? Math.abs(new Date(f.fixture.date).getTime() - ko) / 3600e3 : 0);
    const fx = cands.sort((a, b) => score(a) - score(b))[0];
    if (!fx) return NextResponse.json({ configured: true, lineups: [], note: "Match not found in API-Football for that date" });

    // Lineups appear ~1h before kick-off; cache short before that, longer after
    const started = !["NS", "TBD", "PST"].includes(fx.fixture.status.short);
    // From 75 min before kick-off, re-check every 3 minutes until lineups appear; once the game is under way they don't change
    const nearKickoff = Date.now() > new Date(fx.fixture.date).getTime() - 75 * 60e3;
    const lu = await api<ApiLineup[]>(`/fixtures/lineups?fixture=${fx.fixture.id}`, key, started ? 86400 : nearKickoff ? 180 : 1800);
    const lineups = (lu.response ?? []).map((l) => ({
      team: l.team.name,
      logo: l.team.logo,
      formation: l.formation,
      coach: l.coach?.name ?? null,
      startXI: l.startXI.map((p) => ({ name: p.player.name, number: p.player.number, pos: p.player.pos })),
      subs: l.substitutes.map((p) => ({ name: p.player.name, number: p.player.number, pos: p.player.pos })),
    }));
    return NextResponse.json({
      configured: true,
      fixtureId: fx.fixture.id,
      status: fx.fixture.status.short,
      matched: `${fx.teams.home.name} v ${fx.teams.away.name}`,
      others: cands.filter((c) => c !== fx).map((c) => `${c.teams.home.name} v ${c.teams.away.name} (${c.fixture.status.short})`),
      lineups,
    });
  } catch (e) {
    return NextResponse.json({ configured: true, lineups: [], error: (e as Error).message });
  }
}
