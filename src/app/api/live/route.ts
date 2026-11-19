import { NextResponse } from "next/server";
import { apiErrors, apiFootball, dayFixtures, findFixture, type ApiFixture } from "@/lib/apiFootball";

/**
 * Live score for one match (matchday mode + goal alerts).
 * GET ?date=YYYY-MM-DD&home=Aston%20Villa&away=Sunderland&ko=<ISO kick-off>
 *
 * Budget (API-Football free plan, 100 requests/day): the day's fixture list is cached 3h, and the live
 * match is only fetched from 20 min before kick-off to 3h after, cached 90s and shared by every caller
 * (≈ 120 calls on a match day at most — usually far fewer, because nobody's asking outside the window).
 */
export const dynamic = "force-dynamic";

export type LiveEvent = { minute: number; extra: number | null; side: "home" | "away"; player: string; kind: "goal" | "pen" | "own" | "red" };
export type LiveMatch = {
  configured: boolean;
  fixtureId?: number;
  status?: string; // NS, 1H, HT, 2H, ET, BT, P, FT, AET, PEN, PST, CANC, SUSP, INT
  elapsed?: number | null;
  extra?: number | null;
  league?: string | null;
  home?: { name: string; logo: string; goals: number | null };
  away?: { name: string; logo: string; goals: number | null };
  events?: LiveEvent[];
  kickoff?: string;
  error?: string;
  note?: string;
};

const json = (b: LiveMatch, maxAge = 60) => NextResponse.json(b, { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=30` } });

export async function GET(req: Request) {
  const key = process.env["API_FOOTBALL_KEY"];
  if (!key) return json({ configured: false }, 3600);
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date") ?? "";
  const home = sp.get("home") ?? "";
  const away = sp.get("away") ?? "";
  const ko = sp.get("ko") ? new Date(sp.get("ko")!).getTime() : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !home || !away || home.length > 60 || away.length > 60) return json({ configured: true, error: "Bad request" }, 0);

  try {
    const day = await dayFixtures(date, key);
    const err = apiErrors(day);
    if (err) return json({ configured: true, error: `API-Football: ${err}` }, 300);
    const fx = findFixture(day.response ?? [], home, away, ko);
    if (!fx) return json({ configured: true, note: "Match not found for that date" }, 600);

    const start = new Date(fx.fixture.date).getTime();
    const now = Date.now();
    const inWindow = now > start - 20 * 60e3 && now < start + 3 * 3600e3;
    let f: ApiFixture = fx;
    if (inWindow) {
      const live = await apiFootball<ApiFixture[]>(`/fixtures?id=${fx.fixture.id}`, key, 90);
      if (!apiErrors(live) && live.response?.[0]) f = live.response[0];
    }

    const homeId = f.teams.home.id;
    const events: LiveEvent[] = (f.events ?? [])
      .filter((e) => (e.type === "Goal" && e.detail !== "Missed Penalty") || (e.type === "Card" && /red/i.test(e.detail)))
      .map((e) => ({
        minute: e.time.elapsed,
        extra: e.time.extra ?? null,
        // an own goal is listed under the team that scored it, so it counts for the other side
        side: (e.team.id === homeId) !== (e.detail === "Own Goal") ? "home" : "away",
        player: e.player.name ?? "Unknown",
        kind: e.type === "Card" ? "red" : e.detail === "Own Goal" ? "own" : e.detail === "Penalty" ? "pen" : "goal",
      }));

    return json(
      {
        configured: true,
        fixtureId: f.fixture.id,
        status: f.fixture.status.short,
        elapsed: f.fixture.status.elapsed,
        extra: f.fixture.status.extra ?? null,
        league: f.league?.name ?? null,
        home: { name: f.teams.home.name, logo: f.teams.home.logo, goals: f.goals?.home ?? null },
        away: { name: f.teams.away.name, logo: f.teams.away.logo, goals: f.goals?.away ?? null },
        events,
        kickoff: f.fixture.date,
      },
      inWindow ? 60 : 900,
    );
  } catch (e) {
    return json({ configured: true, error: `Couldn't load the live score (${(e as Error).message})` }, 30);
  }
}
