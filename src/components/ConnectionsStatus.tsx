"use client";

import { CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { label: string; ok: boolean | null; detail: string };

const fn = (name: string, qs = "") =>
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}${qs}`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } }).then((r) => r.json());

/** What's connected and working — so nobody has to ask */
export function ConnectionsStatus() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ai, notify, fuel, health, lastFuel] = await Promise.all([
        fn("ai").catch(() => null),
        fn("notify").catch(() => null),
        fn("fuel-sync", "?status").catch(() => null),
        fetch("/api/health").then((r) => r.json()).catch(() => null),
        createClient().from("fuel_prices").select("synced_at").order("synced_at", { ascending: false }).limit(1).then((r) => r.data?.[0]?.synced_at as string | undefined),
      ]);
      const ago = (iso?: string) => {
        if (!iso) return "never";
        const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`;
      };
      const viaFeeds = String(fuel?.recent?.[0]?.error ?? "").startsWith("fallback");
      const list: Row[] = [
        { label: "Free AI chat (Groq)", ok: ai ? Boolean(ai.configured) : null, detail: ai?.configured ? "Connected" : "Not connected — needs a free Groq key" },
        { label: "Phone notifications", ok: notify ? Boolean(notify.configured) : null, detail: notify?.configured ? "Server ready — switch on per device above" : "Push keys missing" },
        {
          label: "Fuel prices",
          ok: lastFuel ? Date.now() - new Date(lastFuel).getTime() < 3 * 3600e3 : false,
          detail: `${viaFeeds ? "Retailer feeds (Fuel Finder blocked)" : "Fuel Finder"} · updated ${ago(lastFuel)}`,
        },
        { label: "Match lineups (API-Football)", ok: health ? Boolean(health.API_FOOTBALL_KEY?.set) : null, detail: health?.API_FOOTBALL_KEY?.set ? "Key set" : "No key" },
        { label: "Places search (Geoapify)", ok: health ? Boolean(health.GEOAPIFY_KEY?.set) : null, detail: health?.GEOAPIFY_KEY?.set ? "Key set" : "Using free OpenStreetMap fallback" },
        { label: "Weather, news, deals, bank holidays", ok: true, detail: "Free public sources — no setup needed" },
      ];
      if (alive) setRows(list);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="card p-4">
      <h3 className="mb-2 text-sm font-semibold">Connections</h3>
      {!rows ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Checking…
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-start gap-2.5">
              {r.ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-500" /> : <CircleDashed size={17} className="mt-0.5 shrink-0 text-amber-400" />}
              <span className="min-w-0">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-muted">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
