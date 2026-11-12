"use client";

import { Clock, Fuel, MapPin, Navigation, Phone, ShoppingCart, TrendingDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapView, miles } from "@/components/map/MapView";
import { PlacePicker } from "@/components/weather/WeatherWidgets";
import { ErrorNote, Sheet, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { usePlace } from "@/lib/weather";

const FUELS = [
  { id: "E10", label: "Unleaded", sub: "E10" },
  { id: "B7_Standard", label: "Diesel", sub: "B7" },
  { id: "E5", label: "Super unleaded", sub: "E5" },
  { id: "B7_Premium", label: "Premium diesel", sub: "" },
] as const;
type FuelId = (typeof FUELS)[number]["id"];

type Station = {
  node_id: string;
  name: string;
  brand: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  lat: number;
  lon: number;
  is_motorway: boolean;
  is_supermarket: boolean;
  amenities: string[];
  opening_times: { usual_days?: Record<string, { open?: string; close?: string; is_24_hours?: boolean }> } | null;
  phone: string | null;
  price: number;
  price_last_updated: string | null;
  distance_km: number;
};

const FUEL_KEY = "mylife.fuel.type";
const p = (n: number) => `${Number(n).toFixed(1)}p`;

function ago(iso: string | null) {
  if (!iso) return "time unknown";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} hr${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

function todayHours(s: Station) {
  const day = new Date().toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase();
  const t = s.opening_times?.usual_days?.[day];
  if (!t) return null;
  if (t.is_24_hours) return "Open 24 hours today";
  if (t.open && t.close) return `Today ${t.open.slice(0, 5)}–${t.close.slice(0, 5)}`;
  return null;
}

export function FuelView() {
  const { place, ready } = usePlace();
  const [fuel, setFuel] = useState<FuelId>("E10");
  const [radius, setRadius] = useState(16);
  const [sort, setSort] = useState<"cheapest" | "nearest">("cheapest");
  const [rows, setRows] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [synced, setSynced] = useState<string | null>(null);

  useEffect(() => {
    try {
      const f = localStorage.getItem(FUEL_KEY) as FuelId | null;
      if (f && FUELS.some((x) => x.id === f)) setFuel(f);
    } catch {}
  }, []);

  useEffect(() => {
    if (!place) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setSelected(null);
    const supabase = createClient();
    Promise.all([
      supabase.rpc("nearby_fuel", { p_lat: place.lat, p_lon: place.lon, p_radius_km: radius, p_fuel: fuel }),
      supabase.from("fuel_prices").select("synced_at").order("synced_at", { ascending: false }).limit(1),
    ])
      .then(([res, last]) => {
        if (!alive) return;
        if (res.error) setError(res.error.message);
        setRows(((res.data as Station[]) ?? []).filter((s) => s.distance_km <= radius));
        setSynced(last.data?.[0]?.synced_at ?? null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [place, fuel, radius]);

  const list = useMemo(() => [...rows].sort((a, b) => (sort === "cheapest" ? a.price - b.price || a.distance_km - b.distance_km : a.distance_km - b.distance_km)), [rows, sort]);
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const prices = rows.map((r) => Number(r.price)).sort((a, b) => a - b);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { low: prices[0], high: prices[prices.length - 1], avg, cheapest: rows.reduce((a, b) => (b.price < a.price ? b : a)) };
  }, [rows]);
  const sel = list.find((s) => s.node_id === selected) ?? null;

  const pickFuel = (f: FuelId) => {
    setFuel(f);
    try {
      localStorage.setItem(FUEL_KEY, f);
    } catch {}
  };

  if (!ready) return null;
  if (!place || changing)
    return (
      <div className="card mx-auto max-w-md p-6">
        <h2 className="mb-1 font-display text-lg font-semibold">Where are you filling up?</h2>
        <PlacePicker />
        {changing && (
          <button onClick={() => setChanging(false)} className="btn btn-ghost mt-3">
            Cancel
          </button>
        )}
      </div>
    );

  const colorFor = (price: number) => {
    if (!stats || stats.high === stats.low) return "#22c55e";
    const t = (price - stats.low) / (stats.high - stats.low);
    return t < 0.25 ? "#16a34a" : t < 0.6 ? "#f59e0b" : "#ef4444";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setChanging(true)} className="chip min-h-9 px-3!">
          <MapPin size={13} /> {place.name}
        </button>
        <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="chip min-h-9 cursor-pointer px-3! outline-none" aria-label="Distance">
          <option value={3}>Within 2 miles</option>
          <option value={8}>Within 5 miles</option>
          <option value={16}>Within 10 miles</option>
          <option value={32}>Within 20 miles</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "cheapest" | "nearest")} className="chip min-h-9 cursor-pointer px-3! outline-none" aria-label="Sort">
          <option value="cheapest">Cheapest first</option>
          <option value="nearest">Nearest first</option>
        </select>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FUELS.map((f) => (
          <button
            key={f.id}
            onClick={() => pickFuel(f.id)}
            aria-pressed={fuel === f.id}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${fuel === f.id ? "bg-accent text-white" : "card text-muted hover:text-ink"}`}
          >
            <Fuel size={15} /> {f.label}
            {f.sub && <span className="text-xs opacity-70">{f.sub}</span>}
          </button>
        ))}
      </div>

      {error && <ErrorNote message={error} />}

      {stats && (
        <div className="stagger grid grid-cols-3 gap-2">
          <button onClick={() => setSelected(stats.cheapest.node_id)} className="card card-interactive p-3 text-left" style={{ "--i": 0 } as React.CSSProperties}>
            <span className="flex items-center gap-1 text-xs text-muted">
              <TrendingDown size={12} /> Cheapest
            </span>
            <span className="block font-display text-xl font-semibold tabular-nums text-emerald-500">{p(stats.low)}</span>
            <span className="block truncate text-xs text-faint">{stats.cheapest.brand ?? stats.cheapest.name}</span>
          </button>
          <div className="card p-3" style={{ "--i": 1 } as React.CSSProperties}>
            <span className="text-xs text-muted">Average</span>
            <span className="block font-display text-xl font-semibold tabular-nums">{p(stats.avg)}</span>
            <span className="block text-xs text-faint">{rows.length} stations</span>
          </div>
          <div className="card p-3" style={{ "--i": 2 } as React.CSSProperties}>
            <span className="text-xs text-muted">Save on 50L</span>
            <span className="block font-display text-xl font-semibold tabular-nums">£{(((stats.avg - stats.low) * 50) / 100).toFixed(2)}</span>
            <span className="block text-xs text-faint">vs average</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <MapView
          live
          className="h-[42dvh] min-h-72 lg:h-[calc(100dvh-20rem)]"
          center={place}
          zoom={radius > 16 ? 11 : radius > 8 ? 12 : 13}
          me={place}
          selectedId={selected}
          onSelect={setSelected}
          points={list.slice(0, 80).map((s) => ({ id: s.node_id, lat: s.lat, lon: s.lon, color: colorFor(s.price), label: s.name, badge: Number(s.price).toFixed(1) }))}
        />
        <div className="lg:h-[calc(100dvh-20rem)] lg:overflow-y-auto">
          {loading ? (
            <Spinner label="Checking pumps" />
          ) : list.length === 0 ? (
            <p className="card p-6 text-sm text-muted">
              {synced ? "No stations with this fuel nearby. Try a bigger distance." : "Fuel prices are still loading for the first time — check back in a few minutes."}
            </p>
          ) : (
            <ul className="stagger space-y-2">
              {list.slice(0, 60).map((s, i) => (
                <li key={s.node_id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                  <button
                    onClick={() => setSelected(s.node_id)}
                    className={`card card-interactive flex w-full items-center gap-3 p-3 text-left ${selected === s.node_id ? "ring-2 ring-accent" : ""}`}
                  >
                    <span className="grid min-w-16 shrink-0 place-items-center rounded-xl px-2 py-1.5 font-display text-base font-semibold tabular-nums text-white" style={{ background: colorFor(s.price) }}>
                      {p(s.price)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        {s.brand ?? s.name}
                        {s.is_supermarket && <ShoppingCart size={12} className="shrink-0 text-faint" />}
                      </span>
                      <span className="block truncate text-xs text-muted">{[s.address, s.city].filter(Boolean).join(", ")}</span>
                      <span className="block text-[11px] text-faint">Updated {ago(s.price_last_updated)}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-faint">{miles(s.distance_km)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-faint">
        Prices from retailers&apos; own open price feeds — Asda, Esso/Tesco Alliance, SGN, JET and Moto (about 1,150 stations). Full coverage of every UK station will switch on
        automatically once the government Fuel Finder service accepts our connection. Refreshed hourly
        {synced ? ` — last refreshed ${ago(synced)}` : ""}. Always check the price at the pump.
      </p>

      <Sheet open={!!sel} title={sel ? (sel.brand ?? sel.name) : ""} onClose={() => setSelected(null)}>
        {sel && (
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-muted">{FUELS.find((f) => f.id === fuel)?.label}</p>
                <p className="font-display text-4xl font-semibold tabular-nums" style={{ color: colorFor(sel.price) }}>
                  {p(sel.price)}
                </p>
              </div>
              <p className="text-right text-xs text-faint">
                {miles(sel.distance_km)} away
                <br />
                Updated {ago(sel.price_last_updated)}
              </p>
            </div>
            {stats && sel.price > stats.low && (
              <p className="text-sm text-muted">
                {p(sel.price - stats.low)} more per litre than the cheapest nearby — £{(((sel.price - stats.low) * 50) / 100).toFixed(2)} on a 50-litre fill.
              </p>
            )}
            <p className="flex items-start gap-2 text-sm">
              <MapPin size={16} className="mt-0.5 shrink-0 text-faint" /> {[sel.name !== sel.brand ? sel.name : null, sel.address, sel.city, sel.postcode].filter(Boolean).join(", ")}
            </p>
            {todayHours(sel) && (
              <p className="flex items-start gap-2 text-sm">
                <Clock size={16} className="mt-0.5 shrink-0 text-faint" /> {todayHours(sel)}
              </p>
            )}
            {sel.amenities?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sel.amenities.slice(0, 10).map((a) => (
                  <span key={a} className="chip text-xs capitalize">
                    {a.replace(/_/g, " ").toLowerCase()}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <a className="btn btn-primary" href={`https://maps.apple.com/?daddr=${sel.lat},${sel.lon}&q=${encodeURIComponent(sel.brand ?? sel.name)}`} target="_blank" rel="noopener noreferrer">
                <Navigation size={16} /> Directions
              </a>
              {sel.phone ? (
                <a className="btn btn-ghost" href={`tel:${sel.phone.replace(/\s/g, "")}`}>
                  <Phone size={16} /> Call
                </a>
              ) : (
                <a className="btn btn-ghost" href={`https://www.google.com/maps/search/?api=1&query=${sel.lat},${sel.lon}`} target="_blank" rel="noopener noreferrer">
                  <MapPin size={16} /> Google Maps
                </a>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
