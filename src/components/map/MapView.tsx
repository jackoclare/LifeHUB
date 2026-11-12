"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup, TileLayer } from "leaflet";

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
}: {
  points: MapPoint[];
  center: { lat: number; lon: number };
  zoom?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  me?: { lat: number; lon: number } | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const tiles = useRef<TileLayer | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
      setTiles();
      drawPoints();
    })();
    const obs = new MutationObserver(() => setTiles());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelled = true;
      obs.disconnect();
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
      .tileLayer(dark ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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

  return <div ref={el} className={`map-root overflow-hidden rounded-[var(--radius-card)] border border-line ${className}`} />;
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const miles = (km: number) => `${(km * 0.621371).toFixed(km < 1.6 ? 1 : 0)} mi`;
