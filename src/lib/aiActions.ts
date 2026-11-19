"use client";

import { createClient } from "@/lib/supabase/client";
import { guessAisle } from "@/app/shopping/ShoppingView";
import { guessCourier } from "@/app/parcels/ParcelsView";
import { readPrefs, updatePrefs, type PackingList } from "@/lib/prefs";

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
  | { type: "homejob"; name: string; next_due?: string | null; every_days?: number | null }
  | { type: "birthday"; name: string; date: string; year?: number | null }
  | { type: "parcel"; number: string; label?: string }
  | { type: "warranty"; item: string; shop?: string | null; return_days?: number | null; warranty_years?: number | null }
  | { type: "habit"; name: string }
  | { type: "parking"; minutes: number | null }
  | { type: "packing"; place: string; start?: string | null; days: number }
  | { type: "activity"; kind: "walk" | "run" };

export type ActionResult = { ok: boolean; icon: string; label: string; href: string; table?: string; ids?: string[]; error?: string; pref?: { key: "birthdays" | "parcels" | "warranties" | "packing"; id: string }; go?: string };

const ukDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
const uid = () => crypto.randomUUID();

async function callAi(body: Record<string, unknown>) {
  const sb = createClient();
  const token = (await sb.auth.getSession()).data.session?.access_token;
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
    body: JSON.stringify(body),
  });
  return r.json();
}

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
      else if (a.type === "birthday") {
        const id = uid();
        const p = readPrefs();
        await updatePrefs({ birthdays: [...(p.birthdays ?? []), { id, name: a.name, date: a.date, year: a.year ?? null }] });
        const [m, d] = a.date.split("-").map(Number);
        out.push({ ok: true, icon: "🎂", label: `${a.name}'s birthday · ${new Date(2000, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`, href: "/birthdays", pref: { key: "birthdays", id } });
      } else if (a.type === "parcel") {
        const id = uid();
        const p = readPrefs();
        await updatePrefs({ parcels: [{ id, number: a.number, courier: guessCourier(a.number), label: a.label || "Parcel", added: new Date().toISOString() }, ...(p.parcels ?? [])] });
        out.push({ ok: true, icon: "📦", label: `Tracking ${a.label || "parcel"} · ${a.number}`, href: "/parcels", pref: { key: "parcels", id } });
      } else if (a.type === "warranty") {
        const id = uid();
        const bought = ukDay();
        const p = readPrefs();
        const returnBy = a.return_days ? ukDay(new Date(Date.now() + a.return_days * 86400e3)) : null;
        const warrantyUntil = a.warranty_years ? `${Number(bought.slice(0, 4)) + a.warranty_years}${bought.slice(4)}` : null;
        await updatePrefs({ warranties: [...(p.warranties ?? []), { id, item: a.item, shop: a.shop ?? undefined, bought, returnBy, warrantyUntil }] });
        out.push({ ok: true, icon: "🧾", label: `${a.item}${returnBy ? ` · return by ${day(returnBy)}` : ""}`, href: "/warranties", pref: { key: "warranties", id } });
      } else if (a.type === "habit") {
        const p = readPrefs();
        const today = ukDay();
        const habits = p.habits ?? [];
        const found = habits.find((h) => h.name.toLowerCase().includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(h.name.toLowerCase()));
        const next = found ? habits.map((h) => (h.id === found.id && !h.done.includes(today) ? { ...h, done: [today, ...h.done] } : h)) : [...habits, { id: uid(), name: a.name, emoji: "✅", done: [today] }];
        await updatePrefs({ habits: next });
        out.push({ ok: true, icon: "🔥", label: `${found?.name ?? a.name} ticked for today`, href: "/habits" });
      } else if (a.type === "parking") {
        const pos = await new Promise<GeolocationPosition | null>((res) => (navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 8000 }) : res(null)));
        const started = new Date();
        await updatePrefs({ parking: { started: started.toISOString(), expires: a.minutes ? new Date(started.getTime() + a.minutes * 60e3).toISOString() : null, ...(pos ? { lat: pos.coords.latitude, lon: pos.coords.longitude } : {}) } });
        out.push({ ok: true, icon: "🅿️", label: a.minutes ? `Parking timer · ${a.minutes >= 60 ? `${a.minutes / 60} hr` : `${a.minutes} min`}` : "Saved where you parked", href: "/parking" });
      } else if (a.type === "packing") {
        const r = await callAi({ mode: "packing", place: a.place, start: a.start ?? null, days: a.days });
        if (r.error || !r.sections?.length) throw new Error(r.error ?? "No list");
        const id = uid();
        const list: PackingList = { id, place: a.place, start: a.start ?? null, days: a.days, weather: r.weather ?? "", items: (r.sections as { title: string; items: string[] }[]).flatMap((s) => s.items.map((text) => ({ id: uid(), text, section: s.title, done: false }))) };
        await updatePrefs({ packing: [list, ...(readPrefs().packing ?? [])].slice(0, 10) });
        out.push({ ok: true, icon: "🧳", label: `Packing list · ${a.place}, ${a.days} days (${list.items.length} items)`, href: "/packing", pref: { key: "packing", id } });
      } else if (a.type === "activity") {
        out.push({ ok: true, icon: a.kind === "run" ? "🏃" : "🚶", label: `Starting your ${a.kind}…`, href: `/move?start=${a.kind}`, go: `/move?start=${a.kind}` });
      }
    } catch (e) {
      out.push({ ok: false, icon: "⚠️", label: `Couldn't add ${"title" in a ? a.title : "name" in a ? a.name : "that"}`, href: "/", error: (e as Error).message });
    }
  }
  return out;
}

export async function undoAction(r: ActionResult) {
  if (r.pref) {
    const p = readPrefs();
    const list = (p[r.pref.key] ?? []) as { id: string }[];
    await updatePrefs({ [r.pref.key]: list.filter((x) => x.id !== r.pref!.id) } as Parameters<typeof updatePrefs>[0]);
    return;
  }
  if (!r.table || !r.ids?.length) return;
  await createClient().from(r.table).delete().in("id", r.ids);
}
