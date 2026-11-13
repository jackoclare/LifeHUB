"use client";

import { Camera, Copy, Flame, Footprints, Loader2, Plus, Search, Timer, Trash2, Watch } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { Sheet } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { askAi, shrink } from "@/app/ai/AiChat";
import type { Food } from "@/app/api/food/route";
import { DateStrip, daysFrom } from "@/components/kit";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: { id: Meal; label: string; emoji: string }[] = [
  { id: "breakfast", label: "Breakfast", emoji: "🥣" },
  { id: "lunch", label: "Lunch", emoji: "🥪" },
  { id: "dinner", label: "Dinner", emoji: "🍽️" },
  { id: "snack", label: "Snacks", emoji: "🍎" },
];
type Entry = { id: string; eaten_on: string; meal: Meal; name: string; brand: string | null; grams: number | null; kcal: number; protein: number | null; carbs: number | null; fat: number | null };
type Day = { day: string; steps: number | null; distance_km: number | null; active_kcal: number | null; exercise_min: number | null; resting_hr: number | null; sleep_hours: number | null };
type Goals = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; steps: number | null };

const ukToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (iso: string) => {
  const t = ukToday();
  if (iso === t) return "Today";
  if (iso === shift(t, -1)) return "Yesterday";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};
const r0 = (n: number | null | undefined) => (n == null ? "–" : Math.round(Number(n)).toLocaleString("en-GB"));

