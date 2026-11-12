"use client";

import { ArrowUpDown, Bookmark, Clock, Fuel, LocateFixed, MapPin, Navigation, Plane, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView, distanceKm, googleDirections, miles, type MapPoint } from "@/components/map/MapView";
import { Sheet } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { DESTINATIONS } from "@/lib/travel";
import { useRows } from "@/lib/useRows";
import { usePlace } from "@/lib/weather";

type Layer = "fuel" | "holidays" | "saved";
const LAYERS: { id: Layer; label: string; icon: typeof Fuel; color: string }[] = [
  { id: "fuel", label: "Fuel prices", icon: Fuel, color: "#16a34a" },
  { id: "holidays", label: "Holidays abroad", icon: Plane, color: "#0ea5e9" },
  { id: "saved", label: "Saved places", icon: Bookmark, color: "#f97316" },
];
const FUELS = [
  { id: "E10", label: "Unleaded" },
  { id: "B7_Standard", label: "Diesel" },
  { id: "E5", label: "Super" },
] as const;

type Station = { node_id: string; name: string; brand: string | null; address: string | null; postcode: string | null; lat: number; lon: number; price: number; price_last_updated: string | null };
type Saved = { id: string; osm_id: string; name: string; category: string; lat: number; lon: number; address: string | null };
type Sel = { kind: "fuel"; s: Station } | { kind: "holiday"; d: (typeof DESTINATIONS)[number] } | { kind: "saved"; p: Saved };

const UK = { lat: 52.6, lon: -1.6 };

type Trip = { dest: { name: string; address: string; lat: number; lon: number }; start: { name: string; address: string; lat: number; lon: number } | null; minutes: number | null; miles: number; line: [number, number][] | null; note?: string };

/** Best guess at where you are right now: live GPS (quick), else your saved location */
export function currentPosition(fallback: { lat: number; lon: number } | null): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(fallback);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(fallback),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  });
}

