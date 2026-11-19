"use client";

import { ArrowLeftRight, BellRing, Bus, ExternalLink, Loader2, RefreshCw, TrainFront } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { updatePrefs, usePrefs, type UsualTrain } from "@/lib/prefs";
import { SectionHeader } from "@/components/kit";
import { inputClass } from "@/components/ui";

/**
 * Live trains from Shrewsbury (or any station), from National Rail's free official feed, plus a
 * "usual train" the alerts job watches for delays and cancellations. Buses: quick links (bus
 * operators' live data needs separate sign-up).
 */

export const STATIONS: { crs: string; name: string }[] = [
  { crs: "SHR", name: "Shrewsbury" },
  { crs: "BHM", name: "Birmingham New St" },
  { crs: "BMO", name: "Birmingham Moor St" },
  { crs: "WVH", name: "Wolverhampton" },
  { crs: "TFC", name: "Telford Central" },
  { crs: "WLN", name: "Wellington" },
  { crs: "CRE", name: "Crewe" },
  { crs: "MAN", name: "Manchester Piccadilly" },
  { crs: "CDF", name: "Cardiff Central" },
  { crs: "CTR", name: "Chester" },
  { crs: "HFD", name: "Hereford" },
  { crs: "EUS", name: "London Euston" },
  { crs: "BHI", name: "Birmingham International" },
  { crs: "GOB", name: "Gobowen" },
  { crs: "WRX", name: "Wrexham General" },
  { crs: "ABH", name: "Aberystwyth" },
  { crs: "CSY", name: "Church Stretton" },
  { crs: "LUD", name: "Ludlow" },
];
const nameOf = (crs: string) => STATIONS.find((s) => s.crs === crs)?.name ?? crs;

type Svc = { id: string; std: string; etd: string; platform: string | null; operator: string; destination: string; cancelled: boolean; reason: string | null; arrive: { name: string; st: string; et: string } | null; calling: string[]; coaches: number | null };
type Board = { configured: boolean; station?: string; services: Svc[]; messages?: string[]; error?: string; generatedAt?: string };

