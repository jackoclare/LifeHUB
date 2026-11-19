"use client";

import { Check, ClipboardPaste, ExternalLink, Package, Plus, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { updatePrefs, usePrefs, type Parcel } from "@/lib/prefs";
import { SectionHeader } from "@/components/kit";
import { inputClass } from "@/components/ui";

/**
 * Parcel tracker. Couriers don't let other apps read their tracking for free, so LifeHub keeps your
 * tracking numbers in one list, works out the courier from the number, and opens the right tracking
 * page in one tap. Saved to your account so they're on every device.
 */

type Courier = { id: string; name: string; colour: string; test?: RegExp; url: (n: string) => string };

export const COURIERS: Courier[] = [
  { id: "amazon", name: "Amazon", colour: "#ff9900", test: /^TBA\d{9,13}$/i, url: (n) => `https://track.amazon.co.uk/tracking/${n}` },
  { id: "royalmail", name: "Royal Mail", colour: "#e1251b", test: /^[A-Z]{2}\d{9}GB$/i, url: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}` },
  { id: "parcelforce", name: "Parcelforce", colour: "#d4202c", test: /^(?:[A-Z]{2}\d{7}|[A-Z]{2}\d{9}(?!GB)[A-Z]{2})$/i, url: (n) => `https://www.parcelforce.com/track-trace?trackNumber=${n}` },
  { id: "ups", name: "UPS", colour: "#ffb500", test: /^1Z[0-9A-Z]{16}$/i, url: (n) => `https://www.ups.com/track?tracknum=${n}&loc=en_GB` },
  { id: "dpd", name: "DPD", colour: "#dc0032", test: /^\d{14}$/, url: (n) => `https://track.dpd.co.uk/parcels/${n}` },
  { id: "dhl", name: "DHL", colour: "#ffcc00", test: /^(?:\d{10}|JJD\d{10,20}|JVGL\d+)$/i, url: (n) => `https://www.dhl.com/gb-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${n}` },
  { id: "yodel", name: "Yodel", colour: "#6dbf4b", test: /^(?:JD\d{16}|\d{16})$/i, url: (n) => `https://www.yodel.co.uk/tracking/${n}` },
  { id: "evri", name: "Evri", colour: "#007bc4", test: /^[A-Z][0-9A-Z]{15}$/i, url: (n) => `https://www.evri.com/track/parcel/${n}/details` },
  { id: "inpost", name: "InPost", colour: "#ffcd00", test: /^\d{24}$/, url: (n) => `https://inpost.co.uk/tracking/?number=${n}` },
  { id: "other", name: "Other courier", colour: "#a1a1aa", url: (n) => `https://parcelsapp.com/en/tracking/${n}` },
];

export const guessCourier = (n: string) => COURIERS.find((c) => c.test?.test(n))?.id ?? "other";
const courierOf = (id: string) => COURIERS.find((c) => c.id === id) ?? COURIERS[COURIERS.length - 1];
const clean = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();

export function ParcelsView() {
  const prefs = usePrefs();
  const parcels = prefs.parcels ?? [];
  const [num, setNum] = useState("");
  const [label, setLabel] = useState("");
  const [courier, setCourier] = useState<string | null>(null);
  const n = clean(num);
  const guess = n.length >= 8 ? guessCourier(n) : null;
  const chosen = courier ?? guess ?? "other";

  const save = (list: Parcel[]) => updatePrefs({ parcels: list });
  const add = () => {
    if (n.length < 6) return;
    if (parcels.some((p) => p.number === n)) return setNum("");
    save([{ id: crypto.randomUUID(), number: n, courier: chosen, label: label.trim() || "Parcel", added: new Date().toISOString() }, ...parcels]);
    setNum("");
    setLabel("");
    setCourier(null);
  };

  const active = parcels.filter((p) => !p.delivered);
  const done = parcels.filter((p) => p.delivered);

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <p className="font-display text-lg font-semibold">Add a parcel</p>
        <p className="text-sm text-muted">Paste the tracking number from your order email — I&apos;ll work out the courier.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr]">
          <div className="relative">
            <input value={num} onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Tracking number" className={`${inputClass} pr-11 font-mono uppercase tracking-wider`} aria-label="Tracking number" />
            <button
              type="button"
              aria-label="Paste"
              className="absolute right-1.5 top-[calc(50%+2px)] grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink"
              onClick={async () => {
                try {
                  setNum(await navigator.clipboard.readText());
                } catch {}
              }}
            >
              <ClipboardPaste size={17} />
            </button>
          </div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="What is it? e.g. Trainers" className={inputClass} aria-label="What is it" />
        </div>
        {n.length >= 6 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {COURIERS.map((c) => (
              <button key={c.id} onClick={() => setCourier(c.id)} className={`chip min-h-9 px-3! ${chosen === c.id ? "ring-2" : ""}`} style={chosen === c.id ? ({ color: c.colour, boxShadow: `inset 0 0 0 1.5px ${c.colour}` } as React.CSSProperties) : undefined}>
                {c.name}
                {guess === c.id && courier == null && " ✓"}
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-primary mt-3 w-full sm:w-auto" disabled={n.length < 6} onClick={add}>
          <Plus size={18} /> Track it
        </button>
      </section>

      <section>
        <SectionHeader title={`On the way${active.length ? ` (${active.length})` : ""}`} />
        {active.length === 0 ? (
          <div className="card flex items-center gap-3 p-5 text-sm text-muted">
            <Package size={22} className="text-faint" /> Nothing on the way. Add a tracking number above.
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((p) => (
              <ParcelRow key={p.id} p={p} onDone={() => save(parcels.map((x) => (x.id === p.id ? { ...x, delivered: true } : x)))} onDelete={() => save(parcels.filter((x) => x.id !== p.id))} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <SectionHeader title="Delivered" />
          <ul className="space-y-2 opacity-70">
            {done.slice(0, 10).map((p) => (
              <ParcelRow key={p.id} p={p} onDone={() => save(parcels.map((x) => (x.id === p.id ? { ...x, delivered: false } : x)))} onDelete={() => save(parcels.filter((x) => x.id !== p.id))} />
            ))}
          </ul>
          <button className="mt-2 text-sm font-semibold text-muted" onClick={() => save(active)}>
            Clear delivered
          </button>
        </section>
      )}
    </div>
  );
}

function ParcelRow({ p, onDone, onDelete }: { p: Parcel; onDone: () => void; onDelete: () => void }) {
  const c = courierOf(p.courier);
  const days = Math.floor((Date.now() - Date.parse(p.added)) / 86400e3);
  return (
    <li className="card flex items-center gap-3 p-3" style={{ "--tile": c.colour } as React.CSSProperties}>
      <span className="icon-tile shrink-0">
        <Package size={17} />
      </span>
      <a href={c.url(p.number)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.label}</p>
        <p className="truncate text-xs text-muted">
          <span style={{ color: c.colour }}>{c.name}</span> · <span className="font-mono">{p.number}</span> · {days === 0 ? "added today" : `${days}d ago`}
        </p>
      </a>
      <a href={c.url(p.number)} target="_blank" rel="noopener noreferrer" aria-label="Track" className="grid size-10 place-items-center rounded-full text-muted hover:text-ink">
        <ExternalLink size={17} />
      </a>
      <button onClick={onDone} aria-label={p.delivered ? "Not delivered yet" : "Mark delivered"} className="grid size-10 place-items-center rounded-full text-muted hover:text-[#00f5a0]">
        {p.delivered ? <Undo2 size={17} /> : <Check size={18} />}
      </button>
      <button onClick={onDelete} aria-label="Remove" className="grid size-10 place-items-center rounded-full text-faint hover:text-[#ff6b61]">
        <Trash2 size={16} />
      </button>
    </li>
  );
}
