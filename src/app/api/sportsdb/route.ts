import { NextResponse } from "next/server";

/**
 * Small, whitelisted proxy to TheSportsDB v1 (free key "123" unless THESPORTSDB_KEY is set).
 * kind=event|lineup|league-next|league-past|table, id=<number>
 */
const ENDPOINTS = {
  event: { path: (id: string) => `lookupevent.php?id=${id}`, ttl: 300, key: "events" },
  lineup: { path: (id: string) => `lookuplineup.php?id=${id}`, ttl: 300, key: "lineup" },
  timeline: { path: (id: string) => `lookuptimeline.php?id=${id}`, ttl: 120, key: "timeline" },
  stats: { path: (id: string) => `lookupeventstats.php?id=${id}`, ttl: 300, key: "eventstats" },
  "league-next": { path: (id: string) => `eventsnextleague.php?id=${id}`, ttl: 1800, key: "events" },
  "league-past": { path: (id: string) => `eventspastleague.php?id=${id}`, ttl: 1800, key: "events" },
  table: { path: (id: string) => `lookuptable.php?l=${id}`, ttl: 1800, key: "table" },
  searchteam: { path: (q: string) => `searchteams.php?t=${encodeURIComponent(q)}`, ttl: 86400, key: "teams" },
} as const;

type Kind = keyof typeof ENDPOINTS;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") as Kind;
  const id = sp.get("id") ?? "";
  const valid = kind === "searchteam" ? /^[\p{L}0-9 .'&-]{2,40}$/u.test(id) : /^\d{3,9}$/.test(id);
  if (!(kind in ENDPOINTS) || !valid) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const ep = ENDPOINTS[kind];
  const key = process.env.THESPORTSDB_KEY || "123";
  try {
    const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${key}/${ep.path(id)}`, { next: { revalidate: ep.ttl } });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      /* some endpoints return an empty body when there's no data */
    }
    const items = (json[ep.key] as unknown[] | null) ?? [];
    return NextResponse.json({ source: "TheSportsDB", kind, items }, { headers: { "Cache-Control": `public, s-maxage=${ep.ttl}, stale-while-revalidate=${ep.ttl * 4}` } });
  } catch (e) {
    return NextResponse.json({ kind, items: [], error: `Couldn't load (${(e as Error).message})` }, { status: 200 });
  }
}
