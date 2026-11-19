"use client";

import { Cake, Gift, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { updatePrefs, usePrefs, type Birthday } from "@/lib/prefs";
import { createClient } from "@/lib/supabase/client";
import { celebrate } from "@/lib/celebrate";
import { SectionHeader } from "@/components/kit";
import { inputClass } from "@/components/ui";

/** Birthdays: countdowns, ages, a gift idea for each (one tap onto the wish list), and push reminders a week before and on the day. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function nextBirthday(b: Birthday, now = new Date()) {
  const [m, d] = b.date.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  const days = Math.round((next.getTime() - today.getTime()) / 86400e3);
  const turning = b.year ? next.getFullYear() - b.year : null;
  return { next, days, turning };
}

export function BirthdaysView() {
  const { birthdays = [] } = usePrefs();
  const [name, setName] = useState("");
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState("");
  const [gift, setGift] = useState("");
  const [wished, setWished] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => [...birthdays].map((b) => ({ b, ...nextBirthday(b) })).sort((x, y) => x.days - y.days), [birthdays]);
  const save = (list: Birthday[]) => updatePrefs({ birthdays: list });

  const add = () => {
    if (!name.trim()) return;
    const y = Number(year);
    save([...birthdays, { id: crypto.randomUUID(), name: name.trim(), date: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, year: y > 1900 && y <= new Date().getFullYear() ? y : null, gift: gift.trim() || undefined }]);
    setName("");
    setYear("");
    setGift("");
  };

  const toWishList = async (b: Birthday) => {
    if (!b.gift) return;
    const { error } = await createClient().from("wishlist_items").insert({ name: `${b.gift} (for ${b.name})`, priority: 2, notes: `Birthday ${b.date}` });
    if (!error) setWished((s) => new Set(s).add(b.id));
  };

  const soon = sorted[0];

  return (
    <div className="space-y-5">
      {soon && (
        <button className="neon-panel block w-full rounded-[1.9rem] p-5 text-left" style={{ "--tile": "#ffb020" } as React.CSSProperties} onClick={(e) => soon.days === 0 && celebrate(e.currentTarget, 60)}>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{soon.days === 0 ? "Today!" : "Next birthday"}</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {soon.days === 0 ? "🎉 " : "🎂 "}
            {soon.b.name}
            {soon.turning ? ` turns ${soon.turning}` : ""}
          </p>
          <p className="neon-number mt-1 font-display text-4xl font-bold tabular-nums">{soon.days === 0 ? "Today" : soon.days === 1 ? "Tomorrow" : `${soon.days} days`}</p>
          <p className="mt-1 text-sm text-muted">{soon.next.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        </button>
      )}

      <section className="card space-y-3 p-4">
        <p className="font-semibold">Add a birthday</p>
        <div className="grid gap-2 sm:grid-cols-[1.3fr_0.6fr_0.8fr_0.7fr]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputClass} aria-label="Name" />
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={inputClass} aria-label="Day">
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputClass} aria-label="Month">
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Year (optional)" className={inputClass} aria-label="Year born" />
        </div>
        <input value={gift} onChange={(e) => setGift(e.target.value)} placeholder="Gift idea (optional)" className={inputClass} aria-label="Gift idea" />
        <button className="btn btn-primary" disabled={!name.trim()} onClick={add}>
          <Plus size={17} /> Add
        </button>
        <p className="text-xs text-faint">You&apos;ll get a push a week before and on the morning of each birthday.</p>
      </section>

      <section>
        <SectionHeader title={`Everyone (${birthdays.length})`} />
        {sorted.length === 0 ? (
          <p className="card flex items-center gap-3 p-5 text-sm text-muted">
            <Cake size={20} className="text-faint" /> No birthdays yet — add family and mates above (or just tell the AI &quot;Mum&apos;s birthday is 4 March&quot;).
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map(({ b, days, turning, next }) => (
              <li key={b.id} className="card flex items-center gap-3 p-3" style={{ "--tile": days <= 7 ? "#ffb020" : "var(--c-shop)" } as React.CSSProperties}>
                <span className="icon-tile shrink-0">
                  <Cake size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {b.name}
                    {turning ? <span className="font-normal text-muted"> · turns {turning}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {next.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · {days === 0 ? "today 🎉" : days === 1 ? "tomorrow" : `in ${days} days`}
                    {b.gift ? ` · 🎁 ${b.gift}` : ""}
                  </p>
                </div>
                {b.gift && (
                  <button aria-label="Add gift to wish list" disabled={wished.has(b.id)} className="grid size-10 place-items-center rounded-full text-muted hover:text-[#ffb020] disabled:text-[#00f5a0]" onClick={() => toWishList(b)}>
                    <Gift size={17} />
                  </button>
                )}
                <button aria-label="Remove" className="grid size-10 place-items-center rounded-full text-faint hover:text-[#ff6b61]" onClick={() => save(birthdays.filter((x) => x.id !== b.id))}>
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
