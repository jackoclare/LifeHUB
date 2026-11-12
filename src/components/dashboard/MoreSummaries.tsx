"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readCache, writeCache } from "@/lib/cache";
import { usePlace } from "@/lib/weather";
import { isOpenNow } from "@/lib/openingHours";
import { distanceKm, miles } from "@/components/map/MapView";

const ukDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const Skeleton = () => <div className="h-20 animate-pulse rounded-xl bg-surface-2" />;

/** Prime-time picks on the big four channels */
export function TvSummary() {
  type P = { channel: string; start_at: string; title: string };
  const [rows, setRows] = useState<P[] | null>(null);
  useEffect(() => {
    const cached = readCache<P[]>(`tv.prime.${ukDate()}`, 6 * 3600e3);
    if (cached) setRows(cached);
    const main = ["BBCOneWestMidlands.uk", "ITV1CentralW.uk", "Channel4Midlands.uk", "5.uk"];
    // 9pm UK time tonight, as an instant (handles GMT/BST)
    const now = new Date();
    const ukOffsetMin = (new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) / 60000;
    const at = new Date(Date.parse(`${ukDate()}T21:00:00Z`) - ukOffsetMin * 60000);
    const when = Date.now() > at.getTime() ? new Date() : at;
    createClient()
      .from("tv_programmes")
      .select("channel,start_at,title")
      .in("channel", main)
      .lte("start_at", when.toISOString())
      .gt("stop_at", when.toISOString())
      .then(({ data }) => {
        const out = main.map((c) => (data ?? []).find((d) => d.channel === c)).filter(Boolean) as P[];
        setRows(out);
        writeCache(`tv.prime.${ukDate()}`, out);
      });
  }, []);
  const names: Record<string, string> = { "BBCOneWestMidlands.uk": "BBC One", "ITV1CentralW.uk": "ITV1", "Channel4Midlands.uk": "Channel 4", "5.uk": "Channel 5" };
  if (!rows) return <Skeleton />;
  if (!rows.length) return <p className="text-sm text-muted">Listings are loading in. Check the TV guide shortly.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.channel} className="flex items-baseline gap-2 text-sm">
          <span className="w-20 shrink-0 text-xs font-bold text-muted">{names[r.channel]}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
          <span className="shrink-0 text-xs tabular-nums text-faint">{hhmm(r.start_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function Ring({ pct, color, children }: { pct: number; color: string; children: React.ReactNode }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} style={{ transition: "stroke-dashoffset 1s var(--spring)" }} />
      </svg>
      <span className="text-[11px] font-bold">{children}</span>
    </div>
  );
}

export function ActivitySummary() {
  const [d, setD] = useState<{ steps: number; goal: number; km: number; kcal: number } | null>(null);
  useEffect(() => {
    const sb = createClient();
    Promise.all([sb.from("health_daily").select("steps,distance_km,active_kcal").eq("day", ukDate()).maybeSingle(), sb.from("nutrition_goals").select("steps").maybeSingle()]).then(([h, g]) =>
      setD({ steps: Number(h.data?.steps ?? 0), km: Number(h.data?.distance_km ?? 0), kcal: Number(h.data?.active_kcal ?? 0), goal: Number(g.data?.steps ?? 10000) }),
    );
  }, []);
  if (!d) return <Skeleton />;
  if (!d.steps && !d.kcal) return <p className="text-sm text-muted">No activity synced today yet. Set up the Apple Health shortcut on the Health page.</p>;
  return (
    <div className="flex items-center gap-4">
      <Ring pct={d.steps / d.goal} color="var(--c-health)">{Math.round((d.steps / d.goal) * 100)}%</Ring>
      <div className="text-sm">
        <p className="num-in text-xl font-bold tabular-nums">{d.steps.toLocaleString("en-GB")}</p>
        <p className="text-xs text-muted">
          steps · {d.km.toFixed(1)} km · {Math.round(d.kcal)} kcal active
        </p>
      </div>
    </div>
  );
}

