"use client";

import "leaflet/dist/leaflet.css";
import { LocateFixed, Navigation2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, Marker, TileLayer } from "leaflet";

export type MapPoint = { id: string; lat: number; lon: number; color: string; label: string; badge?: string };

/**
 * Interactive map (Leaflet + OpenStreetMap / CARTO tiles — free, with attribution).
 * Loaded only in the browser.
 */
export function MapView({
  points,
  center,
  zoom = 14,
  selectedId,
  onSelect,
  className = "",
  me,
  live = false,
  onView,
  onLocation,
  route,
}: {
  points: MapPoint[];
  center: { lat: number; lon: number };
  zoom?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  me?: { lat: number; lon: number } | null;
  /** Show the sat-nav style "follow me" button (live GPS position with a direction arrow) */
  live?: boolean;
  /** Called (debounced) when the visible area changes: centre + radius in km */
  onView?: (v: { lat: number; lon: number; radiusKm: number; zoom: number }) => void;
  /** Called with each live GPS fix while following */
  onLocation?: (p: { lat: number; lon: number }) => void;
  /** A driving route to draw ([lat, lon] pairs); the map zooms to fit it */
  route?: [number, number][] | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const tiles = useRef<TileLayer | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const onLocationRef = useRef(onLocation);
  onLocationRef.current = onLocation;
  const [following, setFollowing] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const followRef = useRef(false);
  const watchId = useRef<number | null>(null);
  const navMarker = useRef<Marker | null>(null);
  const lastFix = useRef<{ lat: number; lon: number } | null>(null);
  const heading = useRef(0);
  const routeLayer = useRef<LayerGroup | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;

  // create the map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      // Leaflet is a UMD module: depending on the bundler it arrives as the namespace or as `.default`
      const leaflet = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (cancelled || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lon], zoom);
      leaflet.control.zoom({ position: "bottomright" }).addTo(m);
      map.current = m;
      layer.current = leaflet.layerGroup().addTo(m);
      let t: ReturnType<typeof setTimeout> | undefined;
      const emit = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const c = m.getCenter();
          const ne = m.getBounds().getNorthEast();
          onViewRef.current?.({ lat: c.lat, lon: c.lng, radiusKm: Math.max(1, m.distance(c, ne) / 1000), zoom: m.getZoom() });
        }, 350);
      };
      m.on("moveend", emit);
      // a finger drag means "let me look around" — stop following
      m.on("dragstart", () => {
        if (followRef.current) stopFollow();
      });
      emit();
      setTiles();
      drawPoints();
      drawRoute();
    })();
    const obs = new MutationObserver(() => setTiles());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelled = true;
      obs.disconnect();
      if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTiles() {
    const leaflet = L.current;
    const m = map.current;
    if (!leaflet || !m) return;
    const dark = document.documentElement.dataset.theme !== "light";
    tiles.current?.remove();
    tiles.current = leaflet
      // OpenStreetMap's standard tiles (free, attribution required). Dark mode is a CSS filter on the tile pane.
      .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: dark ? "map-tiles-dark" : "",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
      .addTo(m);
  }

  function drawPoints() {
    const leaflet = L.current;
    const lg = layer.current;
    if (!leaflet || !lg) return;
    lg.clearLayers();
    for (const p of points) {
      const sel = p.id === selectedId;
      const icon = leaflet.divIcon({
        className: "",
        html: `<div class="map-pin${sel ? " is-selected" : ""}" style="--pin:${p.color}">${p.badge ? `<span>${p.badge}</span>` : ""}</div>`,
        iconSize: p.badge ? [44, 26] : [18, 18],
        iconAnchor: p.badge ? [22, 13] : [9, 9],
      });
      leaflet
        .marker([p.lat, p.lon], { icon, title: p.label, zIndexOffset: sel ? 1000 : 0, keyboard: true })
        .on("click", () => onSelectRef.current?.(p.id))
        .addTo(lg);
    }
    if (me) {
      leaflet
        .marker([me.lat, me.lon], { icon: leaflet.divIcon({ className: "", html: '<div class="map-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false })
        .addTo(lg);
    }
  }

  function drawRoute() {
    const leaflet = L.current;
    const m = map.current;
    if (!leaflet || !m) return;
    routeLayer.current?.remove();
    routeLayer.current = null;
    const r = routeRef.current;
    if (!r || r.length < 2) return;
    const g = leaflet.layerGroup().addTo(m);
    leaflet.polyline(r, { color: "#ffffff", weight: 10, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(g);
    leaflet.polyline(r, { color: "#3b82f6", weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(g);
    routeLayer.current = g;
    if (!followRef.current) m.fitBounds(leaflet.latLngBounds(r), { padding: [50, 50] });
  }

  useEffect(() => {
    drawRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    drawPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selectedId, me]);

  useEffect(() => {
    map.current?.setView([center.lat, center.lon], map.current.getZoom() || zoom, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lon]);

  useEffect(() => {
    const p = points.find((x) => x.id === selectedId);
    if (p && map.current) map.current.panTo([p.lat, p.lon], { animate: true });
  }, [selectedId, points]);

  function drawNav(lat: number, lon: number, deg: number, accuracy?: number) {
    const leaflet = L.current;
    const m = map.current;
    if (!leaflet || !m) return;
    const html = `<div class="map-nav" style="--deg:${deg}deg"><span></span></div>`;
    const icon = leaflet.divIcon({ className: "", html, iconSize: [44, 44], iconAnchor: [22, 22] });
    if (!navMarker.current) navMarker.current = leaflet.marker([lat, lon], { icon, interactive: false, zIndexOffset: 2000 }).addTo(m);
    else navMarker.current.setLatLng([lat, lon]).setIcon(icon);
    if (followRef.current) m.setView([lat, lon], Math.max(m.getZoom(), accuracy && accuracy > 200 ? 14 : 16), { animate: true });
  }

  function startFollow() {
    if (!("geolocation" in navigator)) return setGpsError("Location isn't available on this device");
    setGpsError(null);
    followRef.current = true;
    setFollowing(true);
    if (lastFix.current) drawNav(lastFix.current.lat, lastFix.current.lon, heading.current);
    if (watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, heading: h, accuracy } = pos.coords;
        const prev = lastFix.current;
        if (h != null && !Number.isNaN(h)) heading.current = h;
        else if (prev && distanceKm(prev, { lat, lon }) > 0.008) heading.current = bearing(prev, { lat, lon });
        lastFix.current = { lat, lon };
        drawNav(lat, lon, heading.current, accuracy);
        onLocationRef.current?.({ lat, lon });
      },
      (err) => {
        setGpsError(err.code === 1 ? "Allow location for this site to use follow-me" : "Can't get your location right now");
        stopFollow();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  }

  function stopFollow() {
    followRef.current = false;
    setFollowing(false);
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={el} className="map-root absolute inset-0 overflow-hidden rounded-[var(--radius-card)] border border-line" />
      {live && (
        <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
          <button
            onClick={() => (following ? stopFollow() : startFollow())}
            aria-pressed={following}
            aria-label={following ? "Stop following my location" : "Follow my location"}
            className={`pointer-events-auto grid size-12 place-items-center rounded-full shadow-lg transition-colors ${following ? "bg-accent text-white" : "bg-bg-elevated text-ink"}`}
          >
            {following ? <Navigation2 size={22} /> : <LocateFixed size={22} />}
          </button>
          {gpsError && <p className="pointer-events-auto max-w-56 rounded-xl bg-bg-elevated px-3 py-2 text-xs shadow-lg">{gpsError}</p>}
        </div>
      )}
    </div>
  );
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Compass bearing in degrees from a to b */
export function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

export const miles = (km: number) => `${(km * 0.621371).toFixed(km < 1.6 ? 1 : 0)} mi`;
