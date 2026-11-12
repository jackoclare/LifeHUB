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

/** Geoapify categories (primary + broader fallback if a category name is rejected). */
const GEO: Record<Cat, [string, string]> = {
  restaurants: ["catering.restaurant", "catering.restaurant"],
  pubs: ["catering.pub,catering.bar", "catering.pub"],
  cafes: ["catering.cafe", "catering.cafe"],
  takeaway: ["catering.fast_food", "catering.fast_food"],
  attractions: ["tourism.attraction,tourism.sights,entertainment.museum,entertainment.zoo,entertainment.aquarium,entertainment.theme_park", "tourism"],
  activities: ["entertainment.bowling_alley,entertainment.escape_game,entertainment.miniature_golf,entertainment.water_park,entertainment.activity_park,entertainment.amusement_arcade", "entertainment"],
  entertainment: ["entertainment.cinema,entertainment.culture.theatre,entertainment.culture.arts_centre,adult.nightclub", "entertainment.cinema"],
  outdoors: ["leisure.park", "leisure"],
};

type GeoFeature = {
  properties: {
    name?: string;
    lat: number;
    lon: number;
    formatted?: string;
    address_line2?: string;
    categories?: string[];
    opening_hours?: string;
    website?: string;
    contact?: { phone?: string };
    catering?: { cuisine?: string };
    place_id: string;
    datasource?: { raw?: Record<string, string | number> };
  };
};

async function fromGeoapify(key: string, lat: number, lon: number, cat: Cat, radius: number): Promise<Place[]> {
  for (const cats of GEO[cat]) {
    const url = `https://api.geoapify.com/v2/places?categories=${cats}&filter=circle:${lon},${lat},${radius}&bias=proximity:${lon},${lat}&limit=100&apiKey=${key}`;
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000) });
    if (res.status === 400) continue; // unknown category — try the broader one
    if (!res.ok) throw new Error(`Geoapify ${res.status}`);
    const data = (await res.json()) as { features: GeoFeature[] };
    return data.features
      .filter((f) => f.properties.name)
      .map((f) => {
        const p = f.properties;
        const raw = p.datasource?.raw ?? {};
        const kind = (p.categories ?? []).filter((c) => c.split(".").length >= 2).sort((a, b) => b.length - a.length)[0]?.split(".").pop() ?? "";
        return {
          id: raw.osm_id ? `${raw.osm_type === "w" ? "way" : raw.osm_type === "r" ? "relation" : "node"}/${raw.osm_id}` : `geo/${p.place_id}`,
          name: p.name!,
          category: cat,
          kind: kind.replace(/_/g, " "),
          lat: p.lat,
          lon: p.lon,
          address: p.address_line2 ?? p.formatted ?? null,
          openingHours: p.opening_hours ?? (raw.opening_hours as string) ?? null,
          website: p.website ?? (raw.website as string) ?? null,
          phone: p.contact?.phone ?? (raw.phone as string) ?? null,
          cuisine: p.catering?.cuisine ? p.catering.cuisine.replace(/_/g, " ").replace(/;/g, ", ") : null,
        };
      });
  }
  return [];
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  const cat = (sp.get("cat") ?? "restaurants") as Cat;
  const radius = Math.min(Math.max(Number(sp.get("radius") ?? 2000), 300), 8000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(cat in CATEGORIES)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const geoKey = process.env.GEOAPIFY_KEY;
  if (geoKey) {
    try {
      const places = await fromGeoapify(geoKey, lat, lon, cat, radius);
      return NextResponse.json({ source: "Geoapify / OpenStreetMap contributors", places }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
    } catch (e) {
      console.error("[places] Geoapify failed, falling back to Overpass", (e as Error).message);
    }
  }
  // round so nearby requests share the cache
  const rlat = lat.toFixed(3);
  const rlon = lon.toFixed(3);
  const query = `[out:json][timeout:20];(${CATEGORIES[cat]}["name"](around:${radius},${rlat},${rlon}););out center tags 120;`;

  try {
    // Public Overpass servers are busy and sometimes refuse cloud traffic — try a few mirrors in turn.
    const mirrors = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
    // Ask all mirrors at once and use the first good answer.
    const attempt = async (m: string) => {
      const r = await fetch(`${m}?data=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "MyLifeHub/1.0 (personal dashboard; https://life-hub-nine-rouge.vercel.app)" },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(14000),
      });
      if (!r.ok) throw new Error(`${new URL(m).host} ${r.status}`);
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