const fn = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${path}`;
const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" };

export function useBoard(from: string, to: string | null, rows = 10) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    fetch(fn(`trains?from=${from}${to ? `&to=${to}` : ""}&rows=${rows}`), { headers })
      .then((r) => r.json())
      .then(setBoard)
      .catch(() => setBoard({ configured: true, services: [], error: "Couldn't load trains — check your signal." }))
      .finally(() => setLoading(false));
  }, [from, to, rows]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  return { board, loading, reload: load };
}

function status(s: Svc) {
  if (s.cancelled) return { text: "Cancelled", colour: "#ff4545" };
  if (s.etd === "On time") return { text: "On time", colour: "#00f5a0" };
  if (s.etd === "Delayed") return { text: "Delayed", colour: "#ffb020" };
  if (/^\d\d:\d\d$/.test(s.etd)) return { text: `Exp ${s.etd}`, colour: "#ffb020" };
  return { text: s.etd || "—", colour: "var(--text-muted)" };
}

export function TrainsView() {
  const prefs = usePrefs();
  const [from, setFrom] = useState(prefs.stations?.from ?? "SHR");
  const [to, setTo] = useState<string | null>(prefs.stations?.to ?? null);
  useEffect(() => {
    if (prefs.stations) {
      setFrom(prefs.stations.from);
      setTo(prefs.stations.to);
    }
  }, [prefs.stations]);
  const pick = (f: string, t: string | null) => {
    setFrom(f);
    setTo(t);
    updatePrefs({ stations: { from: f, to: t } });
  };
  const { board, loading, reload } = useBoard(from, to);
  const usual = prefs.train;

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="text-xs font-medium text-muted">
            From
            <select value={from} onChange={(e) => pick(e.target.value, to === e.target.value ? null : to)} className={inputClass}>
              {STATIONS.map((s) => (
                <option key={s.crs} value={s.crs}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button aria-label="Swap" className="mb-1 grid size-11 place-items-center rounded-full text-muted hover:text-ink disabled:opacity-30" disabled={!to} onClick={() => to && pick(to, from)}>
            <ArrowLeftRight size={18} />
          </button>
          <label className="text-xs font-medium text-muted">
            To (optional)
            <select value={to ?? ""} onChange={(e) => pick(from, e.target.value || null)} className={inputClass}>
              <option value="">Anywhere</option>
              {STATIONS.filter((s) => s.crs !== from).map((s) => (
                <option key={s.crs} value={s.crs}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {board && !board.configured ? (
        <SetupCard from={from} />
      ) : (
        <section>
          <SectionHeader title={`Departures · ${nameOf(from)}${to ? ` → ${nameOf(to)}` : ""}`} />
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-faint">
              <span>Live from National Rail · updates every minute</span>
              <button onClick={reload} aria-label="Refresh" className="grid size-8 place-items-center rounded-full hover:text-ink">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
            </div>
            {board?.error && <p className="px-4 py-3 text-sm text-[#ff6b61]">{board.error}</p>}
            {board?.messages?.map((m) => (
              <p key={m} className="border-b border-line bg-[#ffb020]/10 px-4 py-2 text-xs text-[#ffcf70]">
                ⚠️ {m}
              </p>
            ))}
            {!board && <div className="m-4 h-24 animate-pulse rounded-xl" />}
            {board && !board.error && board.services.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No trains in the next 2 hours.</p>}
            <ul>
              {board?.services.map((s) => {
                const st = status(s);
                const mine = usual && usual.from === from && usual.time === s.std && (!usual.to || usual.to === to);
                return (
                  <li key={s.id} className={`flex items-start gap-3 border-b border-line px-4 py-3 last:border-0 ${mine ? "bg-[#00e5ff]/5" : ""}`}>
                    <div className="w-14 shrink-0">
                      <p className={`font-display text-lg font-bold tabular-nums ${s.cancelled ? "text-faint line-through" : ""}`}>{s.std}</p>
                      <p className="text-[0.7rem] font-bold" style={{ color: st.colour }}>
                        {st.text}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {s.destination}
                        {mine && <span className="ml-2 rounded-full bg-[#00e5ff]/15 px-2 py-0.5 text-[0.65rem] font-bold text-[#00e5ff]">YOUR TRAIN</span>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {s.operator}
                        {s.arrive && to ? ` · arrives ${s.arrive.et && s.arrive.et !== "On time" ? s.arrive.et : s.arrive.st}` : ""}
                        {s.coaches ? ` · ${s.coaches} coaches` : ""}
                      </p>
                      {s.reason && <p className="mt-0.5 text-xs text-[#ffcf70]">{s.reason}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[0.62rem] font-bold uppercase tracking-wider text-faint">Plat</p>
                      <p className="font-display text-lg font-bold">{s.platform ?? "–"}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <UsualTrainCard usual={usual} from={from} to={to} />

      <section>
        <SectionHeader title="Buses" />
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { name: "Live bus times — Shrewsbury", note: "bustimes.org · every stop", href: "https://bustimes.org/localities/shrewsbury" },
            { name: "Arriva Midlands", note: "Timetables + app tickets", href: "https://www.arrivabus.co.uk/midlands" },
            { name: "Park & Ride", note: "Shropshire Council", href: "https://www.shropshire.gov.uk/travel-and-transport/park-and-ride/" },
          ].map((b) => (
            <a key={b.href} href={b.href} target="_blank" rel="noopener noreferrer" className="card card-interactive flex items-center gap-3 p-3" style={{ "--tile": "var(--c-money)" } as React.CSSProperties}>
              <span className="icon-tile">
                <Bus size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{b.name}</span>
                <span className="block truncate text-xs text-muted">{b.note}</span>
              </span>
              <ExternalLink size={15} className="text-faint" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function SetupCard({ from }: { from: string }) {
  return (
    <section className="card space-y-3 p-5">
      <p className="flex items-center gap-2 font-display text-lg font-semibold">
        <TrainFront size={20} className="text-[#00e5ff]" /> Switch on live trains (free, 5 minutes)
      </p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
        <li>
          Sign up free at{" "}
          <a className="font-semibold text-accent" href="https://raildata.org.uk/registerPartner" target="_blank" rel="noopener noreferrer">
            raildata.org.uk
          </a>{" "}
          (choose &quot;Individual not affiliated with a company&quot;).
        </li>
        <li>Find the <b>Live Departure Board</b> data product and press <b>Subscribe</b> — it&apos;s free with no limit.</li>
        <li>Open your subscription → <b>Specification</b> tab → copy the <b>Consumer key</b>.</li>
        <li>
          In Supabase → Edge Functions → Secrets, add <b>RAIL_DATA_KEY</b> with that key. Then tell Claude it&apos;s done.
        </li>
      </ol>
      <a href={`https://www.nationalrail.co.uk/live-trains/departures/${from.toLowerCase()}/`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">
        <ExternalLink size={16} /> Meanwhile: live board on National Rail
      </a>
    </section>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function UsualTrainCard({ usual, from, to }: { usual: UsualTrain | null | undefined; from: string; to: string | null }) {
  const [time, setTime] = useState(usual?.time ?? "07:30");
  const [days, setDays] = useState<number[]>(usual?.days ?? [1, 2, 3, 4, 5]);
  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 font-semibold">
        <BellRing size={17} className="text-[#00e5ff]" /> Your usual train
      </p>
      {usual ? (
        <p className="mt-1 text-sm text-muted">
          Watching the <b className="text-ink">{usual.time}</b> {nameOf(usual.from)} → {nameOf(usual.to)} on {usual.days.map((d) => DAYS[d]).join(", ")}. You&apos;ll get a push if it&apos;s late or cancelled (checked from about 90 minutes before).
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Pick a destination above, then the time of the train you usually catch — I&apos;ll warn you if it&apos;s late or cancelled.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} mt-0! w-32`} aria-label="Departure time" />
        {DAYS.map((d, i) => (
          <button key={d} onClick={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].sort()))} className={`chip min-h-9 px-2.5! ${days.includes(i) ? "ai-chip" : ""}`}>
            {d}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary" disabled={!to || !days.length} onClick={() => to && updatePrefs({ train: { from, to, time, days } })}>
          {usual ? "Update" : "Watch this train"}
        </button>
        {usual && (
          <button className="btn btn-ghost" onClick={() => updatePrefs({ train: null })}>
            Stop watching
          </button>
        )}
      </div>
      {!to && <p className="mt-2 text-xs text-faint">Choose a &quot;To&quot; station first.</p>}
    </section>
  );
}
