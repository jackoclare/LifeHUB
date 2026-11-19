"use client";

import { Check, Flame, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { updatePrefs, usePrefs, type Habit } from "@/lib/prefs";
import { celebrate } from "@/lib/celebrate";
import { Mascot } from "@/components/Mascot";
import { inputClass } from "@/components/ui";

/** Habits & streaks: tick things off each day, watch the streak grow, and the stick man cheers you on. */

const PRESETS = [
  { emoji: "💧", name: "Drink water" },
  { emoji: "🏋️", name: "Gym" },
  { emoji: "🚶", name: "10k steps" },
  { emoji: "💷", name: "No-spend day" },
  { emoji: "📚", name: "Read 10 pages" },
  { emoji: "🛌", name: "Bed by 11" },
  { emoji: "🥗", name: "Cook at home" },
  { emoji: "📵", name: "No phone in bed" },
];
const ukDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
const daysAgo = (n: number) => ukDay(new Date(Date.now() - n * 86400e3));

export function streak(h: Habit) {
  const set = new Set(h.done);
  let n = 0;
  // a streak survives until the end of today, so count from yesterday if today isn't ticked yet
  let i = set.has(daysAgo(0)) ? 0 : 1;
  while (set.has(daysAgo(i))) {
    n++;
    i++;
  }
  return n;
}
function best(h: Habit) {
  const days = [...new Set(h.done)].sort();
  let b = 0;
  let run = 0;
  let prev = 0;
  for (const d of days) {
    const t = Date.parse(`${d}T12:00:00Z`);
    run = prev && t - prev === 86400e3 ? run + 1 : 1;
    b = Math.max(b, run);
    prev = t;
  }
  return b;
}

export function HabitsView() {
  const { habits = [] } = usePrefs();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const today = daysAgo(0);
  const save = (list: Habit[]) => updatePrefs({ habits: list });
  const doneToday = habits.filter((h) => h.done.includes(today)).length;
  const allDone = habits.length > 0 && doneToday === habits.length;

  const toggle = (h: Habit, el: Element) => {
    const on = h.done.includes(today);
    const done = on ? h.done.filter((d) => d !== today) : [today, ...h.done].slice(0, 400);
    save(habits.map((x) => (x.id === h.id ? { ...x, done } : x)));
    if (!on) {
      const s = streak({ ...h, done });
      celebrate(el, [7, 14, 30, 50, 100].includes(s) ? 80 : 18);
    }
  };

  return (
    <div className="space-y-5">
      <section className="neon-panel flex items-center gap-4 rounded-[1.9rem] p-5" style={{ "--tile": allDone ? "#00f5a0" : "#00e5ff" } as React.CSSProperties}>
        <Mascot mood={allDone ? "party" : doneToday ? "happy" : "sleepy"} size={72} />
        <div>
          <p className="neon-number font-display text-4xl font-bold tabular-nums">
            {doneToday}/{habits.length || 0}
          </p>
          <p className="text-sm text-muted">{habits.length === 0 ? "Add a habit to get started" : allDone ? "All done today — legend 🔥" : doneToday ? "Nice — keep it going" : "Nothing ticked yet today"}</p>
        </div>
      </section>

      <ul className="space-y-2">
        {habits.map((h) => {
          const on = h.done.includes(today);
          const s = streak(h);
          return (
            <li key={h.id} className={`card flex items-center gap-3 p-3 ${on ? "habit-done" : ""}`}>
              <button onClick={(e) => toggle(h, e.currentTarget)} aria-pressed={on} aria-label={on ? `Untick ${h.name}` : `Tick ${h.name}`} className={`habit-tick grid size-12 shrink-0 place-items-center rounded-2xl text-2xl ${on ? "is-on" : ""}`}>
                {on ? <Check size={24} strokeWidth={3} /> : h.emoji}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{h.name}</p>
                <div className="mt-1 flex gap-1" aria-label="Last 14 days">
                  {Array.from({ length: 14 }, (_, i) => 13 - i).map((i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${h.done.includes(daysAgo(i)) ? "bg-[#00f5a0] shadow-[0_0_6px_#00f5a0]" : "bg-white/10"}`} />
                  ))}
                </div>
              </div>
              <div className="w-14 shrink-0 text-right">
                <p className={`flex items-center justify-end gap-0.5 font-display text-xl font-bold tabular-nums ${s ? "text-[#ffb020]" : "text-faint"}`}>
                  <Flame size={16} /> {s}
                </p>
                <p className="text-[0.62rem] text-faint">best {best(h)}</p>
              </div>
              <button aria-label="Remove habit" className="grid size-9 place-items-center rounded-full text-faint hover:text-[#ff6b61]" onClick={() => save(habits.filter((x) => x.id !== h.id))}>
                <Trash2 size={15} />
              </button>
            </li>
          );
        })}
      </ul>

      <section className="card space-y-3 p-4">
        <p className="font-semibold">Add a habit</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.filter((p) => !habits.some((h) => h.name === p.name)).map((p) => (
            <button key={p.name} className="chip min-h-9 px-3!" onClick={() => save([...habits, { id: crypto.randomUUID(), ...p, done: [] }])}>
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={emoji} onChange={(e) => setEmoji([...e.target.value].slice(-1).join("") || "✅")} className={`${inputClass} mt-0! w-16! text-center text-xl`} aria-label="Emoji" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Or your own…" className={`${inputClass} mt-0!`} aria-label="Habit name" />
          <button
            className="btn btn-primary shrink-0"
            disabled={!name.trim()}
            onClick={() => {
              save([...habits, { id: crypto.randomUUID(), name: name.trim(), emoji, done: [] }]);
              setName("");
            }}
          >
            <Plus size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
