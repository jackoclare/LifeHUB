"use client";

import { BellRing, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { updatePrefs, usePrefs, type Bin } from "@/lib/prefs";
import { BIN_PRESETS, ukToday, upcomingCollections } from "@/lib/bins";
import { SectionHeader } from "@/components/kit";
import { inputClass } from "@/components/ui";

/** Bin day: tell LifeHub when each bin was (or will next be) collected and how often — it works out the rest,
 *  shows which bins go out this week, and pushes a reminder at 7pm the night before. */

const EVERY = [
  { v: 1, label: "Every week" },
  { v: 2, label: "Every 2 weeks" },
  { v: 4, label: "Every 4 weeks" },
] as const;
const dayName = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

export function BinIcon({ colour, size = 34 }: { colour: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ filter: `drop-shadow(0 0 6px ${colour})` }}>
      <rect x="7" y="9" width="18" height="19" rx="2.5" fill={colour} />
      <rect x="5" y="6" width="22" height="4" rx="1.5" fill={colour} opacity="0.85" />
      <path d="M12 13v11M16 13v11M20 13v11" stroke="rgb(0 0 0 / 0.35)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="28.5" r="1.8" fill="#111" />
      <circle cx="22" cy="28.5" r="1.8" fill="#111" />
    </svg>
  );
}

export function BinsView() {
  const { bins: setup } = usePrefs();
  const today = ukToday();
  const list = setup?.bins ?? [];
  const upcoming = useMemo(() => upcomingCollections(setup, today, 8), [setup, today]);
  const [adding, setAdding] = useState(list.length === 0);
  const [draft, setDraft] = useState<Omit<Bin, "id">>({ ...BIN_PRESETS[0], anchor: today });

  const save = (bins: Bin[], remind = setup?.remind ?? true) => updatePrefs({ bins: { day: bins[0] ? new Date(`${bins[0].anchor}T12:00:00`).getDay() : 0, bins, remind } });
  const next = upcoming[0];

  return (
    <div className="space-y-5">
      {next && (
        <section className="neon-panel rounded-[1.9rem] p-5" style={{ "--tile": next.bins[0].colour } as React.CSSProperties}>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{next.date === today ? "Today" : "Next collection"}</p>
          <p className="mt-1 font-display text-2xl font-bold">{dayName(next.date)}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {next.bins.map((b) => (
              <span key={b.id} className="flex items-center gap-2 font-semibold">
                <BinIcon colour={b.colour} /> {b.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 1 && (
        <section>
          <SectionHeader title="Coming up" />
          <ul className="card divide-y divide-line">
            {upcoming.slice(1, 7).map((u) => (
              <li key={u.date} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium">{dayName(u.date)}</span>
                <span className="flex gap-1.5">
                  {u.bins.map((b) => (
                    <span key={b.id} title={b.name} className="flex items-center gap-1 text-xs text-muted">
                      <BinIcon colour={b.colour} size={24} />
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader title="Your bins" />
        <ul className="space-y-2">
          {list.map((b) => (
            <li key={b.id} className="card flex items-center gap-3 p-3">
              <BinIcon colour={b.colour} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.name}</p>
                <p className="text-xs text-muted">{EVERY.find((e) => e.v === b.every)?.label} · next {dayName(upcomingCollections({ day: 0, bins: [b], remind: false }, today, 9)[0]?.date ?? b.anchor)}</p>
              </div>
              <button aria-label="Remove bin" className="grid size-10 place-items-center rounded-full text-faint hover:text-[#ff6b61]" onClick={() => save(list.filter((x) => x.id !== b.id))}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>

        {adding ? (
          <div className="card mt-2 space-y-3 p-4">
            <div className="flex flex-wrap gap-1.5">
              {BIN_PRESETS.map((p) => (
                <button key={p.name} className={`chip min-h-9 px-3! ${draft.name === p.name ? "ai-chip" : ""}`} onClick={() => setDraft((d) => ({ ...d, ...p }))}>
                  <span className="size-2.5 rounded-full" style={{ background: p.colour }} /> {p.name}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs font-medium text-muted">
                Name
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
              </label>
              <label className="text-xs font-medium text-muted">
                How often
                <select value={draft.every} onChange={(e) => setDraft({ ...draft, every: Number(e.target.value) as 1 | 2 | 4 })} className={inputClass}>
                  {EVERY.map((x) => (
                    <option key={x.v} value={x.v}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">
                A collection date (last or next)
                <input type="date" value={draft.anchor} onChange={(e) => setDraft({ ...draft, anchor: e.target.value })} className={inputClass} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted">
              Colour
              <input type="color" value={draft.colour} onChange={(e) => setDraft({ ...draft, colour: e.target.value })} className="h-9 w-14 rounded-lg bg-transparent" />
            </label>
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                disabled={!draft.name.trim() || !draft.anchor}
                onClick={() => {
                  save([...list, { ...draft, name: draft.name.trim(), id: crypto.randomUUID() }]);
                  setAdding(false);
                }}
              >
                <Plus size={17} /> Add bin
              </button>
              {list.length > 0 && (
                <button className="btn btn-ghost" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost mt-2" onClick={() => setAdding(true)}>
            <Plus size={17} /> Add another bin
          </button>
        )}
      </section>

      {list.length > 0 && (
        <label className="card flex items-center gap-3 p-4">
          <BellRing size={18} className="text-[#00e5ff]" />
          <span className="flex-1 text-sm">
            <b>Remind me the night before</b>
            <span className="block text-xs text-muted">Push at about 7pm with which bins go out.</span>
          </span>
          <input type="checkbox" className="size-5 accent-[#00e5ff]" checked={setup?.remind ?? true} onChange={(e) => save(list, e.target.checked)} />
        </label>
      )}

      <a href="https://www.shropshire.gov.uk/search/?q=bin+collection+day" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
        <ExternalLink size={15} /> Not sure of your dates? Check Shropshire Council
      </a>
    </div>
  );
}
