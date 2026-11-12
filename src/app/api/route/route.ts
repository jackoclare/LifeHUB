import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const UA = "MyLifeHub/1.0 (personal dashboard; https://life-hub-nine-rouge.vercel.app)";

type Hit = { name: string; address: string; lat: number; lon: number };

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** Find a named place near the user (Geoapify if a key is set, otherwise Photon / OpenStreetMap). */
async function search(q: string, lat: number, lon: number): Promise<Hit[]> {
  const key = process.env.GEOAPIFY_KEY;
  if (key) {
    try {
      const r = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&filter=countrycode:gb&bias=proximity:${lon},${lat}&limit=8&apiKey=${key}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) },
      );
      if (r.ok) {
        const j = await r.json();
        const hits: Hit[] = (j.features ?? []).map((f: { properties: Record<string, string | number> }) => ({
          name: String(f.properties.name ?? f.properties.address_line1 ?? q),
          address: String(f.properties.address_line2 ?? f.properties.formatted ?? ""),
          lat: Number(f.properties.lat),
          lon: Number(f.properties.lon),
        }));
        if (hits.length) return hits;
      }
    } catch {
      /* fall through */
    }
  }
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}&limit=10&lang=en`, {
    headers: { "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`search ${r.status}`);
  const j = await r.json();
  return (j.features ?? [])
    .filter((f: { properties: { countrycode?: string } }) => !f.properties.countrycode || f.properties.countrycode === "GB")
    .map((f: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }) => ({
      name: f.properties.name ?? q,
      address: [f.properties.street, f.properties.city ?? f.properties.district, f.properties.postcode].filter(Boolean).join(", "),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }));
}

/**
 * GET /api/route?q=tesco extra&lat=..&lon=..   (or &toLat=..&toLon=..&name=..)
 * Finds the nearest match and a driving route (OSRM, OpenStreetMap data): time, distance and the line to draw.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lon = Number(u.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: "Need your location" }, { status: 400 });
  const from = { lat, lon };

  let dest: Hit | null = null;
  const toLat = Number(u.searchParams.get("toLat"));
  const toLon = Number(u.searchParams.get("toLon"));
  if (Number.isFinite(toLat) && Number.isFinite(toLon) && u.searchParams.get("toLat")) {
    dest = { name: u.searchParams.get("name") ?? "Destination", address: u.searchParams.get("address") ?? "", lat: toLat, lon: toLon };
  } else {
    const q = (u.searchParams.get("q") ?? "").trim().slice(0, 120);
    if (!q) return NextResponse.json({ error: "Where to?" }, { status: 400 });
    try {
      const hits = (await search(q, lat, lon)).filter((h) => Number.isFinite(h.lat) && km(from, h) < 400);
      hits.sort((a, b) => km(from, a) - km(from, b));
      dest = hits[0] ?? null;
    } catch {
      return NextResponse.json({ error: "Place search isn't responding — try again" }, { status: 502 });
    }
    if (!dest) return NextResponse.json({ error: `I couldn't find "${q}" near you` }, { status: 404 });
  }

  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon},${lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json();
    const route = j.routes?.[0];
    if (!route) throw new Error("no route");
    return NextResponse.json({
      dest,
      minutes: Math.max(1, Math.round(route.duration / 60)),
      miles: Math.round((route.distance / 1609.34) * 10) / 10,
      line: (route.geometry.coordinates as [number, number][]).map(([x, y]) => [y, x]),
    });
  } catch {
    // Route service down: still return the destination with a straight-line estimate
    const d = km(from, dest) * 0.621371;
    return NextResponse.json({ dest, minutes: null, miles: Math.round(d * 10) / 10, line: null, note: "Couldn't get a driving route — showing distance as the crow flies" });
  }
}
