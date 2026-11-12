"use client";

import { ChevronLeft, ChevronRight, ShoppingBasket, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { guessAisle } from "@/app/shopping/ShoppingView";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { Field, Sheet, inputClass } from "@/components/ui";
import { DateStrip } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";

type Slot = "breakfast" | "lunch" | "dinner";
type Meal = { id: string; day: string; slot: Slot; title: string; ingredients: string[] };
const SLOTS: { id: Slot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
];
const CORAL = "#f26b6b";
const SLOT_ART: Record<Slot, string> = { breakfast: "🍳", lunch: "🥪", dinner: "🍲" };
/** Everyday meals with their shopping ingredients — used to fill the week automatically */
const LIBRARY: Record<Slot, { title: string; ingredients: string[] }[]> = {
  breakfast: [
    { title: "Porridge with banana", ingredients: ["Porridge oats", "Milk", "Bananas"] },
    { title: "Scrambled eggs on toast", ingredients: ["Eggs", "Bread", "Butter"] },
    { title: "Greek yoghurt & berries", ingredients: ["Greek yoghurt", "Frozen berries", "Honey"] },
    { title: "Bacon sandwich", ingredients: ["Bacon", "Bread", "Brown sauce"] },
    { title: "Cereal & fruit", ingredients: ["Cereal", "Milk", "Apples"] },
    { title: "Beans on toast", ingredients: ["Baked beans", "Bread"] },
    { title: "Full English", ingredients: ["Sausages", "Bacon", "Eggs", "Baked beans", "Mushrooms", "Bread"] },
  ],
  lunch: [
    { title: "Chicken wrap", ingredients: ["Tortilla wraps", "Cooked chicken", "Lettuce", "Mayonnaise"] },
    { title: "Tomato soup & roll", ingredients: ["Tomato soup", "Bread rolls"] },
    { title: "Tuna jacket potato", ingredients: ["Baking potatoes", "Tuna", "Sweetcorn", "Cheese"] },
    { title: "Ham & cheese toastie", ingredients: ["Bread", "Ham", "Cheese"] },
    { title: "Pasta salad", ingredients: ["Pasta", "Cherry tomatoes", "Cucumber", "Feta"] },
    { title: "Chicken Caesar salad", ingredients: ["Cooked chicken", "Lettuce", "Caesar dressing", "Croutons"] },
    { title: "Leftovers", ingredients: [] },
  ],
  dinner: [
    { title: "Spaghetti bolognese", ingredients: ["Beef mince", "Spaghetti", "Chopped tomatoes", "Onions", "Garlic"] },
    { title: "Chicken curry & rice", ingredients: ["Chicken breasts", "Curry paste", "Coconut milk", "Rice", "Onions"] },
    { title: "Chicken fajitas", ingredients: ["Chicken breasts", "Peppers", "Onions", "Tortilla wraps", "Fajita seasoning", "Sour cream"] },
    { title: "Sunday roast", ingredients: ["Whole chicken", "Potatoes", "Carrots", "Broccoli", "Gravy granules"] },
    { title: "Fish, chips & peas", ingredients: ["Breaded fish", "Oven chips", "Frozen peas"] },
    { title: "Stir fry", ingredients: ["Chicken breasts", "Stir fry vegetables", "Egg noodles", "Soy sauce"] },
    { title: "Chilli con carne", ingredients: ["Beef mince", "Kidney beans", "Chopped tomatoes", "Rice", "Chilli powder"] },
    { title: "Sausage & mash", ingredients: ["Sausages", "Potatoes", "Gravy granules", "Frozen peas"] },
    { title: "Homemade burgers", ingredients: ["Beef burgers", "Burger buns", "Cheese slices", "Lettuce", "Oven chips"] },
    { title: "Pasta bake", ingredients: ["Pasta", "Pasta bake sauce", "Cheese", "Cooked chicken"] },
  ],
};
const QUICK = ["Spag bol", "Chicken curry", "Fajitas", "Roast dinner", "Fish & chips", "Stir fry", "Chilli con carne", "Pasta bake", "Burgers", "Jacket potatoes", "Omelette", "Beans on toast"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monday = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

export function MealsView() {
  const { user, loading } = useAuth();
  const [start, setStart] = useState(() => monday(new Date()));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [edit, setEdit] = useState<{ day: string; slot: Slot; meal?: Meal } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selDay, setSelDay] = useState(() => iso(new Date()));

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), [start]);
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await createClient().from("meal_plan").select("*").gte("day", iso(days[0])).lte("day", iso(days[6]));
    setMeals((data as Meal[]) ?? []);
  }, [user, days]);
  useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to plan your meals." />;

  const toShopping = async () => {
    const all = meals.flatMap((m) => m.ingredients).map((s) => s.trim()).filter(Boolean);
    const uniq = [...new Map(all.map((s) => [s.toLowerCase(), s])).values()];
    if (!uniq.length) return setMsg("Add ingredients to your meals first (tap a meal).");
    const sb = createClient();
    let { data: lists } = await sb.from("shopping_lists").select("id").order("created_at").limit(1);
    if (!lists?.length) lists = (await sb.from("shopping_lists").insert({ name: "Weekly shop" }).select("id")).data ?? [];
    const { data: existing } = await sb.from("shopping_items").select("name").eq("list_id", lists[0].id).eq("checked", false);
    const have = new Set((existing ?? []).map((i) => i.name.toLowerCase()));
    const add = uniq.filter((s) => !have.has(s.toLowerCase()));
    if (add.length) await sb.from("shopping_items").insert(add.map((name) => ({ list_id: lists![0].id, name, quantity: 1, category: guessAisle(name) })));
    setMsg(add.length ? `Added ${add.length} item${add.length > 1 ? "s" : ""} to your shopping list.` : "Everything's already on your list.");
  };

  const todayIso = iso(new Date());
  const dayIsos = days.map(iso);
  const sel = dayIsos.includes(selDay) ? selDay : dayIsos.includes(todayIso) ? todayIso : dayIsos[0];

  const autoFill = async () => {
    const rows: { day: string; slot: Slot; title: string; ingredients: string[] }[] = [];
    const used = new Set(meals.map((m) => m.title));
    for (const di of dayIsos) {
      for (const sl of SLOTS) {
        if (meals.some((m) => m.day === di && m.slot === sl.id)) continue;
        const pool = LIBRARY[sl.id].filter((x) => !used.has(x.title));
        const pick = (pool.length ? pool : LIBRARY[sl.id])[Math.floor(Math.random() * (pool.length || LIBRARY[sl.id].length))];
        used.add(pick.title);
        rows.push({ day: di, slot: sl.id, title: pick.title, ingredients: pick.ingredients });
      }
    }
    if (!rows.length) return setMsg("Your week is already full — tap a meal to change it.");
    await createClient().from("meal_plan").insert(rows);
    setMsg(`Planned ${rows.length} meals. Tap any to swap it.`);
    load();
  };

  return (
    <div className="space-y-5" style={{ "--accent": CORAL, "--accent-soft": "rgb(242 107 107 / 0.12)" } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <button className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]" aria-label="Previous week" onClick={() => setStart((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7))}>
          <ChevronLeft size={18} />
        </button>
        <p className="text-lg font-bold">
          {days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
        <button className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]" aria-label="Next week" onClick={() => setStart((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7))}>
          <ChevronRight size={18} />
        </button>
      </div>

      <DateStrip
        days={dayIsos}
        value={sel}
        onChange={setSelDay}
        accent={CORAL}
        dots={Object.fromEntries(dayIsos.map((d) => [d, meals.filter((m) => m.day === d).map(() => CORAL)]))}
      />

      <div key={sel} className="stagger space-y-3">
        {SLOTS.map((sl, i) => {
          const m = meals.find((x) => x.day === sel && x.slot === sl.id);
          return (
            <button
              key={sl.id}
              onClick={() => setEdit({ day: sel, slot: sl.id, meal: m })}
              style={{ "--i": i } as React.CSSProperties}
              className={`flex w-full items-stretch overflow-hidden rounded-[1.6rem] bg-surface text-left transition-transform duration-300 active:scale-[0.98] ${m ? "shadow-[0_14px_34px_-18px_rgb(0_0_0/0.35)]" : "shadow-[var(--shadow)]"}`}
            >
              <span className="grid w-24 shrink-0 place-items-center border-r border-line text-4xl">{SLOT_ART[sl.id]}</span>
              <span className="min-w-0 flex-1 p-4">
                <span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--accent-soft)", color: CORAL }}>
                  {sl.label}
                </span>
                <span className={`mt-1.5 block truncate text-lg font-bold ${m ? "" : "text-faint"}`}>{m?.title ?? "Nothing planned"}</span>
                <span className="block truncate text-sm text-muted">{m ? (m.ingredients.length ? `${m.ingredients.length} ingredients` : "No shopping needed") : "Tap to add a meal"}</span>
              </span>
              <span className="grid w-12 shrink-0 place-items-start pt-4">
                <span className={`grid size-8 place-items-center rounded-full text-lg leading-none ${m ? "border-2 text-[var(--accent)]" : "text-white"}`} style={m ? { borderColor: CORAL } : { background: CORAL }}>
                  {m ? "✎" : "+"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button className="btn w-full text-white" style={{ background: CORAL, boxShadow: `0 14px 30px -14px ${CORAL}` }} onClick={autoFill}>
        Generate meal plan automatically
      </button>
      <button className="btn btn-ghost w-full" onClick={toShopping}>
        <ShoppingBasket size={16} /> Add this week&apos;s ingredients to my shopping list
      </button>
      {msg && <p className="text-center text-sm text-muted">{msg}</p>}

      <MealSheet value={edit} onClose={() => setEdit(null)} onSaved={load} />
    </div>
  );
}

function MealSheet({ value, onClose, onSaved }: { value: { day: string; slot: Slot; meal?: Meal } | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [k, setK] = useState("");
  const key = value ? `${value.day}-${value.slot}` : "";
  if (key !== k) {
    setK(key);
    setTitle(value?.meal?.title ?? "");
    setIngredients(value?.meal?.ingredients.join("\n") ?? "");
  }
  const save = async () => {
    if (!value || !title.trim()) return;
    await createClient()
      .from("meal_plan")
      .upsert({ day: value.day, slot: value.slot, title: title.trim(), ingredients: ingredients.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean) }, { onConflict: "user_id,day,slot" });
    onSaved();
    onClose();
  };
  const remove = async () => {
    if (!value?.meal) return;
    await createClient().from("meal_plan").delete().eq("id", value.meal.id);
    onSaved();
    onClose();
  };
  return (
    <Sheet open={!!value} title={value ? `${value.slot[0].toUpperCase()}${value.slot.slice(1)} · ${new Date(`${value.day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}` : ""} onClose={onClose}>
      <Field label="Meal">
        <input autoFocus className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chicken curry" />
      </Field>
      {!title && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} className="chip min-h-8 px-2.5!" onClick={() => setTitle(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <Field label="Ingredients to buy (one per line or comma-separated)" className="mt-3">
        <textarea className={`${inputClass} min-h-28`} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"Chicken breasts\nRice\nCurry paste"} />
      </Field>
      <div className="mt-4 flex gap-2">
        {value?.meal && (
          <button className="btn btn-ghost text-red-500!" onClick={remove} aria-label="Remove meal">
            <Trash2 size={16} />
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={!title.trim()} onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  );
}
