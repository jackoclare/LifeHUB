import { NextResponse } from "next/server";

/**
 * Full lineups from API-Football (api-sports.io) when API_FOOTBALL_KEY is set.
 * Free plan = 100 requests/day, so everything is cached:
 *   1 request per match day (all fixtures that day) + 1 per match for lineups.
 * Query: ?date=YYYY-MM-DD&home=Aston%20Villa&away=Sunderland
 */
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
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return NextResponse.json({ configured: false, lineups: [] });
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date") ?? "";
  const home = sp.get("home") ?? "";
  const away = sp.get("away") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !home || !away) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  try {
    const day = await api<ApiFixture[]>(`/fixtures?date=${date}&timezone=Europe/London`, key, 3600);
    const errs = day.errors && (Array.isArray(day.errors) ? day.errors.length : Object.keys(day.errors as object).length);
    if (errs) return NextResponse.json({ configured: true, lineups: [], error: `API-Football: ${JSON.stringify(day.errors)}` });
    const fx = (day.response ?? []).find((f) => same(f.teams.home.name, home) && same(f.teams.away.name, away));
    if (!fx) return NextResponse.json({ configured: true, lineups: [], note: "Match not found in API-Football for that date" });

    // Lineups appear ~1h before kick-off; cache short before that, longer after
    const started = !["NS", "TBD", "PST"].includes(fx.fixture.status.short);
    const lu = await api<ApiLineup[]>(`/fixtures/lineups?fixture=${fx.fixture.id}`, key, started ? 86400 : 600);
    const lineups = (lu.response ?? []).map((l) => ({
      team: l.team.name,
      logo: l.team.logo,
      formation: l.formation,
      coach: l.coach?.name ?? null,
      startXI: l.startXI.map((p) => ({ name: p.player.name, number: p.player.number, pos: p.player.pos })),
      subs: l.substitutes.map((p) => ({ name: p.player.name, number: p.player.number, pos: p.player.pos })),
    }));
    return NextResponse.json({ configured: true, fixtureId: fx.fixture.id, status: fx.fixture.status.short, lineups });
  } catch (e) {
    return NextResponse.json({ configured: true, lineups: [], error: (e as Error).message });
  }
}
