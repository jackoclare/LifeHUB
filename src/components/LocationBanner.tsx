"use client";

import { Loader2, LocateFixed, X } from "lucide-react";
import { useState } from "react";
import { findPlace, locateMe, savePlace, usePlace } from "@/lib/weather";

/**
 * Weather, fuel and maps all need to know roughly where you are.
 * Until a location is saved, show one friendly prompt at the top of every page.
 */
export function LocationBanner() {
  const { place, ready } = usePlace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && sessionStorage.getItem("mlh.loc.dismissed") === "1");
  if (!ready || place || hidden) return null;

  const run = async (fn: () => Promise<{ name: string; lat: number; lon: number }>) => {
    setBusy(true);
    setError(null);
    try {
      savePlace(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't find that");
    }
    setBusy(false);
  };

  return (
    <div className="card mb-5 p-4">
      <div className="flex items-start gap-3">
        <span className="icon-tile shrink-0" style={{ "--tile": "var(--accent)" } as React.CSSProperties}>
          <LocateFixed size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Where are you?</p>
          <p className="text-sm text-muted">Weather, fuel prices and maps need your location. It stays on this phone.</p>
        </div>
        <button aria-label="Not now" className="grid size-8 place-items-center rounded-full text-faint" onClick={() => {
            setHidden(true);
            try {
              sessionStorage.setItem("mlh.loc.dismissed", "1");
            } catch {}
          }}>
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button className="btn btn-primary" disabled={busy} onClick={() => run(locateMe)}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />} Use my location
        </button>
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) run(() => findPlace(q));
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="or postcode / town" className="min-h-11 w-full rounded-full bg-surface-2 px-4 text-base outline-none focus:ring-2 focus:ring-accent" aria-label="Postcode or town" />
          <button className="btn btn-ghost shrink-0" disabled={busy || !q.trim()}>
            Set
          </button>
        </form>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error === "Location permission was denied" ? "Location is blocked — type your postcode instead, or allow it in Settings → Privacy → Location Services → Safari Websites." : error}</p>}
    </div>
  );
}
