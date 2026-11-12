"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Loader2, LocateFixed, MapPin, Moon, Sun, Wind } from "lucide-react";
import { useState } from "react";
import { describe, findPlace, locateMe, usePlace, useWeather } from "@/lib/weather";
import { inputClass } from "@/components/ui";

/** Animated weather icon. */
export function WeatherIcon({ code, isDay = true, size = 24 }: { code: number; isDay?: boolean; size?: number }) {
  const { kind } = describe(code);
  const map = {
    clear: isDay ? Sun : Moon,
    partly: isDay ? CloudSun : Cloud,
    cloud: Cloud,
    fog: CloudFog,
    drizzle: CloudDrizzle,
    rain: CloudRain,
    snow: CloudSnow,
    storm: CloudLightning,
  } as const;
  const Icon = map[kind];
  const color =
    kind === "clear" ? (isDay ? "#fbbf24" : "#c4b5fd") : kind === "partly" ? "#fcd34d" : kind === "storm" ? "#a78bfa" : kind === "snow" ? "#e0f2fe" : kind === "rain" || kind === "drizzle" ? "#60a5fa" : "var(--text-muted)";
  const anim = kind === "clear" && isDay ? "wx-spin" : kind === "rain" || kind === "drizzle" || kind === "snow" ? "wx-bob" : kind === "storm" ? "wx-flash" : "wx-drift";
  return <Icon size={size} className={anim} style={{ color }} aria-hidden />;
}

export function PlacePicker({ compact = false }: { compact?: boolean }) {
  const { setPlace } = usePlace();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (fn: () => Promise<import("@/lib/weather").Place>) => {
    setBusy(true);
    setError(null);
    try {
      setPlace(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
    setBusy(false);
  };

  return (
    <div onClick={(e) => e.preventDefault()}>
      {!compact && <p className="mb-2 text-sm text-muted">Where are you? Enter a postcode or town.</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(() => findPlace(q));
        }}
      >
        <input className={`${inputClass} mt-0!`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. B1 1AA or Birmingham" aria-label="Postcode or town" />
        <button type="submit" className="btn btn-primary shrink-0" disabled={busy} aria-label="Set location">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
        </button>
      </form>
      <button type="button" onClick={() => go(locateMe)} className="mt-2 flex min-h-9 items-center gap-1.5 text-xs font-semibold text-accent">
        <LocateFixed size={14} /> Use my current location
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

/** Dashboard weather card body. */
export function WeatherSummary() {
  const { place, ready } = usePlace();
  const { data, error } = useWeather(place);
  const [changing, setChanging] = useState(false);

  if (!ready) return null;
  if (!place || changing)
    return (
      <div>
        <PlacePicker />
        {changing && (
          <button onClick={() => setChanging(false)} className="mt-2 text-xs text-muted">
            Cancel
          </button>
        )}
      </div>
    );
  if (error) return <p className="text-sm text-muted">{error}</p>;
  if (!data) return <div className="h-28 animate-pulse rounded-xl bg-surface-2" />;

  const { current, hourly, daily } = data;
  const today = daily[0];
  return (
    <div>
      <div className="flex items-center gap-4">
        <WeatherIcon code={current.code} isDay={current.isDay} size={52} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-4xl font-semibold tabular-nums leading-none">{Math.round(current.temp)}°</p>
          <p className="mt-1 text-sm text-muted">
            {describe(current.code).label} · feels {Math.round(current.feels)}°
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>
            H {Math.round(today.max)}° · L {Math.round(today.min)}°
          </p>
          <p className="mt-1 flex items-center justify-end gap-1">
            <Droplets size={12} /> {today.rain}%
          </p>
          <p className="mt-1 flex items-center justify-end gap-1">
            <Wind size={12} /> {Math.round(current.wind)} mph
          </p>
        </div>
      </div>
      <div className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1">
        {hourly.slice(0, 8).map((h, i) => (
          <div key={h.time} className="flex min-w-12 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs" style={{ background: i === 0 ? "var(--accent-soft)" : undefined }}>
            <span className="text-faint">{i === 0 ? "Now" : h.time.slice(11, 13)}</span>
            <WeatherIcon code={h.code} isDay={h.isDay} size={18} />
            <span className="font-semibold tabular-nums">{Math.round(h.temp)}°</span>
            {h.rain >= 20 && <span className="text-[0.6rem] text-[#60a5fa]">{h.rain}%</span>}
          </div>
        ))}
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          setChanging(true);
        }}
        className="mt-2 flex items-center gap-1 text-[0.68rem] text-faint hover:text-ink"
      >
        <MapPin size={11} /> {place.name} · change
      </button>
    </div>
  );
}

/** 7-day forecast list. */
export function WeekForecast() {
  const { place } = usePlace();
  const { data } = useWeather(place);
  if (!data) return null;
  const lo = Math.min(...data.daily.map((d) => d.min));
  const hi = Math.max(...data.daily.map((d) => d.max));
  return (
    <ul className="space-y-1">
      {data.daily.map((d, i) => (
        <li key={d.date} className="flex items-center gap-3 py-1.5 text-sm">
          <span className="w-12 font-medium">{i === 0 ? "Today" : new Date(d.date).toLocaleDateString("en-GB", { weekday: "short" })}</span>
          <WeatherIcon code={d.code} size={20} />
          <span className="w-10 text-xs text-[#60a5fa]">{d.rain >= 20 ? `${d.rain}%` : ""}</span>
          <span className="w-8 text-right tabular-nums text-muted">{Math.round(d.min)}°</span>
          <span className="relative h-1.5 flex-1 rounded-full bg-surface-2">
            <span
              className="bar-x absolute inset-y-0 rounded-full"
              style={{
                left: `${((d.min - lo) / (hi - lo || 1)) * 100}%`,
                right: `${100 - ((d.max - lo) / (hi - lo || 1)) * 100}%`,
                background: "linear-gradient(90deg, #60a5fa, #fbbf24)",
              }}
            />
          </span>
          <span className="w-8 tabular-nums">{Math.round(d.max)}°</span>
        </li>
      ))}
    </ul>
  );
}
