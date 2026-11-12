// Cheapest recent flight prices (Aviasales Data API via Travelpayouts — free partner token).
// GET ?from=BHX&to=AGP&depart=2026-12[-05]&return=2026-12[-12]&adults=2
// Secret: TRAVELPAYOUTS_TOKEN. Prices are cached from real searches in the last few days — always confirm when booking.
const TOKEN = (Deno.env.get("TRAVELPAYOUTS_TOKEN") ?? "").trim();
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=1800" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!TOKEN) return json({ configured: false, flights: [] });
  const u = new URL(req.url);
  // Cheapest recent return fare to every destination from one airport, for a month (map price tags)
  if (u.searchParams.get("mode") === "cheapest") {
    const origin = (u.searchParams.get("from") ?? "").toUpperCase();
    const month = u.searchParams.get("month") ?? "";
    if (!/^[A-Z]{3}$/.test(origin) || !/^\d{4}-\d{2}$/.test(month)) return json({ configured: true, prices: {} }, 400);
    const q = new URLSearchParams({ origin, period_type: "month", beginning_of_period: `${month}-01`, currency: "gbp", one_way: "false", sorting: "price", limit: "1000", market: "uk", token: TOKEN });
    try {
      const r = await fetch(`https://api.travelpayouts.com/aviasales/v3/get_latest_prices?${q}`, { headers: { "Accept-Encoding": "gzip" } });
      const j = await r.json();
      const prices: Record<string, { price: number; direct: boolean; depart: string }> = {};
      // deno-lint-ignore no-explicit-any
      for (const f of (j.data ?? []) as any[]) {
        const code = String(f.destination ?? "").toUpperCase();
        const price = Number(f.value ?? f.price);
        if (!code || !Number.isFinite(price)) continue;
        if (!prices[code] || price < prices[code].price) prices[code] = { price, direct: (f.number_of_changes ?? f.transfers ?? 1) === 0, depart: f.depart_date ?? f.departure_at ?? "" };
      }
      return json({ configured: true, prices });
    } catch (e) {
      return json({ configured: true, prices: {}, error: e instanceof Error ? e.message : "Couldn't reach flight prices" }, 502);
    }
  }
  const from = (u.searchParams.get("from") ?? "").toUpperCase();
  const to = (u.searchParams.get("to") ?? "").toUpperCase();
  const depart = u.searchParams.get("depart") ?? "";
  const ret = u.searchParams.get("return") ?? "";
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !/^\d{4}-\d{2}(-\d{2})?$/.test(depart)) return json({ configured: true, flights: [], error: "Pick an airport, destination and date" }, 400);

  const q = new URLSearchParams({
    origin: from,
    destination: to,
    departure_at: depart,
    one_way: ret ? "false" : "true",
    currency: "gbp",
    sorting: "price",
    limit: "12",
    market: "uk",
    token: TOKEN,
  });
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(ret)) q.set("return_at", ret);
  try {
    const r = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${q}`, { headers: { "Accept-Encoding": "gzip" } });
    const j = await r.json();
    if (!r.ok || j.success === false) return json({ configured: true, flights: [], error: j?.error ?? `Flight data error ${r.status}` }, 502);
    // deno-lint-ignore no-explicit-any
    const flights = (j.data ?? []).map((f: any) => ({
      price: f.price,
      airline: f.airline,
      flightNumber: f.flight_number,
      departAt: f.departure_at,
      returnAt: f.return_at ?? null,
      stops: f.transfers ?? 0,
      returnStops: f.return_transfers ?? null,
      minutes: f.duration_to ?? f.duration ?? null,
      link: f.link ? `https://www.aviasales.com${f.link}` : null,
    }));
    return json({ configured: true, currency: "GBP", flights });
  } catch (e) {
    return json({ configured: true, flights: [], error: e instanceof Error ? e.message : "Couldn't reach flight prices" }, 502);
  }
});
