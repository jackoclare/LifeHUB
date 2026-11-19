"use client";

import { Footprints, MapPin, Pause, Play, Square, Trash2, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { updatePrefs, usePrefs, type Activity } from "@/lib/prefs";
import { celebrate } from "@/lib/celebrate";
import { Mascot } from "@/components/Mascot";
import { SectionHeader } from "@/components/kit";

/**
 * Walk & run tracker: GPS route drawn live in neon, distance, time, pace, estimated steps and calories.
 * Keeps the screen awake while tracking (iPhone web apps can't use GPS with the screen locked).
 */

type Pt = { lat: number; lon: number; t: number };
const R = 6371e3;
const hav = (a: Pt, b: Pt) => {
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLon = (b.lon - a.lon) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const STRIDE = { walk: 0.76, run: 1.15 }; // metres per step
const KCAL_PER_KM = { walk: 55, run: 75 }; // rough, ~75 kg adult
const clock = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pace = (secs: number, km: number) => (km > 0.05 ? `${Math.floor(secs / km / 60)}:${String(Math.round((secs / km) % 60)).padStart(2, "0")}` : "–:––");

function Route({ pts, live = false, h = 220 }: { pts: [number, number][]; live?: boolean; h?: number }) {
  const W = 340;
  const d = useMemo(() => {
    if (pts.length < 2) return null;
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
    const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = Math.max((maxLon - minLon) * kx, 1e-5);
    const spanY = Math.max(maxLat - minLat, 1e-5);
    const s = Math.min((W - 30) / spanX, (h - 30) / spanY);
    const ox = (W - spanX * s) / 2;
    const oy = (h - spanY * s) / 2;
    const xy = pts.map(([la, lo]) => [ox + (lo - minLon) * kx * s, h - (oy + (la - minLat) * s)] as const);
    return { path: xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "), start: xy[0], end: xy[xy.length - 1] };
  }, [pts, h]);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full" role="img" aria-label="Your route">
      <defs>
        <linearGradient id="routeGrad" x1="0" x2="1">
          <stop offset="0" stopColor="#00e5ff" />
          <stop offset="1" stopColor="#a855ff" />
        </linearGradient>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgb(0 229 255 / 0.06)" />
        </pattern>
      </defs>
      <rect width={W} height={h} fill="url(#grid)" />
      {d ? (
        <>
          <path d={d.path} fill="none" stroke="url(#routeGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px #00e5ff)" }} />
          <circle cx={d.start[0]} cy={d.start[1]} r="5" fill="#00f5a0" />
          <circle cx={d.end[0]} cy={d.end[1]} r="6" fill="#fff" className={live ? "live-dot" : ""} style={{ filter: "drop-shadow(0 0 8px #fff)" }} />
        </>
      ) : (
        <text x={W / 2} y={h / 2} textAnchor="middle" fill="rgb(255 255 255 / 0.4)" fontSize="13">
          {live ? "Finding you… start moving" : "No route"}
        </text>
      )}
    </svg>
  );
}

