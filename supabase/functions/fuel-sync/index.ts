// Syncs UK Fuel Finder open data (stations + prices) into Postgres.
// Secrets (set in Supabase → Edge Functions → Secrets): FUEL_FINDER_CLIENT_ID, FUEL_FINDER_CLIENT_SECRET
// Optional: FUEL_FINDER_BASE (defaults to the GOV.UK production host)
import { createClient } from "npm:@supabase/supabase-js@2";

const BASE = (Deno.env.get("FUEL_FINDER_BASE") ?? "https://www.fuel-finder.service.gov.uk").replace(/\/$/, "");
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
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "FUEL_FINDER_CLIENT_ID / FUEL_FINDER_CLIENT_SECRET not set" }, 500);

  const { data: log } = await db.from("fuel_sync_log").insert({}).select("id").single();
  try {
    const token = await getToken();
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