export function MapHub() {
  const { place } = usePlace();
  const { user } = useAuth();
  const [layers, setLayers] = useState<Set<Layer>>(new Set(["fuel"]));
  const [fuel, setFuel] = useState<(typeof FUELS)[number]["id"]>("E10");
  const [view, setView] = useState<{ lat: number; lon: number; radiusKm: number; zoom: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number }>(place ?? UK);
  const [zoom, setZoom] = useState(place ? 12 : 6);
  const saved = useRows<Saved>("saved_places", [{ column: "created_at", ascending: false }], Boolean(user) && layers.has("saved"));
  const seq = useRef(0);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tripBusy, setTripBusy] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [whereTo, setWhereTo] = useState("");
  const [fromText, setFromText] = useState("");
  const [fromCurrent, setFromCurrent] = useState(true);

  const go = useCallback(
    async (params: Record<string, string>) => {
      setTripBusy(true);
      setTripError(null);
      // A typed start point doesn't need your location (UK centre is only used to bias the search)
      const pos = params.from ? (me ?? place ?? UK) : await currentPosition(me ?? place ?? null);
      if (!pos) {
        setTripBusy(false);
        return setTripError("I need your location — allow location access or set it on the weather card.");
      }
      const qs = new URLSearchParams({ lat: String(pos.lat), lon: String(pos.lon), ...params });
      try {
        const r = await fetch(`/api/route?${qs}`);
        const j = await r.json();
        if (j.error) setTripError(j.error);
        else {
          setTrip(j as Trip);
          setSelected(null);
        }
      } catch {
        setTripError("Couldn't plan the route — check your signal.");
      }
      setTripBusy(false);
    },
    [me, place],
  );

  // Opened from the assistant: /map?go=tesco%20extra
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("go");
    const f = sp.get("from");
    if (q) {
      setWhereTo(q);
      if (f) {
        setFromCurrent(false);
        setFromText(f);
      }
      go(f ? { q, from: f } : { q });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When your saved location loads, centre on it at street level (unless a route or holidays view is showing)
  useEffect(() => {
    if (!place) return;
    setFocus(place);
    setZoom((z) => (z < 10 ? 13 : z));
  }, [place]);

  useEffect(() => {
    try {
      const f = localStorage.getItem("mylife.fuel.type");
      if (f && FUELS.some((x) => x.id === f)) setFuel(f as typeof fuel);
    } catch {}
  }, []);

  // Load fuel prices for whatever area is on screen (only when zoomed in enough to be useful)
  useEffect(() => {
    if (!layers.has("fuel") || !view || view.zoom < 10) return setStations([]);
    const n = ++seq.current;
    createClient()
      .rpc("nearby_fuel", { p_lat: view.lat, p_lon: view.lon, p_radius_km: Math.min(view.radiusKm, 40), p_fuel: fuel })
      .then(({ data }) => n === seq.current && setStations((data as Station[]) ?? []));
  }, [layers, view, fuel]);

  const toggle = (l: Layer) => {
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });
    if (l === "holidays" && !layers.has("holidays")) {
      setFocus({ lat: 44, lon: 3 });
      setZoom(4);
    }
  };

  const range = useMemo(() => {
    const p = stations.map((s) => Number(s.price)).sort((a, b) => a - b);
    return p.length ? { low: p[0], high: p[p.length - 1] } : null;
  }, [stations]);
  const fuelColor = useCallback(
    (price: number) => {
      if (!range || range.high === range.low) return "#16a34a";
      const t = (price - range.low) / (range.high - range.low);
      return t < 0.25 ? "#16a34a" : t < 0.6 ? "#f59e0b" : "#ef4444";
    },
    [range],
  );

  const points: MapPoint[] = useMemo(() => {
    const out: MapPoint[] = [];
    if (layers.has("fuel")) out.push(...stations.slice(0, 120).map((s) => ({ id: `f:${s.node_id}`, lat: s.lat, lon: s.lon, color: fuelColor(s.price), label: s.brand ?? s.name, badge: Number(s.price).toFixed(1) })));
    if (layers.has("holidays")) out.push(...DESTINATIONS.map((d) => ({ id: `h:${d.code}`, lat: d.lat, lon: d.lon, color: "#0ea5e9", label: d.city, badge: d.code })));
    if (layers.has("saved")) out.push(...saved.rows.map((p) => ({ id: `s:${p.id}`, lat: p.lat, lon: p.lon, color: "#f97316", label: p.name })));
    if (trip?.start) out.push({ id: "t:start", lat: trip.start.lat, lon: trip.start.lon, color: "#22c55e", label: trip.start.name, badge: "A" });
    if (trip) out.push({ id: "t:dest", lat: trip.dest.lat, lon: trip.dest.lon, color: "#ef4444", label: trip.dest.name, badge: "🏁" });
    return out;
  }, [layers, stations, saved.rows, fuelColor, trip]);

  const sel: Sel | null = useMemo(() => {
    if (!selected) return null;
    const [k, id] = [selected.slice(0, 1), selected.slice(2)];
    if (k === "f") {
      const s = stations.find((x) => x.node_id === id);
      return s ? { kind: "fuel", s } : null;
    }
    if (k === "h") {
      const d = DESTINATIONS.find((x) => x.code === id);
      return d ? { kind: "holiday", d } : null;
    }
    const p = saved.rows.find((x) => x.id === id);
    return p ? { kind: "saved", p } : null;
  }, [selected, stations, saved.rows]);

  const from = me ?? place ?? null;
  const cheapest = range && stations.length ? stations.reduce((a, b) => (b.price < a.price ? b : a)) : null;

  return (
    <div className="space-y-3">
      <form
        className="card space-y-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!whereTo.trim()) return;
          go(fromCurrent || !fromText.trim() ? { q: whereTo.trim() } : { q: whereTo.trim(), from: fromText.trim() });
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex flex-1 flex-col gap-2">
            {/* From */}
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
              <span className="w-9 shrink-0 text-xs font-semibold text-faint">From</span>
              {fromCurrent ? (
                <button
                  type="button"
                  onClick={() => setFromCurrent(false)}
                  className="flex flex-1 items-center gap-1.5 text-left text-base font-medium text-accent"
                  aria-label="Change start: currently your location"
                >
                  <LocateFixed size={16} /> Current location
                </button>
              ) : (
                <>
                  <input
                    autoFocus
                    value={fromText}
                    onChange={(e) => setFromText(e.target.value)}
                    placeholder="Start — place or postcode"
                    className="w-full bg-transparent text-base outline-none"
                    aria-label="From"
                  />
                  <button
                    type="button"
                    onClick={() => (setFromCurrent(true), setFromText(""))}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
                  >
                    <LocateFixed size={13} /> Current
                  </button>
                </>
              )}
            </label>
            {/* To */}
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
              <span className="w-9 shrink-0 text-xs font-semibold text-faint">To</span>
              <MapPin size={16} className="shrink-0 text-red-400" />
              <input
                value={whereTo}
                onChange={(e) => setWhereTo(e.target.value)}
                placeholder="Tesco Extra, B90 4RT, Villa Park…"
                enterKeyHint="go"
                className="w-full bg-transparent text-base outline-none"
                aria-label="To"
              />
            </label>
          </div>
          <button
            type="button"
            aria-label="Swap start and destination"
            disabled={fromCurrent && !whereTo}
            onClick={() => {
              if (fromCurrent) {
                setFromText(whereTo);
                setWhereTo("");
                setFromCurrent(false);
              } else {
                const f = fromText;
                setFromText(whereTo);
                setWhereTo(f);
              }
            }}
            className="grid size-10 shrink-0 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            <ArrowUpDown size={18} />
          </button>
        </div>
        <button className="btn btn-primary w-full" disabled={tripBusy || !whereTo.trim() || (!fromCurrent && !fromText.trim())}>
          <Navigation size={16} /> {tripBusy ? "Planning route…" : "Get directions"}
        </button>
      </form>
      {tripError && <p className="text-sm text-red-400">{tripError}</p>}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {LAYERS.filter((l) => l.id !== "saved" || user).map((l) => {
          const Icon = l.icon;
          const on = layers.has(l.id);
          return (
            <button
              key={l.id}
              onClick={() => toggle(l.id)}
              aria-pressed={on}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${on ? "text-white" : "card text-muted hover:text-ink"}`}
              style={on ? { background: l.color } : undefined}
            >
              <Icon size={15} /> {l.label}
            </button>
          );
        })}
        {layers.has("fuel") &&
          FUELS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFuel(f.id)}
              aria-pressed={fuel === f.id}
              className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-semibold ${fuel === f.id ? "bg-ink text-bg" : "card text-muted"}`}
            >
              {f.label}
            </button>
          ))}
      </div>

      <div className="relative">
        <MapView
          live
          className="h-[calc(100dvh-15rem)] min-h-96 lg:h-[calc(100dvh-12rem)]"
          center={focus}
          zoom={zoom}
          me={me ? null : place}
          selectedId={selected}
          onSelect={setSelected}
          onView={setView}
          onLocation={setMe}
          points={points}
          route={trip?.line ?? null}
        />
        {trip && (
          <div className="absolute inset-x-3 top-3 z-[500] mr-14 rounded-2xl bg-bg-elevated/95 p-3 shadow-xl backdrop-blur sm:right-auto sm:w-96">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {trip.start && <p className="truncate text-xs text-muted">From {trip.start.name}</p>}
                <p className="truncate font-semibold">{trip.dest.name}</p>
                <p className="truncate text-xs text-muted">{trip.dest.address}</p>
              </div>
              <button aria-label="Clear route" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:text-ink" onClick={() => (setTrip(null), setWhereTo(""), setFromCurrent(true), setFromText(""))}>
                <X size={16} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <p className="flex items-baseline gap-1.5">
                <Clock size={15} className="self-center text-accent" />
                <span className="font-display text-2xl font-semibold">{trip.minutes != null ? (trip.minutes >= 60 ? `${Math.floor(trip.minutes / 60)} hr ${trip.minutes % 60} min` : `${trip.minutes} min`) : "—"}</span>
                <span className="text-sm text-muted">{trip.miles} mi</span>
              </p>
              <a
                className="btn btn-primary ml-auto h-10! min-h-0!"
                href={googleDirections(trip.dest, trip.start)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation size={15} /> Start in Google Maps
              </a>
            </div>
            {trip.note && <p className="mt-1 text-xs text-faint">{trip.note}</p>}
            {trip.minutes != null && <p className="mt-1 text-[11px] text-faint">Typical drive time without live traffic · tap ◎ to follow yourself</p>}
          </div>
        )}
        {layers.has("fuel") && view && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[70%]">
            {view.zoom < 10 ? (
              <p className="rounded-xl bg-bg-elevated/95 px-3 py-2 text-xs shadow-lg">Zoom in to see fuel prices</p>
            ) : cheapest ? (
              <button onClick={() => setSelected(`f:${cheapest.node_id}`)} className="pointer-events-auto rounded-xl bg-bg-elevated/95 px-3 py-2 text-left text-xs shadow-lg">
                <span className="text-muted">Cheapest on screen </span>
                <span className="font-display text-sm font-semibold text-emerald-500">{Number(cheapest.price).toFixed(1)}p</span>
                <span className="block truncate text-faint">{cheapest.brand ?? cheapest.name}</span>
              </button>
            ) : (
              <p className="rounded-xl bg-bg-elevated/95 px-3 py-2 text-xs shadow-lg">No prices in this area yet</p>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-faint">
        Tap <strong>◎</strong> for sat-nav mode: the map follows you with an arrow showing your direction. Drag the map to look around. Fuel prices come from retailers&apos; open price
        feeds (Asda, Esso/Tesco Alliance, SGN, JET, Moto) — always check the pump.
      </p>

      <Sheet open={!!sel} title={sel?.kind === "fuel" ? (sel.s.brand ?? sel.s.name) : sel?.kind === "holiday" ? `${sel.d.flag} ${sel.d.city}` : sel?.kind === "saved" ? sel.p.name : ""} onClose={() => setSelected(null)}>
        {sel?.kind === "fuel" && (
          <div className="space-y-3">
            <p className="font-display text-4xl font-semibold tabular-nums" style={{ color: fuelColor(sel.s.price) }}>
              {Number(sel.s.price).toFixed(1)}p <span className="text-base font-medium text-muted">{FUELS.find((f) => f.id === fuel)?.label}</span>
            </p>
            <p className="text-sm text-muted">
              {[sel.s.address, sel.s.postcode].filter(Boolean).join(", ")}
              {from ? ` · ${miles(distanceKm(from, sel.s))} away` : ""}
            </p>
            <a className="btn btn-primary w-full" href={googleDirections(sel.s)} target="_blank" rel="noopener noreferrer">
              <Navigation size={16} /> Google Maps
            </a>
          </div>
        )}
        {sel?.kind === "holiday" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {sel.d.country} · airport {sel.d.code}
              {from ? ` · ${Math.round(distanceKm(from, sel.d) * 0.621371).toLocaleString("en-GB")} miles away` : ""}
            </p>
            <Link href="/travel" className="btn btn-primary w-full">
              <Plane size={16} /> Flights, hotels & weather
            </Link>
          </div>
        )}
        {sel?.kind === "saved" && (
          <div className="space-y-3">
            <p className="text-sm capitalize text-muted">
              {sel.p.category}
              {sel.p.address ? ` · ${sel.p.address}` : ""}
              {from ? ` · ${miles(distanceKm(from, sel.p))} away` : ""}
            </p>
            <a className="btn btn-primary w-full" href={googleDirections(sel.p)} target="_blank" rel="noopener noreferrer">
              <Navigation size={16} /> Google Maps
            </a>
          </div>
        )}
      </Sheet>
    </div>
  );
}