export function MoveView() {
  const { activities = [] } = usePrefs();
  const params = useSearchParams();
  const [kind, setKind] = useState<"walk" | "run" | null>(null);
  const [paused, setPaused] = useState(false);
  const [pts, setPts] = useState<Pt[]>([]);
  const [metres, setMetres] = useState(0);
  const [secs, setSecs] = useState(0);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const watch = useRef<number | null>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const pausedRef = useRef(false);
  const lastPt = useRef<Pt | null>(null);
  pausedRef.current = paused;

  const start = async (k: "walk" | "run") => {
    if (!navigator.geolocation) return setGpsErr("This browser can't use GPS.");
    setKind(k);
    setPaused(false);
    setPts([]);
    lastPt.current = null;
    setMetres(0);
    setSecs(0);
    setGpsErr(null);
    navigator.vibrate?.(30);
    try {
      lock.current = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {}
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setAccuracy(p.coords.accuracy);
        if (pausedRef.current || p.coords.accuracy > 35) return;
        const pt = { lat: p.coords.latitude, lon: p.coords.longitude, t: p.timestamp };
        const last = lastPt.current;
        if (last) {
          const step = hav(last, pt);
          const speed = step / Math.max(1, (pt.t - last.t) / 1000);
          if (step < 4 || speed > 9) return; // GPS jitter or a jump
          setMetres((m) => m + step);
        }
        lastPt.current = pt;
        setPts((prev) => [...prev, pt]);
      },
      (e) => setGpsErr(e.code === 1 ? "Location is blocked — allow it for LifeHub in Settings." : "Can't get a GPS fix — try stepping outside."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  };

  // auto-start from the AI ("I'm going for a run") → /move?start=run
  useEffect(() => {
    const s = params.get("start");
    if ((s === "walk" || s === "run") && !kind) start(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!kind || paused) return;
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [kind, paused]);

  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
      lock.current?.release().catch(() => {});
    },
    [],
  );

  const finish = async (save: boolean) => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    lock.current?.release().catch(() => {});
    if (save && kind && metres > 20) {
      const km = metres / 1000;
      const step = Math.max(1, Math.ceil(pts.length / 300));
      const a: Activity = {
        id: crypto.randomUUID(),
        kind,
        start: new Date(Date.now() - secs * 1000).toISOString(),
        secs,
        km: Math.round(km * 100) / 100,
        steps: Math.round(metres / STRIDE[kind]),
        kcal: Math.round(km * KCAL_PER_KM[kind]),
        route: pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5]),
      };
      await updatePrefs({ activities: [a, ...activities].slice(0, 60) });
      celebrate(document.querySelector(".move-stats"), 50);
    }
    setKind(null);
  };

  const week = useMemo(() => {
    const since = Date.now() - 7 * 86400e3;
    const w = activities.filter((a) => Date.parse(a.start) >= since);
    return { km: w.reduce((n, a) => n + a.km, 0), steps: w.reduce((n, a) => n + a.steps, 0), count: w.length };
  }, [activities]);

  if (kind) {
    const km = metres / 1000;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <section className="card move-stats overflow-hidden">
          <Route pts={pts.map((p) => [p.lat, p.lon])} live />
          <div className="grid grid-cols-2 gap-px border-t border-line bg-[var(--border)]">
            {[
              { l: "Distance", v: `${km.toFixed(2)}`, u: "km", big: true },
              { l: "Time", v: clock(secs), u: "", big: true },
              { l: "Pace", v: pace(secs, km), u: "/km" },
              { l: "Steps (est.)", v: Math.round(metres / STRIDE[kind]).toLocaleString("en-GB"), u: "" },
            ].map((s) => (
              <div key={s.l} className="bg-[#09090b] p-4">
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-faint">{s.l}</p>
                <p className={`font-display font-bold tabular-nums ${s.big ? "text-4xl text-white [text-shadow:0_0_18px_rgb(0_229_255/0.5)]" : "text-2xl"}`}>
                  {s.v}
                  <span className="ml-1 text-sm font-semibold text-muted">{s.u}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
        <p className="text-center text-xs text-faint">
          {gpsErr ?? (paused ? "Paused" : `${kind === "run" ? "🏃 Running" : "🚶 Walking"} · GPS ±${accuracy ? Math.round(accuracy) : "…"} m · keep LifeHub open on screen`)}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn btn-ghost min-h-14!" onClick={() => { lastPt.current = null; setPaused((p) => !p); }}>
            {paused ? <Play size={20} /> : <Pause size={20} />} {paused ? "Resume" : "Pause"}
          </button>
          <button className="btn btn-primary col-span-2 min-h-14!" onClick={() => finish(true)}>
            <Square size={18} fill="currentColor" /> Finish & save
          </button>
        </div>
        <button className="mx-auto block text-sm text-faint" onClick={() => finish(false)}>
          Cancel without saving
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="neon-panel flex items-center gap-4 rounded-[1.9rem] p-5" style={{ "--tile": "#ff4545" } as React.CSSProperties}>
        <Mascot mood={week.count ? "party" : "happy"} size={64} />
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">Last 7 days</p>
          <p className="neon-number font-display text-3xl font-bold tabular-nums">{week.km.toFixed(1)} km</p>
          <p className="text-sm text-muted">
            {week.count} session{week.count === 1 ? "" : "s"} · {week.steps.toLocaleString("en-GB")} steps tracked
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button className="move-start" style={{ "--tile": "#00e5ff" } as React.CSSProperties} onClick={() => start("walk")}>
          <Footprints size={34} />
          <span className="font-display text-xl font-bold">Walk</span>
        </button>
        <button className="move-start" style={{ "--tile": "#ff4545" } as React.CSSProperties} onClick={() => start("run")}>
          <Zap size={34} />
          <span className="font-display text-xl font-bold">Run</span>
        </button>
      </div>
      {gpsErr && <p className="text-sm text-[#ff6b61]">{gpsErr}</p>}
      <p className="text-xs text-faint">Tip: you can also tell the AI assistant &quot;I&apos;m going for a walk&quot;. Keep the app open on screen while you&apos;re out — iPhone pauses GPS for web apps when it&apos;s locked.</p>

      {activities.length > 0 && (
        <section>
          <SectionHeader title="Your sessions" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {activities.slice(0, 20).map((a) => (
              <li key={a.id} className="card overflow-hidden">
                <Route pts={a.route} h={130} />
                <div className="flex items-center gap-3 border-t border-line p-3">
                  <span className="text-xl">{a.kind === "run" ? "🏃" : "🚶"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {a.km.toFixed(2)} km · {clock(a.secs)} · {pace(a.secs, a.km)}/km
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(a.start).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {a.steps.toLocaleString("en-GB")} steps · ~{a.kcal} kcal
                    </p>
                  </div>
                  {a.route.length > 1 && (
                    <a aria-label="Open in Maps" className="grid size-9 place-items-center rounded-full text-muted hover:text-ink" href={`https://www.google.com/maps/dir/${a.route[0].join(",")}/${a.route[a.route.length - 1].join(",")}`} target="_blank" rel="noopener noreferrer">
                      <MapPin size={16} />
                    </a>
                  )}
                  <button aria-label="Delete session" className="grid size-9 place-items-center rounded-full text-faint hover:text-[#ff6b61]" onClick={() => updatePrefs({ activities: activities.filter((x) => x.id !== a.id) })}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
