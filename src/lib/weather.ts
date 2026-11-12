"use client";

import { useCallback, useEffect, useState } from "react";
import { readCache, writeCache } from "./cache";

/**
 * Weather from Open-Meteo (free, no API key, non-commercial use).
 * Location: a UK postcode or town you set (postcodes.io / Open-Meteo geocoding),
 * or your device location. Saved on this device.
 */

export type Place = { name: string; lat: number; lon: number };

const KEY = "mlh.place.v1";
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

export function readPlace(): Place | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

export function usePlace() {
  const [place, setPlaceState] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setPlaceState(readPlace());
    setReady(true);
    const onChange = () => setPlaceState(readPlace());
    window.addEventListener("mlh-place", onChange);
    return () => window.removeEventListener("mlh-place", onChange);
  }, []);
  const setPlace = useCallback((p: Place | null) => {
    try {
      if (p) localStorage.setItem(KEY, JSON.stringify(p));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setPlaceState(p);
    window.dispatchEvent(new Event("mlh-place"));
  }, []);
  return { place, setPlace, ready };
}

/** Turn a postcode, outcode or town into coordinates. */
export async function findPlace(query: string): Promise<Place> {
  const q = query.trim();
  if (POSTCODE.test(q)) {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.status !== 200 || !data.result) throw new Error("Postcode not found");
    const r = data.result;
    return { name: r.admin_ward ? `${r.admin_ward}, ${r.postcode}` : r.postcode, lat: r.latitude, lon: r.longitude };
  }
  if (OUTCODE.test(q)) {
    const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.status !== 200 || !data.result) throw new Error("Postcode area not found");
    const r = data.result;
    return { name: `${r.admin_district?.[0] ?? ""} ${r.outcode}`.trim(), lat: r.latitude, lon: r.longitude };
  }
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&countryCode=GB&language=en`);
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) throw new Error("Couldn't find that place");
  return { name: [r.name, r.admin2 ?? r.admin1].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude };
}

/** Device location → nearest place name. */
export function locateMe(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location isn't available on this device"));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        let name = "My location";
        try {
          const res = await fetch(`https://api.postcodes.io/postcodes?lon=${lon}&lat=${lat}&limit=1`);
          const data = await res.json();
          const r = data.result?.[0];
          if (r) name = `${r.admin_ward ?? r.admin_district}, ${r.outcode}`;
        } catch {
          /* keep generic name */
        }
        resolve({ name, lat: Number(lat.toFixed(3)), lon: Number(lon.toFixed(3)) });
      },
      () => reject(new Error("Location permission was denied")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });
}

export type Weather = {
  current: { temp: number; feels: number; code: number; wind: number; isDay: boolean; time: string };
  hourly: { time: string; temp: number; rain: number; code: number; isDay: boolean }[];
  daily: { date: string; max: number; min: number; rain: number; code: number; sunrise: string; sunset: string }[];
};

export function useWeather(place: Place | null) {
  const [data, setData] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!place) return;
    let alive = true;
    const ckey = `wx:${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
    const cached = readCache<Weather>(ckey, 2 * 3600e3);
    if (cached) setData(cached);
    const load = async () => {
      setLoading(true);
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
          `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` +
          `&hourly=temperature_2m,precipitation_probability,weather_code,is_day` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset` +
          `&timezone=Europe%2FLondon&forecast_days=7&wind_speed_unit=mph`;
        const res = await fetch(url);
        const j = await res.json();
        if (!alive) return;
        if (j.error) throw new Error(j.reason);
        const nowIdx = Math.max(0, (j.hourly.time as string[]).findIndex((t) => t >= j.current.time.slice(0, 13)));
        const fresh: Weather = {
          current: {
            temp: j.current.temperature_2m,
            feels: j.current.apparent_temperature,
            code: j.current.weather_code,
            wind: j.current.wind_speed_10m,
            isDay: j.current.is_day === 1,
            time: j.current.time,
          },
          hourly: (j.hourly.time as string[]).slice(nowIdx, nowIdx + 12).map((t, i) => ({
            time: t,
            temp: j.hourly.temperature_2m[nowIdx + i],
            rain: j.hourly.precipitation_probability[nowIdx + i] ?? 0,
            code: j.hourly.weather_code[nowIdx + i],
            isDay: j.hourly.is_day[nowIdx + i] === 1,
          })),
          daily: (j.daily.time as string[]).map((d, i) => ({
            date: d,
            max: j.daily.temperature_2m_max[i],
            min: j.daily.temperature_2m_min[i],
            rain: j.daily.precipitation_probability_max[i] ?? 0,
            code: j.daily.weather_code[i],
            sunrise: j.daily.sunrise[i],
            sunset: j.daily.sunset[i],
          })),
        };
        setData(fresh);
        writeCache(ckey, fresh);
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Couldn't load the weather");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [place]);

  return { data, error, loading };
}

/** WMO weather codes → plain English + icon kind. */
export function describe(code: number): { label: string; kind: "clear" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm" } {
  if (code === 0) return { label: "Clear", kind: "clear" };
  if (code === 1) return { label: "Mostly clear", kind: "partly" };
  if (code === 2) return { label: "Partly cloudy", kind: "partly" };
  if (code === 3) return { label: "Overcast", kind: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", kind: "drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 80 ? "Showers" : code >= 65 ? "Heavy rain" : "Rain", kind: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", kind: "snow" };
  if (code >= 95) return { label: "Thunderstorms", kind: "storm" };
  return { label: "—", kind: "cloud" };
}

/** Save a place for every location-based card (weather, fuel, maps) */
export function savePlace(p: Place) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("mlh-place"));
}

/** If no location is saved and location access is already allowed, fill it in silently. */
export async function autoLocate() {
  if (typeof window === "undefined" || readPlace()) return;
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (status?.state !== "granted") return;
    savePlace(await locateMe());
  } catch {
    /* ignore */
  }
}
