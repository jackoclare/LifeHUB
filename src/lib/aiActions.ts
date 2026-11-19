"use client";

import { createClient } from "@/lib/supabase/client";
import { guessAisle } from "@/app/shopping/ShoppingView";

/**
 * Things the AI can put into LifeHub for you ("dentist Tuesday 3pm, and add milk and bread").
 * The AI suggests them (validated on the server); they're saved here with your own sign-in,
 * so the usual privacy rules apply, and each one can be undone.
 */
export type AiAction =
  | { type: "calendar"; title: string; date: string; time?: string | null; kind?: "personal" | "reminder" | "travel" }
  | { type: "shopping"; items: { name: string; quantity?: number }[] }
  | { type: "wishlist"; name: string; target_price?: number | null }
  | { type: "meal"; day: string; slot: "breakfast" | "lunch" | "dinner"; title: string; ingredients?: string[] }
  | { type: "homejob"; name: string; next_due?: string | null; every_days?: number | null };

export type ActionResult = { ok: boolean; icon: string; label: string; href: string; table?: string; ids?: string[]; error?: string };

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const t12 = (t?: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return ` ${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
};

export async function runActions(actions: AiAction[]): Promise<ActionResult[]> {
  const sb = createClient();
  const out: ActionResult[] = [];
  for (const a of actions) {
    try {
      if (a.type === "calendar") {
        const { data, error } = await sb.from("calendar_events").insert({ title: a.title, event_date: a.date, event_time: a.time || null, kind: a.kind ?? "personal" }).select("id");
        if (error) throw error;
        out.push({ ok: true, icon: a.kind === "reminder" ? "⏰" : "📅", label: `${a.title} · ${day(a.date)}${t12(a.time)}`, href: "/calendar", table: "calendar_events", ids: (data ?? []).map((r) => r.id) });
      } else if (a.type === "shopping") {
        let { data: lists } = await sb.from("shopping_lists").select("id,name").order("created_at");
        if (!lists?.length) lists = (await sb.from("shopping_lists").insert({ name: "Weekly shop" }).select("id,name")).data ?? [];
        const list = lists?.[0];
        if (!list) throw new Error("No shopping list");
        const { data, error } = await sb
          .from("shopping_items")
          .insert(a.items.map((i) => ({ list_id: list.id, name: i.name, quantity: Math.max(1, i.quantity ?? 1), category: guessAisle(i.name) })))
          .select("id");
        if (error) throw error;
        out.push({ ok: true, icon: "🛒", label: `${a.items.map((i) => ((i.quantity ?? 1) > 1 ? `${i.quantity} ${i.name}` : i.name)).join(", ")} → ${list.name}`, href: "/shopping", table: "shopping_items", ids: (data ?? []).map((r) => r.id) });
      } else if (a.type === "wishlist") {
        const { data, error } = await sb.from("wishlist_items").insert({ name: a.name, priority: 2, target_price: a.target_price ?? null }).select("id");
        if (error) throw error;
        out.push({ ok: true, icon: "🎁", label: `${a.name} → wish list`, href: "/wishlist", table: "wishlist_items", ids: (data ?? []).map((r) => r.id) });
      } else if (a.type === "meal") {
        const { data, error } = await sb.from("meal_plan").insert({ day: a.day, slot: a.slot, title: a.title, ingredients: a.ingredients ?? [] }).select("id");
        if (error) throw error;
        out.push({ ok: true, icon: "🍽️", label: `${a.title} · ${day(a.day)} ${a.slot}`, href: "/meals", table: "meal_plan", ids: (data ?? []).map((r) => r.id) });
      } else if (a.type === "homejob") {
        const { data, error } = await sb.from("home_tasks").insert({ name: a.name, next_due: a.next_due ?? null, every_days: a.every_days ?? null }).select("id");
        if (error) throw error;
        out.push({ ok: true, icon: "🏠", label: `${a.name}${a.next_due ? ` · ${day(a.next_due)}` : ""}`, href: "/home", table: "home_tasks", ids: (data ?? []).map((r) => r.id) });
      }
    } catch (e) {
      out.push({ ok: false, icon: "⚠️", label: `Couldn't add ${"title" in a ? a.title : "name" in a ? a.name : "that"}`, href: "/", error: (e as Error).message });
    }
  }
  return out;
}

export async function undoAction(r: ActionResult) {
  if (!r.table || !r.ids?.length) return;
  await createClient().from(r.table).delete().in("id", r.ids);
}
