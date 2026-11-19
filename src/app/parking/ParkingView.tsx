"use client";

import { CircleParking, Loader2, MapPin, Navigation, Plus, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updatePrefs, usePrefs, type Parking } from "@/lib/prefs";
import { inputClass } from "@/components/ui";

/**
 * Parking timer: tap when you park, pick how long the ticket lasts. LifeHub remembers where the car is,
 * counts down, pings you (push alerts job + an on-screen alert if the app is open), and takes you back.
 */

const PRESETS = [30, 60, 120, 180, 240];
const label = (m: number) => (m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function where(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => res(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

export function ParkingView() {
  const { parking } = usePrefs();
  const [mins, setMins] = useState(60);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const warned = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // On-screen / device alert at 10 minutes left while the app is open
  useEffect(() => {
    if (!parking?.expires) return;
    const left = Date.parse(parking.expires) - now;
    if (left > 0 && left <= 10 * 60e3 && warned.current !== parking.expires) {
      warned.current = parking.expires;
      navigator.vibrate?.([200, 100, 200]);
      try {
        navigator.serviceWorker?.ready.then((r) => r.showNotification("🅿️ Parking runs out soon", { body: `About ${Math.ceil(left / 60e3)} minutes left (ends ${hhmm(parking.expires!)}).`, tag: "parking" }));
      } catch {}
    }
  }, [now, parking]);

  const start = async (unlimited = false) => {
    setBusy(true);
    const pos = await where();
    const started = new Date();
    const p: Parking = { started: started.toISOString(), expires: unlimited ? null : new Date(started.getTime() + mins * 60e3).toISOString(), ...(pos ?? {}), note: note.trim() || undefined };
    await updatePrefs({ parking: p });
    setBusy(false);
  };
  const extend = (m: number) => parking?.expires && updatePrefs({ parking: { ...parking, expires: new Date(Math.max(Date.parse(parking.expires), Date.now()) + m * 60e3).toISOString() } });
  const end = () => updatePrefs({ parking: null });

  if (!parking) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <section className="card p-5 text-center">
          <span className="icon-tile mx-auto size-14!" style={{ "--tile": "var(--c-discover)" } as React.CSSProperties}>
            <CircleParking size={28} />
          </span>
          <p className="mt-3 font-display text-xl font-bold">Just parked?</p>
          <p className="text-sm text-muted">Pick how long your ticket lasts. I&apos;ll remember where the car is and warn you before it runs out.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {PRESETS.map((m) => (
              <button key={m} onClick={() => setMins(m)} className={`chip min-h-10 px-4! text-sm! ${mins === m ? "ai-chip" : ""}`}>
                {label(m)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
            or
            <input type="number" min={5} max={1440} value={mins} onChange={(e) => setMins(Math.max(5, Math.min(1440, Number(e.target.value) || 5)))} className={`${inputClass} mt-0! w-24! text-center`} aria-label="Minutes" /> minutes
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. Level 3, near the lifts" className={`${inputClass} mt-3`} />
          <button className="btn btn-primary mt-4 w-full" onClick={() => start(false)} disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <CircleParking size={18} />} Start {label(mins)} timer
          </button>
          <button className="mt-2 text-sm font-semibold text-muted" onClick={() => start(true)} disabled={busy}>
            No time limit — just remember where I parked
          </button>
        </section>
      </div>
    );
  }

  const total = parking.expires ? Date.parse(parking.expires) - Date.parse(parking.started) : 0;
  const left = parking.expires ? Date.parse(parking.expires) - now : 0;
  const pct = total ? Math.max(0, Math.min(1, left / total)) : 1;
  const over = parking.expires != null && left <= 0;
  const soon = !over && parking.expires != null && left <= 10 * 60e3;
  const colour = over ? "#ff4545" : soon ? "#ffb020" : "#00e5ff";
  const h = Math.floor(Math.abs(left) / 3600e3);
  const m = Math.floor((Math.abs(left) % 3600e3) / 60e3);
  const s = Math.floor((Math.abs(left) % 60e3) / 1000);
  const R = 88;
  const C = 2 * Math.PI * R;
  const maps = parking.lat != null ? `https://maps.apple.com/?daddr=${parking.lat},${parking.lon}&dirflg=w` : null;
  const gmaps = parking.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${parking.lat},${parking.lon}&travelmode=walking` : null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="card p-5 text-center">
        <div className="relative mx-auto size-52">
          <svg viewBox="0 0 200 200" className="size-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="10" />
            <circle cx="100" cy="100" r={R} fill="none" stroke={colour} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ filter: `drop-shadow(0 0 8px ${colour})`, transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div>
              {parking.expires ? (
                <>
                  <p className="font-display text-[2.6rem] font-extralight leading-none tabular-nums" style={{ color: colour, textShadow: `0 0 20px ${colour}` }}>
                    {over ? "-" : ""}
                    {h ? `${h}:${String(m).padStart(2, "0")}` : m}
                    <span className="text-2xl">:{String(s).padStart(2, "0")}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">{over ? "Ticket ran out" : `ends ${hhmm(parking.expires)}`}</p>
                </>
              ) : (
                <>
                  <CircleParking size={40} className="mx-auto text-[#00e5ff]" />
                  <p className="mt-1 text-xs text-muted">parked {hhmm(parking.started)}</p>
                </>
              )}
            </div>
          </div>
        </div>
        {parking.note && <p className="mt-2 text-sm">📝 {parking.note}</p>}
        {parking.expires && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[15, 30, 60].map((x) => (
              <button key={x} className="chip min-h-10 px-4!" onClick={() => extend(x)}>
                <Plus size={13} /> {label(x)}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-faint">You&apos;ll get a push alert about 10–20 minutes before it runs out (and an on-screen alert at 10 minutes if the app&apos;s open).</p>
      </section>

      <section className="card p-4">
        <p className="flex items-center gap-2 font-semibold">
          <MapPin size={17} className="text-[#00e5ff]" /> Where you parked
        </p>
        {parking.lat != null ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={gmaps!} target="_blank" rel="noopener noreferrer" className="mt-3 block overflow-hidden rounded-2xl">
              <iframe title="Car location" className="pointer-events-none h-44 w-full map-tiles-dark" src={`https://www.openstreetmap.org/export/embed.html?bbox=${parking.lon! - 0.004},${parking.lat - 0.0025},${parking.lon! + 0.004},${parking.lat + 0.0025}&layer=mapnik&marker=${parking.lat},${parking.lon}`} />
            </a>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={maps!} className="btn btn-primary">
                <Navigation size={17} /> Apple Maps
              </a>
              <a href={gmaps!} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <Navigation size={17} /> Google Maps
              </a>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">Location wasn&apos;t available when you parked — allow location for LifeHub next time.</p>
        )}
      </section>

      <button className="btn btn-ghost w-full text-[#ff6b61]!" onClick={end}>
        <Square size={15} fill="currentColor" /> I&apos;m back at the car — end parking
      </button>
    </div>
  );
}
