/**
 * Server-only helpers for API-Football (api-sports.io). Free plan = 100 requests/day and only
 * yesterday → tomorrow, so every call is cached in Next's data cache and shared by everyone
 * (the app, the match page and the goal-alert job all hit the same cached URLs).
 */
export const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

export const normTeam = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(fc|afc|cf|the|and|hove|albion|united|utd|city)\b/g, "")
    .replace(/[^a-z]/g, "");

export const sameTeam = (a: string, b: string) => {
  const x = normTeam(a);
  const y = normTeam(b);
  return x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)));
};

export type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null; extra?: number | null } };
  league?: { name: string; round?: string };
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals?: { home: number | null; away: number | null };
  events?: ApiEvent[];
};

export type ApiEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { name: string | null };
  assist?: { name: string | null };
  type: string; // "Goal" | "Card" | "subst" | "Var"
  detail: string; // "Normal Goal" | "Own Goal" | "Penalty" | "Missed Penalty" | "Red Card" | ...
};

export async function apiFootball<T>(path: string, key: string, ttl: number): Promise<{ response: T; errors?: unknown }> {
  const res = await fetch(`${API_FOOTBALL_BASE}${path}`, { headers: { "x-apisports-key": key }, next: { revalidate: ttl }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  return res.json();
}

export const apiErrors = (j: { errors?: unknown }) =>
  j.errors && (Array.isArray(j.errors) ? j.errors.length : Object.keys(j.errors as object).length) ? JSON.stringify(j.errors) : null;

/** All fixtures on a UK date — one request, cached for 3 hours (it's only used to find the fixture id). */
export function dayFixtures(date: string, key: string) {
  return apiFootball<ApiFixture[]>(`/fixtures?date=${date}&timezone=Europe/London`, key, 10800);
}

/** Pick the right game: youth/women's/reserve sides share names, so prefer exact senior names and the closest kick-off. */
export function findFixture(list: ApiFixture[], home: string, away: string, ko: number | null) {
  const youth = /\b(u-?\d{2}|under ?\d{2}|women|ladies|w|ii|b|reserves?|youth|academy)\b/i;
  const score = (f: ApiFixture) =>
    (normTeam(f.teams.home.name) === normTeam(home) ? 0 : 5) +
    (normTeam(f.teams.away.name) === normTeam(away) ? 0 : 5) +
    (youth.test(f.teams.home.name) && !youth.test(home) ? 50 : 0) +
    (youth.test(f.teams.away.name) && !youth.test(away) ? 50 : 0) +
    (ko ? Math.abs(new Date(f.fixture.date).getTime() - ko) / 3600e3 : 0);
  return list.filter((f) => sameTeam(f.teams.home.name, home) && sameTeam(f.teams.away.name, away)).sort((a, b) => score(a) - score(b))[0] ?? null;
}