function Ring({ value, goal, color, size = 88, children }: { value: number; goal: number; color: string; size?: number; children: React.ReactNode }) {
  const pct = Math.min(1, goal > 0 ? value / goal : 0);
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function HealthView() {
  const { user, loading } = useAuth();
  const [date, setDate] = useState(ukToday());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [goals, setGoals] = useState<Goals>({ kcal: null, protein: null, carbs: null, fat: null, steps: 10000 });
  const [adding, setAdding] = useState<Meal | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [editGoals, setEditGoals] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const sb = createClient();
    const [e, d, g] = await Promise.all([
      sb.from("food_entries").select("*").eq("eaten_on", date).order("created_at"),
      sb.from("health_daily").select("*").gte("day", shift(ukToday(), -6)).order("day"),
      sb.from("nutrition_goals").select("*").maybeSingle(),
    ]);
    setEntries((e.data as Entry[]) ?? []);
    setDays((d.data as Day[]) ?? []);
    if (g.data) setGoals(g.data as Goals);
  }, [user, date]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () => entries.reduce((t, e) => ({ kcal: t.kcal + Number(e.kcal || 0), protein: t.protein + Number(e.protein || 0), carbs: t.carbs + Number(e.carbs || 0), fat: t.fat + Number(e.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }),
    [entries],
  );
  const today = days.find((d) => d.day === date) ?? null;

  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to see your health and food diary." />;

  const remove = async (id: string) => {
    setEntries((es) => es.filter((e) => e.id !== id));
    await createClient().from("food_entries").delete().eq("id", id);
  };

  return (
    <div className="space-y-5">
      {/* Day picker */}
      <DateStrip days={daysFrom(ukToday(), 1, 13)} value={date} onChange={setDate} accent="var(--c-health)" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Activity */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Watch size={18} className="text-[var(--c-health)]" /> Activity
            </h2>
            <button className="text-sm font-semibold text-accent" onClick={() => setShowSetup(true)}>
              {days.length ? "Apple Health link" : "Connect Apple Health"}
            </button>
          </div>
          {today ? (
            <>
              <div className="flex items-center gap-5">
                <Ring value={today.steps ?? 0} goal={goals.steps ?? 10000} color="var(--c-health)" size={112}>
                  <span>
                    <span className="block font-display text-2xl font-bold tabular-nums">{r0(today.steps)}</span>
                    <span className="text-xs text-muted">steps</span>
                  </span>
                </Ring>
                <div className="grid flex-1 grid-cols-2 gap-3 text-sm">
                  <Stat icon={<Footprints size={14} />} label="Distance" value={today.distance_km != null ? `${(Number(today.distance_km) * 0.621371).toFixed(1)} mi` : "–"} />
                  <Stat icon={<Flame size={14} />} label="Active" value={today.active_kcal != null ? `${r0(today.active_kcal)} kcal` : "–"} />
                  <Stat icon={<Timer size={14} />} label="Exercise" value={today.exercise_min != null ? `${today.exercise_min} min` : "–"} />
                  <Stat icon={<span>❤️</span>} label="Resting HR" value={today.resting_hr != null ? `${today.resting_hr} bpm` : "–"} />
                </div>
              </div>
              <WeekBars days={days} goal={goals.steps ?? 10000} />
            </>
          ) : (
            <div className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
              {days.length ? "No activity sent for this day yet." : "Link Apple Health with a free iPhone Shortcut to see your steps, distance and active calories here."}
              {!days.length && (
                <button className="btn btn-primary mt-3 w-full" onClick={() => setShowSetup(true)}>
                  Set it up (2 minutes)
                </button>
              )}
            </div>
          )}
        </section>

        {/* Nutrition summary */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">🍴 Food today</h2>
            <button className="text-sm font-semibold text-accent" onClick={() => setEditGoals(true)}>
              Goals
            </button>
          </div>
          <div className="flex items-center gap-5">
            <Ring value={totals.kcal} goal={goals.kcal ?? 0} color="var(--c-money)" size={112}>
              <span>
                <span className="block font-display text-2xl font-bold tabular-nums">{r0(totals.kcal)}</span>
                <span className="text-xs text-muted">{goals.kcal ? `of ${r0(goals.kcal)} kcal` : "kcal"}</span>
              </span>
            </Ring>
            <div className="flex-1 space-y-2.5">
              {(
                [
                  ["Protein", totals.protein, goals.protein, "#0a84ff"],
                  ["Carbs", totals.carbs, goals.carbs, "#ff9f0a"],
                  ["Fat", totals.fat, goals.fat, "#bf5af2"],
                ] as const
              ).map(([label, v, g, c]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{label}</span>
                    <span className="tabular-nums text-muted">
                      {r0(v)}g{g ? ` / ${g}g` : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${c} 18%, transparent)` }}>
                    <div className="bar-x h-full rounded-full" style={{ width: `${g ? Math.min(100, (v / g) * 100) : Math.min(100, v)}%`, background: c }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Meals */}
      <section className="space-y-3">
        {MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m.id);
          const kcal = list.reduce((s, e) => s + Number(e.kcal || 0), 0);
          return (
            <div key={m.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3.5">
                <p className="font-semibold">
                  {m.emoji} {m.label}
                </p>
                <span className="text-sm tabular-nums text-muted">{r0(kcal)} kcal</span>
              </div>
              <ul className="mt-1">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{e.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {[e.brand, e.grams ? `${r0(e.grams)}g` : null, e.protein != null ? `P ${r0(e.protein)}g` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{r0(e.kcal)}</span>
                    <button className="grid size-8 place-items-center rounded-full text-faint hover:text-red-500" aria-label={`Remove ${e.name}`} onClick={() => remove(e.id)}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
              <button className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-sm font-semibold text-accent" onClick={() => setAdding(m.id)}>
                <Plus size={16} /> Add food
              </button>
            </div>
          );
        })}
      </section>

      <p className="text-xs text-faint">Food data from Open Food Facts (open database) — values are per pack label and may vary. Activity comes from Apple Health via your Shortcut.</p>

      <AddFood meal={adding} date={date} onClose={() => setAdding(null)} onAdded={load} />
      <ShortcutSetup open={showSetup} onClose={() => setShowSetup(false)} />
      <GoalsSheet open={editGoals} goals={goals} onClose={() => setEditGoals(false)} onSaved={(g) => setGoals(g)} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted">
        {icon} {label}
      </p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function WeekBars({ days, goal }: { days: Day[]; goal: number }) {
  const t = ukToday();
  const week = Array.from({ length: 7 }, (_, i) => shift(t, i - 6));
  const max = Math.max(goal, ...days.map((d) => d.steps ?? 0));
  return (
    <div className="mt-5 flex h-20 items-end gap-2">
      {week.map((iso, i) => {
        const d = days.find((x) => x.day === iso);
        const h = d?.steps ? Math.max(4, (d.steps / max) * 100) : 4;
        return (
          <div key={iso} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end">
              <div
                className="bar w-full rounded-md"
                style={{ height: `${h}%`, background: (d?.steps ?? 0) >= goal ? "var(--c-health)" : "color-mix(in srgb, var(--c-health) 45%, transparent)", animationDelay: `${i * 60}ms` }}
              />
            </div>
            <span className="text-[10px] text-faint">{new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow" })}</span>
          </div>
        );
      })}
    </div>
  );
}

function AddFood({ meal, date, onClose, onAdded }: { meal: Meal | null; date: string; onClose: () => void; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");
  const [manual, setManual] = useState({ name: "", kcal: "", protein: "" });
  type PhotoItem = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; on: boolean };
  const [photo, setPhoto] = useState<{ preview: string; items: PhotoItem[]; note: string; confidence: string } | null>(null);
  const [portion, setPortion] = useState(1);

  useEffect(() => {
    if (!meal) {
      setQ("");
      setFoods([]);
      setPick(null);
      setErr(null);
      setManual({ name: "", kcal: "", protein: "" });
      setPhoto(null);
      setPortion(1);
    }
  }, [meal]);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    setErr(null);
    const isBarcode = /^\d{8,14}$/.test(term.replace(/\s/g, ""));
    const r = await fetch(`/api/food?${isBarcode ? `barcode=${term.replace(/\s/g, "")}` : `q=${encodeURIComponent(term)}`}`).then((x) => x.json()).catch(() => ({ foods: [], error: "Couldn't search right now" }));
    setFoods(r.foods ?? []);
    setErr(r.error ?? (r.foods?.length ? null : "Nothing found — try fewer words, or add it by hand below."));
    if (isBarcode && r.foods?.[0]) choose(r.foods[0]);
    setBusy(false);
  };

  const choose = (f: Food) => {
    setPick(f);
    setGrams(String(f.servingGrams ?? 100));
  };

  const save = async (row: Record<string, unknown>) => {
    setBusy(true);
    const { error } = await createClient().from("food_entries").insert({ ...row, meal, eaten_on: date });
    setBusy(false);
    if (error) return setErr(error.message);
    onAdded();
    onClose();
  };

  const snap = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const image = await shrink(file, 1024);
      const r = (await askAi({ mode: "foodphoto", image })) as { items?: Omit<PhotoItem, "on">[]; note?: string; confidence?: string; error?: string };
      if (r.error) setErr(r.error);
      else if (!r.items?.length) setErr(r.note || "I couldn't spot any food in that photo — try again or add it by hand.");
      else {
        setPortion(1);
        setPhoto({ preview: image, items: r.items.map((i) => ({ ...i, on: true })), note: r.note ?? "", confidence: r.confidence ?? "medium" });
      }
    } catch {
      setErr("Couldn't read that photo — try again.");
    }
    setBusy(false);
  };

  const savePhoto = async () => {
    if (!photo) return;
    const rows = photo.items
      .filter((i) => i.on)
      .map((i) => ({
        name: i.name,
        brand: "Photo estimate",
        grams: Math.round(i.grams * portion),
        kcal: Math.round(i.kcal * portion),
        protein: Math.round(i.protein * portion * 10) / 10,
        carbs: Math.round(i.carbs * portion * 10) / 10,
        fat: Math.round(i.fat * portion * 10) / 10,
        meal,
        eaten_on: date,
      }));
    if (!rows.length) return setErr("Tick at least one item.");
    setBusy(true);
    const { error } = await createClient().from("food_entries").insert(rows);
    setBusy(false);
    if (error) return setErr(error.message);
    onAdded();
    onClose();
  };

  const g = Number(grams) || 0;
  const scaled = (v: number | null) => (v == null ? null : Math.round(((v * g) / 100) * 10) / 10);

  return (
    <Sheet open={!!meal} title={`Add to ${MEALS.find((m) => m.id === meal)?.label ?? ""}`} onClose={onClose}>
      {photo ? (
        <div className="space-y-4">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="Your food" className="size-20 shrink-0 rounded-2xl object-cover" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">AI estimate · {photo.confidence} confidence</p>
              <p className="text-muted">{photo.note || "Check the items and portion, then add."}</p>
            </div>
          </div>
          <ul className="divide-y divide-line rounded-2xl bg-surface-2">
            {photo.items.map((it, i) => (
              <li key={i}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--accent)]"
                    checked={it.on}
                    onChange={() => setPhoto({ ...photo, items: photo.items.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{it.name}</span>
                    <span className="block text-xs text-muted">
                      ~{Math.round(it.grams * portion)}g · {r0(it.protein * portion)}g protein
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{Math.round(it.kcal * portion)} kcal</span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <p className="mb-1.5 text-sm font-medium">Portion</p>
            <div className="flex gap-2">
              {[0.5, 1, 1.5, 2].map((x) => (
                <button key={x} className={`chip min-h-10 flex-1 justify-center ${portion === x ? "bg-accent! text-white!" : ""}`} onClick={() => setPortion(x)}>
                  {x === 0.5 ? "½" : x === 1.5 ? "1½" : `${x}`}×
                </button>
              ))}
            </div>
          </div>
          <p className="text-center text-sm">
            Total{" "}
            <span className="font-display text-lg font-bold tabular-nums">
              {Math.round(photo.items.filter((i) => i.on).reduce((a, i) => a + i.kcal, 0) * portion)} kcal
            </span>
          </p>
          {err && <p className="text-sm text-muted">{err}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={() => setPhoto(null)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={savePhoto}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Add to diary"}
            </button>
          </div>
          <p className="text-[11px] text-faint">Photo estimates are rough — free AI (Groq) guesses portions from the picture.</p>
        </div>
      ) : pick ? (
        <div className="space-y-4">
          <div>
            <p className="font-semibold">{pick.name}</p>
            <p className="text-sm text-muted">{[pick.brand, pick.serving ? `serving ${pick.serving}` : null].filter(Boolean).join(" · ")}</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium">How much? (grams)</span>
            <div className="mt-1 flex gap-2">
              <input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className="min-h-11 w-28 rounded-xl bg-surface-2 px-3 text-base outline-none focus:ring-2 focus:ring-accent" />
              {[pick.servingGrams, 100, 200].filter((x, i, a): x is number => !!x && a.indexOf(x) === i).map((x) => (
                <button key={x} className="chip min-h-11 px-3!" onClick={() => setGrams(String(x))}>
                  {x === pick.servingGrams ? `1 serving (${x}g)` : `${x}g`}
                </button>
              ))}
            </div>
          </label>
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-surface-2 p-3 text-center">
            {(
              [
                ["kcal", scaled(pick.per100.kcal)],
                ["protein", scaled(pick.per100.protein)],
                ["carbs", scaled(pick.per100.carbs)],
                ["fat", scaled(pick.per100.fat)],
              ] as const
            ).map(([l, v]) => (
              <div key={l}>
                <p className="font-display text-lg font-bold tabular-nums">{v == null ? "–" : r0(v)}</p>
                <p className="text-[11px] text-muted">{l === "kcal" ? "kcal" : `${l} g`}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={() => setPick(null)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || g <= 0}
              onClick={() =>
                save({
                  name: pick.name,
                  brand: pick.brand,
                  barcode: pick.code || null,
                  grams: g,
                  kcal: scaled(pick.per100.kcal) ?? 0,
                  protein: scaled(pick.per100.protein),
                  carbs: scaled(pick.per100.carbs),
                  fat: scaled(pick.per100.fat),
                  sugar: scaled(pick.per100.sugar),
                  fibre: scaled(pick.per100.fibre),
                  salt: scaled(pick.per100.salt),
                })
              }
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <label className={`btn w-full cursor-pointer text-white ${busy ? "opacity-80" : ""}`} style={{ background: "linear-gradient(135deg,#ff9500,#ff2d55)" }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={17} />} {busy ? "Looking at your food…" : "Snap your food — AI counts the calories"}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy} onChange={(e) => snap(e.target.files?.[0] ?? undefined)} />
          </label>
          <form onSubmit={search} className="flex gap-2">
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-full bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-accent">
              <Search size={16} className="text-faint" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search food or type a barcode" enterKeyHint="search" className="w-full bg-transparent text-base outline-none" />
            </label>
            <button className="btn btn-primary" disabled={busy || !q.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Search"}
            </button>
          </form>
          {err && <p className="text-sm text-muted">{err}</p>}
          {foods.length > 0 && (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {foods.map((f) => (
                <li key={f.code + f.name}>
                  <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2" onClick={() => choose(f)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="block truncate text-xs text-muted">{f.brand ?? "—"}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">{r0(f.per100.kcal)} kcal/100g</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium">Or add it by hand</p>
            <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
              <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="e.g. Chippy tea" className="min-h-11 rounded-xl bg-surface-2 px-3 text-base outline-none focus:ring-2 focus:ring-accent" />
              <input inputMode="numeric" value={manual.kcal} onChange={(e) => setManual({ ...manual, kcal: e.target.value })} placeholder="kcal" className="min-h-11 rounded-xl bg-surface-2 px-3 text-base outline-none focus:ring-2 focus:ring-accent" />
              <input inputMode="numeric" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} placeholder="protein" className="min-h-11 rounded-xl bg-surface-2 px-3 text-base outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <button
              className="btn btn-ghost mt-2 w-full"
              disabled={busy || !manual.name.trim() || !manual.kcal}
              onClick={() => save({ name: manual.name.trim(), kcal: Number(manual.kcal) || 0, protein: manual.protein ? Number(manual.protein) : null })}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ShortcutSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open || url) return;
    (async () => {
      const sb = createClient();
      let { data } = await sb.from("health_tokens").select("token").maybeSingle();
      if (!data) data = (await sb.from("health_tokens").insert({}).select("token").single()).data;
      if (data?.token) setUrl(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/health-ingest?token=${data.token}`);
    })();
  }, [open, url]);

  return (
    <Sheet open={open} title="Link Apple Health" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">A free iPhone Shortcut reads today&apos;s numbers from the Health app and sends them here. Set it once, then it runs by itself.</p>
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="mb-1 text-xs font-semibold text-muted">Your private link (keep it to yourself)</p>
          <p className="break-all font-mono text-xs">{url ?? "Creating…"}</p>
          <button
            className="btn btn-primary mt-2 w-full"
            disabled={!url}
            onClick={async () => {
              if (!url) return;
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Copy size={15} /> {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="mb-1 text-xs font-semibold text-muted">⌚ Apple Watch: &quot;LifeHub Today&quot; link</p>
          <p className="text-xs text-muted">A second Shortcut — Get Contents of URL (this link) → Show Result, with &quot;Show on Apple Watch&quot; on — shows your weather, plans, next match and steps on your wrist.</p>
          <button
            className="btn btn-ghost mt-2 w-full"
            disabled={!url}
            onClick={async () => {
              if (!url) return;
              await navigator.clipboard.writeText(url.replace("/health-ingest?", "/today?"));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Copy size={15} /> Copy watch link
          </button>
        </div>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open the <strong>Shortcuts</strong> app → <strong>+</strong> → name it <strong>LifeHub Health</strong>.
          </li>
          <li>
            Add <strong>Find Health Samples</strong> → Type <strong>Steps</strong>, Start Date <strong>is today</strong>. Then add <strong>Calculate Statistics</strong> → <strong>Sum</strong>.
          </li>
          <li>
            Do the same for <strong>Active Energy</strong> (Sum) and <strong>Walking + Running Distance</strong> (Sum).
          </li>
          <li>
            Add <strong>Get Contents of URL</strong> → paste your link → Method <strong>POST</strong> → Request Body <strong>JSON</strong> → add fields <code>steps</code>,{" "}
            <code>activeEnergy</code>, <code>distance</code> and pick each Statistics result. (If your distance is in miles, add a text field <code>distanceUnit</code> = <code>mi</code>.)
          </li>
          <li>
            Tap ▶︎ to test — it should say <code>ok: true</code>. Then in <strong>Automation</strong> → <strong>+</strong> → <strong>Time of Day</strong> → every hour (or 9pm daily) →{" "}
            <strong>Run Immediately</strong> → choose this Shortcut.
          </li>
        </ol>
        <p className="text-xs text-faint">Only today&apos;s totals are sent. You can delete the link&apos;s data any time by asking me, or make a new link if it ever leaks.</p>
      </div>
    </Sheet>
  );
}

function GoalsSheet({ open, goals, onClose, onSaved }: { open: boolean; goals: Goals; onClose: () => void; onSaved: (g: Goals) => void }) {
  const [g, setG] = useState(goals);
  useEffect(() => setG(goals), [goals, open]);
  const field = (k: keyof Goals, label: string, unit: string) => (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input
          inputMode="numeric"
          value={g[k] ?? ""}
          onChange={(e) => setG({ ...g, [k]: e.target.value ? Number(e.target.value) : null })}
          className="min-h-11 w-28 rounded-xl bg-surface-2 px-3 text-right text-base outline-none focus:ring-2 focus:ring-accent"
          placeholder="—"
        />
        <span className="w-8 text-xs text-muted">{unit}</span>
      </span>
    </label>
  );
  return (
    <Sheet open={open} title="Daily goals" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">All optional — leave any blank. Set whatever suits you (or what your GP or trainer suggests).</p>
        {field("kcal", "Calories", "kcal")}
        {field("protein", "Protein", "g")}
        {field("carbs", "Carbs", "g")}
        {field("fat", "Fat", "g")}
        {field("steps", "Steps", "")}
        <button
          className="btn btn-primary w-full"
          onClick={async () => {
            await createClient().from("nutrition_goals").upsert({ ...g, updated_at: new Date().toISOString() });
            onSaved(g);
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}
