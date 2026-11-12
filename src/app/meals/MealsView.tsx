"use client";

import { ChevronLeft, ChevronRight, ShoppingBasket, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { guessAisle } from "@/app/shopping/ShoppingView";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { Field, Sheet, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Slot = "breakfast" | "lunch" | "dinner";
type Meal = { id: string; day: string; slot: Slot; title: string; ingredients: string[] };
const SLOTS: { id: Slot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
];
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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]" aria-label="Previous week" onClick={() => setStart((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7))}>
          <ChevronLeft size={18} />
        </button>
        <p className="font-semibold">
          {days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
        <button className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]" aria-label="Next week" onClick={() => setStart((s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7))}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="stagger space-y-3">
        {days.map((d, i) => {
          const di = iso(d);
          return (
            <section key={di} className={`card p-4 ${di === todayIso ? "ring-2 ring-accent" : ""}`} style={{ "--i": i } as React.CSSProperties}>
              <p className="mb-2 text-sm font-semibold">
                {d.toLocaleDateString("en-GB", { weekday: "long" })} <span className="font-normal text-muted">{d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SLOTS.map((s) => {
                  const m = meals.find((x) => x.day === di && x.slot === s.id);
                  return (
                    <button key={s.id} onClick={() => setEdit({ day: di, slot: s.id, meal: m })} className={`min-h-16 rounded-xl p-2 text-left transition-transform active:scale-95 ${m ? "bg-accent-soft" : "border border-dashed border-line"}`}>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-faint">{s.label}</span>
                      <span className={`block text-sm leading-tight ${m ? "font-medium" : "text-faint"}`}>{m?.title ?? "+ Add"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <button className="btn btn-primary w-full" onClick={toShopping}>
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
