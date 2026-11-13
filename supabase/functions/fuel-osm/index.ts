// LifeHub — every UK petrol station's location from OpenStreetMap (© OpenStreetMap contributors, ODbL).
// Prices still come from fuel-sync; this fills in the stations those feeds miss so the map shows them all.
// Stations already covered by a price feed (within 150 m) are skipped. Run weekly by pg_cron, one band per call.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// The UK is fetched in 8 bands (?part=0..7) so each run stays small and fast
const BANDS: [number, number][] = [[49.8, 50.9], [50.9, 51.35], [51.35, 51.7], [51.7, 52.3], [52.3, 52.9], [52.9, 53.6], [53.6, 55.0], [55.0, 61.0]];
const query = (s: number, n: number) => `[out:json][timeout:40];nwr["amenity"="fuel"](${s},-8.7,${n},1.9);out center tags;`;
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

type El = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const SUPERMARKETS = /tesco|sainsbury|asda|morrisons|waitrose|co-?op|aldi|lidl/i;

Deno.serve(async (req) => {
  const part = Number(new URL(req.url).searchParams.get("part") ?? "-1");
  if (!(part >= 0 && part < BANDS.length)) return new Response(JSON.stringify({ ok: false, error: "part=0..7 required" }), { status: 400 });
  const [south, north] = BANDS[part];
  const QUERY = query(south, north);
  let els: El[] = [];
  let lastErr = "";
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "LifeHub/1.0 (personal dashboard)" },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(45000), // a busy mirror gives up quickly so the next one can be tried
      });
      if (!r.ok) throw new Error(`${url} ${r.status}`);
      els = (await r.json()).elements ?? [];
      if (els.length > 50) break;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  if (els.length < 50) return new Response(JSON.stringify({ ok: false, error: lastErr || "too few stations" }), { status: 502 });

  // Existing priced stations, to avoid duplicates
  const existing: { lat: number; lon: number; brand: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin.from("fuel_stations").select("lat,lon,brand").like("node_id", "cma-%").gte("lat", south - 0.01).lte("lat", north + 0.01).range(from, from + 999);
    existing.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const grid = new Map<string, { lat: number; lon: number; brand: string | null }[]>();
  const cell = (lat: number, lon: number) => `${Math.floor(lat * 100)}:${Math.floor(lon * 100)}`;
  for (const s of existing) grid.set(cell(s.lat, s.lon), [...(grid.get(cell(s.lat, s.lon)) ?? []), s]);
  // Same spot (150 m), or same brand close by (700 m — feeds and the map often place a site slightly differently)
  const norm = (b: string | null | undefined) => (b ?? "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 5);
  const near = (lat: number, lon: number, brand: string | null) => {
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (const s of grid.get(`${Math.floor(lat * 100) + a}:${Math.floor(lon * 100) + b}`) ?? []) {
          const dy = (s.lat - lat) * 111000;
          const dx = (s.lon - lon) * 111000 * Math.cos((lat * Math.PI) / 180);
          const d2 = dx * dx + dy * dy;
          if (d2 < 150 * 150 || (brand && norm(brand) === norm(s.brand) && d2 < 700 * 700)) return true;
        }
    return false;
  };

  const now = new Date().toISOString();
  const rows = [];
  for (const e of els) {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const t = e.tags ?? {};
    if (lat == null || lon == null || lat < south || lat >= north) continue;
    if (t["addr:country"] && !/^(GB|UK)$/i.test(t["addr:country"])) continue;
    if (t.access === "private" || t["disused:amenity"] || t.fuel_type === "lpg_only" || t["fuel:diesel"] === "no" && t["fuel:octane_95"] === "no") continue;
    const brand = t.brand ?? t.operator ?? null;
    if (near(lat, lon, brand)) continue;
    const name = t.name ?? brand ?? "Petrol station";
    rows.push({
      node_id: `osm-${e.type[0]}${e.id}`,
      name,
      brand,
      address: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") || null,
      city: t["addr:city"] ?? t["addr:town"] ?? null,
      postcode: t["addr:postcode"] ?? null,
      lat,
      lon,
      is_motorway: /services|motorway/i.test(`${name} ${t.highway ?? ""}`),
      is_supermarket: SUPERMARKETS.test(`${brand ?? ""} ${name}`),
      temporary_closure: false,
      permanent_closure: false,
      amenities: [],
      opening_times: t.opening_hours ? { osm: t.opening_hours } : null,
      phone: t.phone ?? t["contact:phone"] ?? null,
      synced_at: now,
    });
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("fuel_stations").upsert(rows.slice(i, i + 500), { onConflict: "node_id" });
    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
  // Drop OSM stations in this band that weren't in this run (removed from the map, or now covered by a price feed)
  await admin.from("fuel_stations").delete().like("node_id", "osm-%").gte("lat", south).lt("lat", north).lt("synced_at", now);
  return new Response(JSON.stringify({ ok: true, part, osm: els.length, added: rows.length }), { headers: { "Content-Type": "application/json" } });
});
