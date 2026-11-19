"use client";

import { Check, Loader2, Luggage, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { askAi } from "@/app/ai/AiChat";
import { updatePrefs, usePrefs, type PackingList } from "@/lib/prefs";
import { celebrate } from "@/lib/celebrate";
import { SectionHeader } from "@/components/kit";
import { inputClass } from "@/components/ui";

/** Packing lists: say where and for how long — the AI checks the forecast there and builds a ticklist. */

const ukDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);

export function PackingView() {
  const { packing = [] } = usePrefs();
  const [place, setPlace] = useState("");
  const [start, setStart] = useState(ukDay(new Date(Date.now() + 7 * 86400e3)));
  const [days, setDays] = useState(4);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(packing[0]?.id ?? null);

  const save = (list: PackingList[]) => updatePrefs({ packing: list });
  const make = async () => {
    if (!place.trim()) return;
    setBusy(true);
    setErr(null);
    const r = (await askAi({ mode: "packing", place: place.trim(), start, days, notes: notes.trim() })) as { error?: string; weather?: string; sections?: { title: string; items: string[] }[] };
    setBusy(false);
    if (r.error || !r.sections?.length) return setErr(r.error ?? "Couldn't build a list — try again.");
    const list: PackingList = {
      id: crypto.randomUUID(),
      place: place.trim(),
      start,
      days,
      weather: r.weather ?? "",
      items: r.sections.flatMap((s) => s.items.map((text) => ({ id: crypto.randomUUID(), text, section: s.title, done: false }))),
    };
    save([list, ...packing].slice(0, 10));
    setOpen(list.id);
    setPlace("");
    setNotes("");
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Sparkles size={17} className="text-[#00e5ff]" /> New packing list
        </p>
        <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_0.7fr]">
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Where? e.g. Málaga" className={inputClass} aria-label="Destination" />
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} aria-label="Leaving" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputClass} aria-label="Nights">
            {Array.from({ length: 21 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} day{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else? e.g. hand luggage only, wedding, hiking" className={inputClass} />
        <button className="btn btn-primary" onClick={make} disabled={busy || !place.trim()}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Luggage size={17} />} {busy ? "Checking the weather…" : "Build my list"}
        </button>
        {err && <p className="text-sm text-[#ff6b61]">{err}</p>}
      </section>

      {packing.length === 0 && <p className="card p-5 text-sm text-muted">No lists yet. Or just tell the AI assistant: &quot;I&apos;m going to Málaga for 4 days&quot;.</p>}

      {packing.map((l) => {
        const done = l.items.filter((i) => i.done).length;
        const sections = [...new Set(l.items.map((i) => i.section))];
        const isOpen = open === l.id;
        const set = (items: PackingList["items"]) => save(packing.map((x) => (x.id === l.id ? { ...x, items } : x)));
        return (
          <section key={l.id} className="card overflow-hidden">
            <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : l.id)}>
              <span className="icon-tile shrink-0" style={{ "--tile": "var(--c-travel)" } as React.CSSProperties}>
                <Luggage size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg font-bold">{l.place}</span>
                <span className="block truncate text-xs text-muted">
                  {l.start ? new Date(`${l.start}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""} · {l.days} day{l.days > 1 ? "s" : ""} · {done}/{l.items.length} packed
                </span>
              </span>
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[#00f5a0] shadow-[0_0_8px_#00f5a0] transition-all" style={{ width: `${(done / Math.max(1, l.items.length)) * 100}%` }} />
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-line p-4 pt-3">
                {l.weather && <p className="mb-3 rounded-2xl bg-[#00e5ff]/8 px-3 py-2 text-sm text-[#bdf6ff]">🌤️ {l.weather}</p>}
                {sections.map((sec) => (
                  <div key={sec} className="mb-3">
                    <SectionHeader title={sec} />
                    <ul className="space-y-1">
                      {l.items
                        .filter((i) => i.section === sec)
                        .map((i) => (
                          <li key={i.id}>
                            <button
                              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                              onClick={(e) => {
                                const items = l.items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x));
                                set(items);
                                if (items.every((x) => x.done)) celebrate(e.currentTarget, 60);
                              }}
                            >
                              <span className={`grid size-6 shrink-0 place-items-center rounded-lg ${i.done ? "bg-[#00f5a0] text-black" : "ring-1 ring-white/20"}`}>{i.done && <Check size={15} strokeWidth={3} />}</span>
                              <span className={i.done ? "text-faint line-through" : ""}>{i.text}</span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
                <AddItem onAdd={(text) => set([...l.items, { id: crypto.randomUUID(), text, section: "Extras", done: false }])} />
                <button className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-faint hover:text-[#ff6b61]" onClick={() => save(packing.filter((x) => x.id !== l.id))}>
                  <Trash2 size={14} /> Delete list
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AddItem({ onAdd }: { onAdd: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (t.trim()) onAdd(t.trim());
        setT("");
      }}
    >
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Add something…" className={`${inputClass} mt-0!`} />
      <button className="btn btn-ghost shrink-0" aria-label="Add">
        <Plus size={17} />
      </button>
    </form>
  );
}