export function NutritionSummary() {
  const [d, setD] = useState<{ kcal: number; goal: number; protein: number } | null>(null);
  useEffect(() => {
    const sb = createClient();
    Promise.all([sb.from("food_entries").select("kcal,protein").eq("eaten_on", ukDate()), sb.from("nutrition_goals").select("kcal").maybeSingle()]).then(([f, g]) =>
      setD({
        kcal: (f.data ?? []).reduce((a, x) => a + Number(x.kcal ?? 0), 0),
        protein: (f.data ?? []).reduce((a, x) => a + Number(x.protein ?? 0), 0),
        goal: Number(g.data?.kcal ?? 2000),
      }),
    );
  }, []);
  if (!d) return <Skeleton />;
  return (
    <div className="flex items-center gap-4">
      <Ring pct={d.kcal / d.goal} color="#ff9500">{Math.round(d.kcal)}</Ring>
      <div className="text-sm">
        <p className="font-semibold">
          {d.kcal ? `${Math.max(0, Math.round(d.goal - d.kcal))} kcal left` : "Nothing logged today"}
        </p>
        <p className="text-xs text-muted">
          Goal {d.goal} kcal{d.kcal ? ` · ${Math.round(d.protein)} g protein` : " · tap to add food"}
        </p>
      </div>
    </div>
  );
}

export function TravelSummary() {
  type T = { title: string; event_date: string };
  const [trips, setTrips] = useState<T[] | null>(null);
  useEffect(() => {
    createClient()
      .from("calendar_events")
      .select("title,event_date")
      .eq("kind", "travel")
      .gte("event_date", ukDate())
      .order("event_date")
      .limit(3)
      .then(({ data }) => setTrips((data ?? []) as T[]));
  }, []);
  if (!trips) return <Skeleton />;
  if (!trips.length) return <p className="text-sm text-muted">No trips booked. Tap to browse destinations on the price map.</p>;
  return (
    <ul className="space-y-1.5">
      {trips.map((t) => {
        const days = Math.round((Date.parse(`${t.event_date}T12:00:00Z`) - Date.parse(`${ukDate()}T12:00:00Z`)) / 86400e3);
        return (
          <li key={t.title + t.event_date} className="flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
            <span className="shrink-0 text-xs font-semibold text-accent">{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function LocalSummary() {
  type Pl = { id: string; name: string; lat: number; lon: number; kind: string; cuisine: string | null; openingHours: string | null };
  const { place } = usePlace();
  const [rows, setRows] = useState<Pl[] | null>(null);
  useEffect(() => {
    if (!place) return;
    const key = `explore.near.${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
    const cached = readCache<Pl[]>(key, 12 * 3600e3);
    if (cached) return setRows(cached);
    fetch(`/api/places?lat=${place.lat}&lon=${place.lon}&cat=restaurants&radius=2000`)
      .then((r) => r.json())
      .then((d) => {
        const list = ((d.places ?? []) as Pl[]).sort((a, b) => distanceKm(place, a) - distanceKm(place, b)).slice(0, 3);
        setRows(list);
        writeCache(key, list);
      })
      .catch(() => setRows([]));
  }, [place]);
  if (!place) return <p className="text-sm text-muted">Set your location to see places to eat nearby.</p>;
  if (!rows) return <Skeleton />;
  if (!rows.length) return <p className="text-sm text-muted">Tap to explore restaurants, pubs and things to do.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((p) => {
        const open = isOpenNow(p.openingHours);
        return (
          <li key={p.id} className="flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            {open !== null && <span className={`shrink-0 text-xs font-semibold ${open ? "text-[#1f9d47]" : "text-faint"}`}>{open ? "Open" : "Closed"}</span>}
            <span className="shrink-0 text-xs tabular-nums text-faint">{miles(distanceKm(place, p))}</span>
          </li>
        );
      })}
    </ul>
  );
}
