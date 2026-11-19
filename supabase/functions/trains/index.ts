// LifeHub — live train departures (Supabase Edge Function, Deno)
// Official National Rail data via the free Rail Data Marketplace "Live Departure Board" product.
// Secret: RAIL_DATA_KEY (the product's Consumer key). Optional: RAIL_DATA_URL to override the endpoint.
// GET ?from=SHR&to=BHM&rows=10   (to is optional)
const KEY = (Deno.env.get("RAIL_DATA_KEY") ?? "").trim();
const URLS = [
  Deno.env.get("RAIL_DATA_URL"),
  "https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120/GetDepBoardWithDetails",
  "https://api1.raildata.org.uk/1010-live-departure-board-dep/LDBWS/api/20220120/GetDepBoardWithDetails",
].filter(Boolean) as string[];

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const json = (b: unknown, status = 200, maxAge = 45) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` } });

type Loc = { locationName?: string; crs?: string };
type Svc = {
  std?: string;
  etd?: string;
  platform?: string;
  operator?: string;
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  serviceID?: string;
  destination?: Loc[];
  subsequentCallingPoints?: { callingPoint?: { locationName?: string; crs?: string; st?: string; et?: string }[] }[];
  length?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!KEY) return json({ configured: false, services: [] }, 200, 300);
  const u = new URL(req.url);
  const from = (u.searchParams.get("from") ?? "SHR").toUpperCase();
  const to = (u.searchParams.get("to") ?? "").toUpperCase();
  const rows = Math.min(20, Math.max(1, Number(u.searchParams.get("rows")) || 10));
  if (!/^[A-Z]{3}$/.test(from) || (to && !/^[A-Z]{3}$/.test(to))) return json({ configured: true, services: [], error: "Use 3-letter station codes (e.g. SHR)" }, 400);
  const q = new URLSearchParams({ numRows: String(rows), timeWindow: "120", ...(to ? { filterCrs: to, filterType: "to" } : {}) });

  let lastErr = "";
  for (const base of URLS) {
    try {
      const r = await fetch(`${base}/${from}?${q}`, { headers: { "x-apikey": KEY, accept: "application/json" }, signal: AbortSignal.timeout(10000) });
      if (r.status === 401 || r.status === 403) return json({ configured: true, services: [], error: "The Rail Data key was refused — check RAIL_DATA_KEY and that you subscribed to Live Departure Board." }, 502, 30);
      if (!r.ok) {
        lastErr = `HTTP ${r.status}`;
        continue;
      }
      const j = await r.json();
      const services = ((j.trainServices ?? []) as Svc[]).map((s) => {
        const calls = s.subsequentCallingPoints?.[0]?.callingPoint ?? [];
        const stop = to ? calls.find((c) => c.crs === to) : calls[calls.length - 1];
        return {
          id: s.serviceID ?? `${s.std}-${s.destination?.[0]?.crs}`,
          std: s.std ?? "",
          etd: s.etd ?? "",
          platform: s.platform ?? null,
          operator: s.operator ?? "",
          destination: (s.destination ?? []).map((d) => d.locationName).filter(Boolean).join(" & "),
          cancelled: Boolean(s.isCancelled) || s.etd === "Cancelled",
          reason: s.cancelReason ?? s.delayReason ?? null,
          arrive: stop ? { name: stop.locationName ?? "", st: stop.st ?? "", et: stop.et ?? "" } : null,
          calling: calls.map((c) => c.locationName).filter(Boolean).slice(0, 12),
          coaches: s.length ?? null,
        };
      });
      return json({
        configured: true,
        station: j.locationName ?? from,
        to: to ? (j.filterLocationName ?? to) : null,
        generatedAt: j.generatedAt ?? new Date().toISOString(),
        messages: ((j.nrccMessages ?? []) as { Value?: string; value?: string }[]).map((m) => String(m.Value ?? m.value ?? "").replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 3),
        services,
      });
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  return json({ configured: true, services: [], error: `Couldn't reach National Rail (${lastErr})` }, 502, 20);
});
