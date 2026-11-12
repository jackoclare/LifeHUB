// Syncs UK Fuel Finder open data (stations + prices) into Postgres.
// Secrets (set in Supabase → Edge Functions → Secrets): FUEL_FINDER_CLIENT_ID, FUEL_FINDER_CLIENT_SECRET
// Optional: FUEL_FINDER_BASE (defaults to the GOV.UK production host)
import { createClient } from "npm:@supabase/supabase-js@2";

const BASE = (Deno.env.get("FUEL_FINDER_BASE") ?? "https://www.fuel-finder.service.gov.uk").replace(/\/$/, "");
const UA = "MyLifeHub/1.0 (personal fuel price viewer)";
const clean = (v?: string | null) => (v ?? "").trim().replace(/^["']|["']$/g, "");
const CLIENT_ID = clean(Deno.env.get("FUEL_FINDER_CLIENT_ID"));
const CLIENT_SECRET = clean(Deno.env.get("FUEL_FINDER_CLIENT_SECRET"));

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/oauth/generate_access_token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token ${res.status}: ${text.slice(0, 200)}`);
  const body = JSON.parse(text);
  const token = body?.data?.access_token ?? body?.access_token;
  if (!token) throw new Error(`token missing in response: ${text.slice(0, 200)}`);
  return token;
}

// Page through a batched endpoint until it returns 404 (no more batches)
async function pages<T>(path: string, token: string, extra = ""): Promise<T[]> {
  const out: T[] = [];
  for (let batch = 1; batch <= 60; batch++) {
    const res = await fetch(`${BASE}${path}?batch-number=${batch}${extra}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (res.status === 404) break;
    const text = await res.text();
    if (!res.ok) throw new Error(`${path} batch ${batch} ${res.status}: ${text.slice(0, 200)}`);
    const body = JSON.parse(text);
    const items: T[] = Array.isArray(body) ? body : body?.data ?? [];
    if (!items.length) break;
    out.push(...items);
  }
  return out;
}

