// LifeHub — what's on near you (Supabase Edge Function, Deno)
// Ticketmaster Discovery API (free key from developer.ticketmaster.com, 5,000 calls/day). Secret: TICKETMASTER_KEY
// GET ?lat=52.707&lon=-2.754&miles=15&days=7
const KEY = (Deno.env.get("TICKETMASTER_KEY") ?? "").trim();
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const json = (b: unknown, status = 200, maxAge = 1800) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` } });

type TmEvent = {
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string }; status?: { code?: string } };
  images?: { url: string; width: number; ratio?: string }[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  priceRanges?: { min?: number; currency?: string }[];
  _embedded?: { venues?: { name?: string; city?: { name?: string }; location?: { latitude?: string; longitude?: string } }[] };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!KEY) return json({ configured: false, events: [] }, 200, 300);
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat") ?? 52.7073);
  const lon = Number(u.searchParams.get("lon") ?? -2.7553);
  const miles = Math.min(50, Math.max(2, Number(u.searchParams.get("miles")) || 15));
  const days = Math.min(31, Math.max(1, Number(u.searchParams.get("days")) || 7));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ configured: true, events: [], error: "Bad location" }, 400);
  const start = new Date();
  const end = new Date(start.getTime() + days * 86400e3);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const q = new URLSearchParams({
    apikey: KEY,
    latlong: `${lat.toFixed(4)},${lon.toFixed(4)}`,
    radius: String(miles),
    unit: "miles",
    countryCode: "GB",
    startDateTime: iso(start),
    endDateTime: iso(end),
    sort: "date,asc",
    size: "60",
    locale: "*",
  });
  try {
    const r = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${q}`, { signal: AbortSignal.timeout(10000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json({ configured: true, events: [], error: j?.fault?.faultstring ?? `Ticketmaster ${r.status}` }, 502, 120);
    const seen = new Set<string>();
    const events = ((j?._embedded?.events ?? []) as TmEvent[])
      .filter((e) => e.dates?.status?.code !== "cancelled")
      .map((e) => {
        const v = e._embedded?.venues?.[0];
        const img = (e.images ?? []).filter((i) => i.ratio === "16_9").sort((a, b) => a.width - b.width).find((i) => i.width >= 500) ?? e.images?.[0];
        const c = e.classifications?.[0];
        return {
          name: e.name,
          date: e.dates?.start?.localDate ?? null,
          time: e.dates?.start?.localTime?.slice(0, 5) ?? null,
          venue: v?.name ?? null,
          town: v?.city?.name ?? null,
          url: e.url ?? null,
          image: img?.url ?? null,
          kind: [c?.segment?.name, c?.genre?.name].filter((x) => x && x !== "Undefined").join(" · ") || null,
          from: e.priceRanges?.[0]?.min ?? null,
        };
      })
      .filter((e) => {
        const k = `${e.name}|${e.date}|${e.venue}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    return json({ configured: true, events });
  } catch (e) {
    return json({ configured: true, events: [], error: `Couldn't reach Ticketmaster (${(e as Error).message})` }, 502, 60);
  }
});
