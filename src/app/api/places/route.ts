import { NextResponse } from "next/server";

/**
 * Nearby places from OpenStreetMap via the Overpass API (free, open data, ODbL).
 * OSM has names, categories, addresses, opening hours, websites and phone numbers,
 * but no ratings or reviews. Cached for a day per area/category to respect fair use.
 */

export const maxDuration = 20;

const CATEGORIES = {
  restaurants: `nwr["amenity"="restaurant"]`,
  pubs: `nwr["amenity"~"^(pub|bar)$"]`,
  cafes: `nwr["amenity"="cafe"]`,
  takeaway: `nwr["amenity"="fast_food"]`,
  attractions: `nwr["tourism"~"^(attraction|museum|gallery|zoo|aquarium|theme_park|viewpoint)$"]`,
  activities: `nwr["leisure"~"^(bowling_alley|escape_game|miniature_golf|water_park|ice_rink|trampoline_park|amusement_arcade|sports_centre)$"]`,
  entertainment: `nwr["amenity"~"^(cinema|theatre|arts_centre|nightclub|casino)$"]`,
  outdoors: `nwr["leisure"~"^(park|nature_reserve|garden)$"]["name"]`,
} as const;

type Cat = keyof typeof CATEGORIES;

export type Place = {
  id: string;
  name: string;
  category: Cat;
  kind: string;
  lat: number;
  lon: number;
  address: string | null;
  openingHours: string | null;
  website: string | null;
  phone: string | null;
  cuisine: string | null;
};

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  const cat = (sp.get("cat") ?? "restaurants") as Cat;
  const radius = Math.min(Math.max(Number(sp.get("radius") ?? 2000), 300), 8000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(cat in CATEGORIES)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  // round so nearby requests share the cache
  const rlat = lat.toFixed(3);
  const rlon = lon.toFixed(3);
  const query = `[out:json][timeout:20];(${CATEGORIES[cat]}["name"](around:${radius},${rlat},${rlon}););out center tags 120;`;

  try {
    // Public Overpass servers are busy and sometimes refuse cloud traffic — try a few mirrors in turn.
    const mirrors = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
    // Ask all mirrors at once and use the first good answer.
    const attempt = async (m: string) => {
      const r = await fetch(`${m}?data=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "MyLifeHub/1.0 (personal dashboard; https://life-hub-nine-rouge.vercel.app)", Accept: "application/json" },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(9000),
      });
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) throw new Error(`${new URL(m).host} ${r.status}`);
      return r;
    };
    let res: Response;
    try {
      res = await Promise.any(mirrors.map(attempt));
    } catch (agg) {
      const errs = (agg as AggregateError).errors?.map((x: Error) => x.message).join("; ");
      throw new Error(errs || "no server answered");
    }
    const data = await res.json();
    type El = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
    const places: Place[] = (data.elements as El[])
      .map((e): Place | null => {
        const t = e.tags ?? {};
        const plat = e.lat ?? e.center?.lat;
        const plon = e.lon ?? e.center?.lon;
        if (plat == null || plon == null || !t.name) return null;
        const address = [[t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "), t["addr:city"] ?? t["addr:town"], t["addr:postcode"]].filter(Boolean).join(", ") || null;
        return {
          id: `${e.type}/${e.id}`,
          name: t.name,
          category: cat,
          kind: (t.amenity ?? t.tourism ?? t.leisure ?? "").replace(/_/g, " "),
          lat: plat,
          lon: plon,
          address,
          openingHours: t.opening_hours ?? null,
          website: t.website ?? t["contact:website"] ?? null,
          phone: t.phone ?? t["contact:phone"] ?? null,
          cuisine: t.cuisine ? t.cuisine.replace(/_/g, " ").replace(/;/g, ", ") : null,
        };
      })
      .filter((p): p is Place => p !== null);
    return NextResponse.json(
      { source: "OpenStreetMap contributors", places },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (e) {
    return NextResponse.json({ places: [], error: `Couldn't load places right now (${(e as Error).message}). Try again in a minute.` }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
