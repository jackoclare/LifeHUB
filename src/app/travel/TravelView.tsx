"use client";

import { BedDouble, CalendarPlus, Check, ExternalLink, Heart, Luggage, PlaneTakeoff, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapView } from "@/components/map/MapView";
import { SectionHeader } from "@/components/kit";
import { WeatherIcon } from "@/components/weather/WeatherWidgets";
import { ErrorNote, Field, Sheet, inputClass } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { run, useRows } from "@/lib/useRows";
import { addDays, toISODate } from "@/lib/dates";
import { DESTINATIONS, type Destination, UK_AIRPORTS, searchLinks } from "@/lib/travel";
import { describe, useWeather } from "@/lib/weather";

const REGIONS = ["All", "Spain", "Portugal", "France", "Italy", "Greece", "Worldwide", "Saved"] as const;
const regionColor: Record<string, string> = { Spain: "#ef4444", Portugal: "#22c55e", France: "#3b82f6", Italy: "#10b981", Greece: "#0ea5e9", Worldwide: "#a855f7" };

const nextFriday = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  return toISODate(d);
};

export function TravelView() {
  const { user } = useAuth();
  const saved = useRows<{ id: string; code: string }>("saved_destinations", [], Boolean(user));
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");
  const [from, setFrom] = useState("BHX");
  useEffect(() => {
    try {
      const a = localStorage.getItem("mlh.airport");
      if (a) setFrom(a);
    } catch {
      /* ignore */
    }
  }, []);
  const [out, setOut] = useState(nextFriday);
  const [nights, setNights] = useState(7);
  const [oneWay, setOneWay] = useState(false);
  const [adults, setAdults] = useState(2);
  const [selected, setSelected] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, { price: number; direct: boolean; depart: string }>>({});
  const [pricesOn, setPricesOn] = useState(false);
  const [budget, setBudget] = useState(0);
  const [directOnly, setDirectOnly] = useState(false);

  // Cheapest recent fares from your airport for the month you're travelling
  useEffect(() => {
    let alive = true;
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/flights?mode=cheapest&from=${from}&month=${out.slice(0, 7)}`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setPricesOn(Boolean(j.configured));
        setPrices(j.prices ?? {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [from, out]);

  const savedCodes = new Set(saved.rows.map((r) => r.code));
  const list = useMemo(
    () => DESTINATIONS.filter((d) => (region === "All" ? true : region === "Saved" ? savedCodes.has(d.code) : d.region === region)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [region, saved.rows],
  );
  const back = oneWay ? null : addDays(out, nights);
  const getaways = useMemo(
    () =>
      [...list]
        .filter((d) => !budget || (prices[d.code] && prices[d.code].price <= budget))
        .filter((d) => !directOnly || prices[d.code]?.direct)
        .sort((a, b) => (prices[a.code]?.price ?? 1e9) - (prices[b.code]?.price ?? 1e9)),
    [list, prices, budget, directOnly],
  );
  const weekendPicks = useMemo(() => {
    const short = DESTINATIONS.filter((d) => ["AMS", "CDG", "BCN", "DUB", "FCO", "LIS", "PMI", "AGP", "DBV", "VCE"].includes(d.code));
    return [...short].sort((a, b) => (prices[a.code]?.price ?? 1e9) - (prices[b.code]?.price ?? 1e9)).slice(0, 6);
  }, [prices]);
  const sel = DESTINATIONS.find((d) => d.code === selected) ?? null;

  const setAirport = (c: string) => {
    setFrom(c);
    try {
      localStorage.setItem("mlh.airport", c);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <section className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Flying from">
          <select className={inputClass} value={from} onChange={(e) => setAirport(e.target.value)}>
            {UK_AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Going out">
          <input type="date" className={inputClass} value={out} min={toISODate(new Date())} onChange={(e) => setOut(e.target.value)} />
        </Field>
        <Field label="How long">
          <select className={inputClass} value={oneWay ? "0" : String(nights)} onChange={(e) => (e.target.value === "0" ? setOneWay(true) : (setOneWay(false), setNights(Number(e.target.value))))}>
            {[3, 4, 5, 7, 10, 14].map((n) => (
              <option key={n} value={n}>
                {n} nights
              </option>
            ))}
            <option value="0">One way</option>
          </select>
        </Field>
        <Field label="Adults">
          <select className={inputClass} value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
        <div className="flex items-end text-xs text-muted">
          {back ? `Back ${new Date(back).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : "One-way trip"}
        </div>
      </section>

      {/* Map with price tags (prices appear once the flight-price key is added) */}
      <section className="overflow-hidden rounded-[1.9rem] shadow-[var(--shadow)]">
        <MapView
          className="h-[44dvh] min-h-80"
          center={{ lat: 44, lon: 3 }}
          zoom={4}
          selectedId={selected}
          onSelect={setSelected}
          points={list
            .filter((d) => !budget || (prices[d.code] && prices[d.code].price <= budget))
            .filter((d) => !directOnly || prices[d.code]?.direct)
            .map((d) => ({ id: d.code, lat: d.lat, lon: d.lon, color: regionColor[d.region], label: d.city, badge: prices[d.code] ? `${d.code} £${Math.round(prices[d.code].price)}` : d.code }))}
        />
      </section>

      {/* Filters */}
      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {REGIONS.filter((r) => r !== "Saved" || user).map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              aria-pressed={region === r}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-all active:scale-95 ${region === r ? "bg-accent text-white shadow-lg" : "bg-surface text-muted shadow-[var(--shadow)]"}`}
            >
              {r === "Saved" ? `♥ Saved (${savedCodes.size})` : r}
            </button>
          ))}
        </div>
        {pricesOn && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {[0, 100, 200, 300, 500].map((b) => (
              <button key={b} onClick={() => setBudget(b)} className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium ${budget === b ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
                {b ? `Under £${b}` : "Any budget"}
              </button>
            ))}
            <button onClick={() => setDirectOnly((v) => !v)} className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium ${directOnly ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}>
              Direct only
            </button>
          </div>
        )}
      </div>

      {/* Next weekend */}
      <section>
        <SectionHeader title="Next weekend" />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {weekendPicks.map((d) => (
            <button
              key={d.code}
              onClick={() => {
                setOut(nextFriday());
                setOneWay(false);
                setNights(2);
                setSelected(d.code);
              }}
              className="flex w-64 shrink-0 overflow-hidden rounded-[1.6rem] bg-surface text-left shadow-[var(--shadow)] transition-transform active:scale-[0.98]"
            >
              <span className="flex-1 p-4">
                <span className="block text-lg font-bold">{d.city.split(" (")[0]}</span>
                <span className="block text-sm text-muted">{prices[d.code] ? `From £${Math.round(prices[d.code].price)}` : "Fri – Sun"}</span>
              </span>
              <span className="grid w-24 place-items-center text-4xl" style={{ background: `linear-gradient(160deg, ${regionColor[d.region]}33, ${regionColor[d.region]}88)` }}>
                {d.flag}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Cheapest getaways */}
      <section>
        <SectionHeader title={pricesOn ? "Cheapest getaways" : "Getaways"} />
        {list.length === 0 && <p className="card p-5 text-sm text-muted">Nothing saved yet — tap ♥ on a destination.</p>}
        <ul className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          {getaways.map((d, i) => (
            <li key={d.code} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <button onClick={() => setSelected(d.code)} className={`block w-full text-left transition-transform active:scale-[0.97] ${selected === d.code ? "scale-[0.98]" : ""}`}>
                <span
                  className="relative grid h-32 place-items-center overflow-hidden rounded-[1.4rem] text-5xl shadow-[var(--shadow)]"
                  style={{ background: `radial-gradient(120% 90% at 20% 10%, ${regionColor[d.region]}55, transparent 60%), linear-gradient(160deg, ${regionColor[d.region]}cc, ${regionColor[d.region]})` }}
                >
                  <span className="drop-shadow-lg">{d.flag}</span>
                  <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">{d.code}</span>
                  {savedCodes.has(d.code) && <Heart size={16} className="absolute right-3 top-3 fill-white text-white" />}
                </span>
                <span className="mt-2 block truncate px-1 font-bold">{d.city}</span>
                <span className="block px-1 text-sm text-muted">{prices[d.code] ? `Flights from £${Math.round(prices[d.code].price)}${prices[d.code].direct ? " · direct" : ""}` : d.country}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-faint">
        {pricesOn
          ? "Prices are the cheapest return fares people found in the last few days (Aviasales) — tap a destination to see dates and book. Prices can change."
          : "In-app prices switch on once the free Travelpayouts key is added — until then each destination opens live searches with your dates filled in."}
      </p>

      <Sheet open={!!sel} title={sel ? `${sel.flag} ${sel.city}` : ""} onClose={() => setSelected(null)}>
        {sel && <DestinationDetail d={sel} from={from} out={out} back={back} adults={adults} saved={savedCodes.has(sel.code)} onSavedChange={saved.reload} />}
      </Sheet>
    </div>
  );
}

function DestinationDetail({ d, from, out, back, adults, saved, onSavedChange }: { d: Destination; from: string; out: string; back: string | null; adults: number; saved: boolean; onSavedChange: () => void }) {
  const { user } = useAuth();
  const place = useMemo(() => ({ name: d.city, lat: d.lat, lon: d.lon }), [d]);
  const { data: wx } = useWeather(place);
  const links = searchLinks(from, d, out, back, adults);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleSave = async () => {
    const supabase = createClient();
    const msg = saved ? await run(() => supabase.from("saved_destinations").delete().eq("code", d.code)) : await run(() => supabase.from("saved_destinations").insert({ code: d.code }));
    setError(msg);
    onSavedChange();
  };

  const addTrip = async () => {
    setBusy(true);
    const supabase = createClient();
    const rows = [{ title: `✈️ ${from} → ${d.city}`, event_date: out, kind: "travel" as const, notes: `Trip to ${d.city}` }];
    if (back) rows.push({ title: `✈️ ${d.city} → ${from} (home)`, event_date: back, kind: "travel" as const, notes: `Return from ${d.city}` });
    const msg = await run(() => supabase.from("calendar_events").insert(rows));
    setBusy(false);
    setError(msg);
    if (!msg) setAdded(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {d.country} · {from} → {d.code} · {new Date(out).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        {back ? ` – ${new Date(back).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : " (one way)"} · {adults} adult{adults > 1 ? "s" : ""}
      </p>

      {wx && (
        <div className="rounded-2xl bg-surface-2/70 p-3">
          <div className="flex items-center gap-3">
            <WeatherIcon code={wx.current.code} isDay={wx.current.isDay} size={36} />
            <div className="flex-1">
              <p className="font-display text-2xl font-semibold">{Math.round(wx.current.temp)}°</p>
              <p className="text-xs text-muted">Right now · {describe(wx.current.code).label}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {wx.daily.map((day) => (
              <div key={day.date} className="flex min-w-11 flex-1 flex-col items-center gap-0.5 text-[0.68rem]">
                <span className="text-faint">{new Date(day.date).toLocaleDateString("en-GB", { weekday: "short" })}</span>
                <WeatherIcon code={day.code} size={16} />
                <span className="font-semibold">{Math.round(day.max)}°</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[0.65rem] text-faint">7-day forecast (Open-Meteo)</p>
        </div>
      )}

      <FlightPrices from={from} to={d.code} out={out} back={back} adults={adults} />

      <p className="text-xs font-semibold uppercase tracking-wider text-faint">Book or compare</p>
      <div className="grid grid-cols-2 gap-2">
        <a className="btn btn-primary col-span-2" href={links.skyscanner} target="_blank" rel="noopener noreferrer">
          <PlaneTakeoff size={16} /> Flights on Skyscanner <ExternalLink size={13} />
        </a>
        <a className="btn btn-ghost" href={links.google} target="_blank" rel="noopener noreferrer">
          <Search size={16} /> Google Flights
        </a>
        <a className="btn btn-ghost" href={links.hotels} target="_blank" rel="noopener noreferrer">
          <BedDouble size={16} /> Hotels
        </a>
        <a className="btn btn-ghost" href={links.holidays} target="_blank" rel="noopener noreferrer">
          <Luggage size={16} /> Package holidays
        </a>
        {user && (
          <button className="btn btn-ghost" onClick={toggleSave}>
            <Heart size={16} className={saved ? "fill-accent text-accent" : ""} /> {saved ? "Saved" : "Save"}
          </button>
        )}
        {user && (
          <button className="btn btn-ghost col-span-2" onClick={addTrip} disabled={busy || added}>
            {added ? <Check size={16} /> : <CalendarPlus size={16} />} {added ? "Added to your calendar" : "Booked it? Add trip to calendar"}
          </button>
        )}
      </div>
      {error && <ErrorNote message={error} />}
    </div>
  );
}

type Fare = { price: number; airline: string; flightNumber: string; departAt: string; returnAt: string | null; stops: number; returnStops: number | null; minutes: number | null; link: string | null };

/** Cheapest recent fares, shown right here in the app */
function FlightPrices({ from, to, out, back, adults }: { from: string; to: string; out: string; back: string | null; adults: number }) {
  const [state, setState] = useState<{ loading: boolean; configured?: boolean; flights: Fare[]; error?: string; month?: boolean }>({ loading: true, flights: [] });
  useEffect(() => {
    let alive = true;
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/flights`;
    const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" };
    const get = (depart: string, ret: string | null) =>
      fetch(`${base}?${new URLSearchParams({ from, to, depart, ...(ret ? { return: ret } : {}) })}`, { headers }).then((r) => r.json());
    (async () => {
      setState({ loading: true, flights: [] });
      try {
        let j = await get(out, back);
        let month = false;
        // Nothing for those exact dates? Show the cheapest that month instead
        if (j.configured && !j.flights?.length && !j.error) {
          j = await get(out.slice(0, 7), back ? back.slice(0, 7) : null);
          month = true;
        }
        if (alive) setState({ loading: false, configured: j.configured, flights: j.flights ?? [], error: j.error, month });
      } catch {
        if (alive) setState({ loading: false, flights: [], error: "Couldn't load prices" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [from, to, out, back]);

  if (state.loading) return <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />;
  if (state.configured === false)
    return <p className="rounded-2xl bg-surface-2 p-3 text-xs text-muted">Live flight prices inside the app switch on once the free Travelpayouts key is added. Until then, use the buttons below.</p>;
  if (state.error) return <p className="rounded-2xl bg-surface-2 p-3 text-xs text-muted">{state.error}</p>;
  if (!state.flights.length) return <p className="rounded-2xl bg-surface-2 p-3 text-xs text-muted">No recent fares found for this route — try another month or airport.</p>;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return (
    <div>
      <p className="mb-2 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-faint">
        <span>Cheapest fares{state.month ? " this month" : ""}</span>
        <span className="normal-case tracking-normal">per person</span>
      </p>
      <ul className="stagger space-y-2">
        {state.flights.slice(0, 6).map((f, i) => (
          <li key={i} style={{ "--i": i } as React.CSSProperties}>
            <a href={f.link ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition-transform active:scale-[0.98]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-xs font-bold">{f.airline}</span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-semibold">
                  {fmt(f.departAt)} · {time(f.departAt)}
                </span>
                <span className="block text-xs text-muted">
                  {f.stops === 0 ? "Direct" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}
                  {f.minutes ? ` · ${Math.floor(f.minutes / 60)}h ${f.minutes % 60}m` : ""}
                  {f.returnAt ? ` · back ${fmt(f.returnAt)}` : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-display text-lg font-bold text-[var(--c-money)]">£{Math.round(f.price)}</span>
                {adults > 1 && <span className="block text-[10px] text-faint">£{Math.round(f.price * adults)} for {adults}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-faint">Recent prices found by Aviasales users — tap one to check and book. Prices can change.</p>
    </div>
  );
}
