"use client";

import { Bookmark, Fuel, Navigation, Plane } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView, distanceKm, miles, type MapPoint } from "@/components/map/MapView";
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

  useEffect(() => {
    if (place) setFocus(place);
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
    return out;
  }, [layers, stations, saved.rows, fuelColor]);

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
        />
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
            <a className="btn btn-primary w-full" href={`https://maps.apple.com/?daddr=${sel.s.lat},${sel.s.lon}`} target="_blank" rel="noopener noreferrer">
              <Navigation size={16} /> Directions
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
            <a className="btn btn-primary w-full" href={`https://maps.apple.com/?daddr=${sel.p.lat},${sel.p.lon}&q=${encodeURIComponent(sel.p.name)}`} target="_blank" rel="noopener noreferrer">
              <Navigation size={16} /> Directions
            </a>
          </div>
        )}
      </Sheet>
    </div>
  );
}