async function upsertChunks(table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// deno-lint-ignore no-explicit-any
type Any = any;

async function syncStations(token: string) {
  const items = await pages<Any>("/api/v1/pfs", token);
  const rows = items
    .filter((s) => s?.node_id)
    .map((s) => {
      const l = s.location ?? {};
      return {
        node_id: String(s.node_id),
        name: s.trading_name ?? s.brand_name ?? "Fuel station",
        brand: s.brand_name ?? null,
        address: [l.address_line_1, l.address_line_2].filter(Boolean).join(", ") || null,
        city: l.city ?? null,
        postcode: l.postcode ?? null,
        lat: typeof l.latitude === "number" ? l.latitude : Number(l.latitude) || null,
        lon: typeof l.longitude === "number" ? l.longitude : Number(l.longitude) || null,
        is_motorway: !!s.is_motorway_service_station,
        is_supermarket: !!s.is_supermarket_service_station,
        temporary_closure: !!s.temporary_closure,
        permanent_closure: !!s.permanent_closure,
        amenities: Array.isArray(s.amenities) ? s.amenities.map(String) : [],
        opening_times: s.opening_times ?? null,
        phone: s.public_phone_number ?? null,
        synced_at: new Date().toISOString(),
      };
    });
  await upsertChunks("fuel_stations", rows, "node_id");
  return rows.length;
}

async function syncPrices(token: string) {
  const items = await pages<Any>("/api/v1/pfs/fuel-prices", token);
  const { data: known } = await db.from("fuel_stations").select("node_id");
  const ids = new Set((known ?? []).map((r: Any) => r.node_id));
  const rows: Record<string, unknown>[] = [];
  for (const s of items) {
    if (!s?.node_id || !ids.has(String(s.node_id))) continue;
    for (const p of s.fuel_prices ?? []) {
      const price = Number(p?.price);
      if (!p?.fuel_type || !Number.isFinite(price) || price <= 0) continue;
      rows.push({
        node_id: String(s.node_id),
        fuel_type: String(p.fuel_type),
        price,
        price_last_updated: p.price_last_updated ?? p.price_change_effective_timestamp ?? null,
        synced_at: new Date().toISOString(),
      });
    }
  }
  await upsertChunks("fuel_prices", rows, "node_id,fuel_type");
  return rows.length;
}

// Fallback: retailers' own open JSON price feeds (the CMA interim scheme). Partial coverage; only fresh feeds are used.
const FEEDS: Record<string, string> = {
  Asda: "https://storelocator.asda.com/fuel_prices_data.json",
  "Esso / Tesco Alliance": "https://fuelprices.esso.co.uk/latestdata.json",
  Tesco: "https://www.tesco.com/fuel_prices/fuel_prices_data.json",
  JET: "https://jetlocal.co.uk/fuel_prices_data.json",
  Morrisons: "https://www.morrisons.com/fuel-prices/fuel.json",
  Moto: "https://moto-way.com/fuel-price/fuel_prices.json",
  Rontec: "https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json",
  SGN: "https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json",
  "Motor Fuel Group": "https://fuel.motorfuelgroup.com/fuel_prices_data.json",
  bp: "https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json",
};
const FEED_FUEL: Record<string, string> = { E10: "E10", E5: "E5", B7: "B7_Standard", SDV: "B7_Premium" };
const MAX_AGE_DAYS = 8;

function parseUkDate(v?: string): string | null {
  const m = v?.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  // Feeds use UK local time; treat as Europe/London (GMT in winter, BST in summer — close enough for "updated" labels)
  const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] ?? "00"}Z`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function syncRetailerFeeds() {
  const report: Record<string, string> = {};
  const stations: Record<string, unknown>[] = [];
  const prices: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  await Promise.all(
    Object.entries(FEEDS).map(async ([retailer, url]) => {
      try {
        const res = await fetch(url, { headers: { accept: "application/json", "user-agent": UA }, signal: AbortSignal.timeout(20000) });
        if (!res.ok) return void (report[retailer] = `HTTP ${res.status}`);
        const body = await res.json();
        const updated = parseUkDate(body?.last_updated);
        if (!updated || Date.now() - new Date(updated).getTime() > MAX_AGE_DAYS * 864e5) return void (report[retailer] = `stale (${body?.last_updated ?? "no date"})`);
        let n = 0;
        for (const st of body?.stations ?? []) {
          const lat = Number(st?.location?.latitude), lon = Number(st?.location?.longitude);
          if (!st?.site_id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const id = `cma-${st.site_id}`;
          stations.push({
            node_id: id, name: st.address ?? st.brand ?? retailer, brand: st.brand ?? retailer, address: st.address ?? null, city: null,
            postcode: st.postcode ?? null, lat, lon, is_motorway: retailer === "Moto", is_supermarket: ["Asda", "Tesco", "Morrisons"].includes(retailer),
            temporary_closure: false, permanent_closure: false, amenities: [], opening_times: null, phone: null, synced_at: now,
          });
          for (const [k, raw] of Object.entries(st?.prices ?? {})) {
            const ft = FEED_FUEL[k];
            let price = Number(raw);
            if (!ft || !Number.isFinite(price) || price <= 0) continue;
            if (price < 10) price = price * 100; // some feeds give pounds
            prices.push({ node_id: id, fuel_type: ft, price: Math.round(price * 10) / 10, price_last_updated: updated, synced_at: now });
          }
          n++;
        }
        report[retailer] = `${n} stations (updated ${body.last_updated})`;
      } catch (e) {
        report[retailer] = `error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120);
      }
    }),
  );
  const uniq = <T extends Record<string, unknown>>(rows: T[], key: (r: T) => string) => [...new Map(rows.map((r) => [key(r), r])).values()];
  await upsertChunks("fuel_stations", uniq(stations, (r) => String(r.node_id)), "node_id");
  await upsertChunks("fuel_prices", uniq(prices, (r) => `${r.node_id}|${r.fuel_type}`), "node_id,fuel_type");
  // Drop feed prices that weren't refreshed this run (a feed went stale or a station left it)
  await db.from("fuel_prices").delete().like("node_id", "cma-%").lt("synced_at", new Date(Date.now() - 3 * 3600e3).toISOString());
  return { stations: stations.length, prices: prices.length, report };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("probe") !== null) {
    const r = await fetch(`${BASE}/api/v1/pfs?batch-number=1`, { headers: { accept: "application/json" } });
    return json({ status: r.status, cache: r.headers.get("x-cache"), body: (await r.text()).slice(0, 200), region: Deno.env.get("SB_REGION") ?? null });
  }
  if (req.method === "GET" && url.searchParams.get("status") !== null) {
    const { data } = await db.from("fuel_sync_log").select("*").order("id", { ascending: false }).limit(3);
    return json({ configured: !!(CLIENT_ID && CLIENT_SECRET), idLength: CLIENT_ID.length, secretLength: CLIENT_SECRET.length, base: BASE, recent: data });
  }
  const { data: log } = await db.from("fuel_sync_log").insert({}).select("id").single();
  let token: string | null = null;
  let ffError = "Fuel Finder credentials not set";
  if (CLIENT_ID && CLIENT_SECRET) {
    try {
      token = await getToken();
    } catch (e) {
      ffError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!token) {
    // Fuel Finder unreachable (its firewall currently refuses cloud servers) — use the retailers' own feeds instead
    try {
      const r = await syncRetailerFeeds();
      const note = `fallback feeds (Fuel Finder: ${ffError}) ${JSON.stringify(r.report)}`;
      await db.from("fuel_sync_log").update({ finished_at: new Date().toISOString(), stations: r.stations, prices: r.prices, error: note.slice(0, 500) }).eq("id", log?.id);
      return json({ ok: true, source: "retailer-feeds", fuelFinder: ffError, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("fuel_sync_log").update({ finished_at: new Date().toISOString(), error: `feeds failed: ${msg}`.slice(0, 500) }).eq("id", log?.id);
      return json({ error: msg }, 500);
    }
  }
  try {
    // Stations change rarely: refresh if empty, older than 12h, or forced
    const { data: last } = await db.from("fuel_stations").select("synced_at").order("synced_at", { ascending: false }).limit(1);
    const stale = !last?.length || Date.now() - new Date(last[0].synced_at).getTime() > 12 * 3600e3;
    const stations = stale || url.searchParams.get("stations") ? await syncStations(token) : null;
    const prices = await syncPrices(token);
    await db.from("fuel_sync_log").update({ finished_at: new Date().toISOString(), stations, prices }).eq("id", log?.id);
    return json({ ok: true, stations, prices });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("fuel_sync_log").update({ finished_at: new Date().toISOString(), error: msg.slice(0, 500) }).eq("id", log?.id);
    return json({ error: msg }, 500);
  }
});
