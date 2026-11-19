"use client";

import { Plus, ReceiptText, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { updatePrefs, usePrefs, type Warranty } from "@/lib/prefs";
import { SectionHeader } from "@/components/kit";
import { inputClass } from "@/components/ui";

/** Warranties & returns: log a purchase once, get reminded before the return window closes and before the
 *  warranty runs out. (Tip: keep the receipt photo in Documents.) */

const ukDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
const plusDays = (iso: string, n: number) => ukDay(new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400e3));
const plusYears = (iso: string, n: number) => `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}`;
const until = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${ukDay()}T12:00:00Z`)) / 86400e3);
const nice = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Chip({ label, iso, icon }: { label: string; iso: string; icon: React.ReactNode }) {
  const d = until(iso);
  const colour = d < 0 ? "var(--text-faint)" : d <= 7 ? "#ff6b61" : d <= 30 ? "#ffb020" : "#00f5a0";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-bold" style={{ color: colour, boxShadow: `inset 0 0 0 1px ${colour}` }}>
      {icon} {label} {d < 0 ? "ended" : d === 0 ? "ends today" : `${d}d`} · {nice(iso)}
    </span>
  );
}

export function WarrantiesView() {
  const { warranties = [] } = usePrefs();
  const [item, setItem] = useState("");
  const [shop, setShop] = useState("");
  const [bought, setBought] = useState(ukDay());
  const [ret, setRet] = useState(30);
  const [years, setYears] = useState(1);
  const [price, setPrice] = useState("");
  const save = (list: Warranty[]) => updatePrefs({ warranties: list });

  const sorted = useMemo(
    () =>
      [...warranties].sort((a, b) => {
        const next = (w: Warranty) => [w.returnBy, w.warrantyUntil].filter((x): x is string => Boolean(x) && until(x!) >= 0).sort()[0] ?? "9999";
        return next(a).localeCompare(next(b));
      }),
    [warranties],
  );

  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-4">
        <p className="font-semibold">Log a purchase</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="What did you buy? e.g. Air fryer" className={inputClass} />
          <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Shop (optional)" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="text-xs font-medium text-muted">
            Bought
            <input type="date" value={bought} onChange={(e) => setBought(e.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-medium text-muted">
            Return within
            <select value={ret} onChange={(e) => setRet(Number(e.target.value))} className={inputClass}>
              {[0, 14, 28, 30, 60, 90, 365].map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? "No returns" : d === 365 ? "1 year" : `${d} days`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Warranty
            <select value={years} onChange={(e) => setYears(Number(e.target.value))} className={inputClass}>
              {[0, 1, 2, 3, 5, 10].map((y) => (
                <option key={y} value={y}>
                  {y === 0 ? "None" : `${y} year${y > 1 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Price £
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Optional" className={inputClass} />
          </label>
        </div>
        <button
          className="btn btn-primary"
          disabled={!item.trim() || !bought}
          onClick={() => {
            save([...warranties, { id: crypto.randomUUID(), item: item.trim(), shop: shop.trim() || undefined, bought, returnBy: ret ? plusDays(bought, ret) : null, warrantyUntil: years ? plusYears(bought, years) : null, price: Number(price) || null }]);
            setItem("");
            setShop("");
            setPrice("");
          }}
        >
          <Plus size={17} /> Save
        </button>
        <p className="text-xs text-faint">Reminders: 3 days before a return window closes and 2 weeks before a warranty ends. Keep the receipt photo in Documents.</p>
      </section>

      <section>
        <SectionHeader title={`Your purchases (${warranties.length})`} />
        {sorted.length === 0 ? (
          <p className="card flex items-center gap-3 p-5 text-sm text-muted">
            <ReceiptText size={20} className="text-faint" /> Nothing logged yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((w) => (
              <li key={w.id} className="card flex items-start gap-3 p-3" style={{ "--tile": "var(--c-tv)" } as React.CSSProperties}>
                <span className="icon-tile mt-0.5 shrink-0">
                  <ReceiptText size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {w.item}
                    {w.price ? <span className="font-normal text-muted"> · £{w.price}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {w.shop ? `${w.shop} · ` : ""}bought {nice(w.bought)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {w.returnBy && <Chip label="Return" iso={w.returnBy} icon={<Undo2 size={11} />} />}
                    {w.warrantyUntil && <Chip label="Warranty" iso={w.warrantyUntil} icon={<ShieldCheck size={11} />} />}
                  </div>
                </div>
                <button aria-label="Remove" className="grid size-10 place-items-center rounded-full text-faint hover:text-[#ff6b61]" onClick={() => save(warranties.filter((x) => x.id !== w.id))}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
