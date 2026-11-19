// LifeHub AI — free models only, no card needed.
//   Main:   Groq (console.groq.com) free plan — fast open models, doesn't train on your data.  Secret: GROQ_API_KEY
//   Backup: Google Gemini free tier (aistudio.google.com), used only if Groq is busy.        Secret: GEMINI_API_KEY (optional)
//           Note: Google may use free-tier prompts to improve its products.
// Optional overrides: GROQ_CHAT_MODEL, GROQ_VISION_MODEL, GEMINI_MODEL.
// Signed-in users only; a daily cap keeps it inside the free limits.
// Each chat includes a short read-only summary of the person's own LifeHub data (calendar, bills, meals, car, jobs, lists).
import { createClient } from "npm:@supabase/supabase-js@2";

const GROQ_KEY = (Deno.env.get("GROQ_API_KEY") ?? "").trim();
const GEMINI_KEY = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
const MAX_CHATS = 200;

// Preferred models, best first. If Groq retires one, the first available match from its live model list is used.
const CHAT_PREFS = [Deno.env.get("GROQ_CHAT_MODEL"), "openai/gpt-oss-120b", "moonshotai/kimi-k2", "qwen/qwen3", "llama-3.3-70b"].filter(Boolean) as string[];
const VISION_PREFS = [Deno.env.get("GROQ_VISION_MODEL"), "qwen/qwen3.8-27b", "meta-llama/llama-4-maverick", "meta-llama/llama-4-scout"].filter(Boolean) as string[];
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Msg = { role: "user" | "assistant"; text: string; image?: string };
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function bump(userId: string) {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const { data } = await admin.from("ai_usage").select("chats,images").eq("user_id", userId).eq("day", day).maybeSingle();
  const used = (data?.chats as number | undefined) ?? 0;
  if (used >= MAX_CHATS) return false;
  await admin.from("ai_usage").upsert({ user_id: userId, day, chats: used + 1, images: data?.images ?? 0 });
  return true;
}

let groqModels: { at: number; ids: string[] } | null = null;
async function pickGroqModel(prefs: string[], refresh = false): Promise<string> {
  if (refresh || !groqModels || Date.now() - groqModels.at > 6 * 3600e3) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${GROQ_KEY}` } });
      const j = await r.json();
      groqModels = { at: Date.now(), ids: ((j?.data ?? []) as { id: string; active?: boolean }[]).filter((m) => m.active !== false).map((m) => m.id) };
    } catch {
      groqModels = { at: Date.now(), ids: [] };
    }
  }
  for (const p of prefs) {
    const hit = groqModels.ids.find((id) => id === p) ?? groqModels.ids.find((id) => id.startsWith(p));
    if (hit) return hit;
  }
  return prefs[0];
}

// A compact, read-only snapshot of the person's own LifeHub data, so the AI can answer "what have I got on?" etc.
async function lifeContext(userId: string) {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const now = new Date();
  const today = day(now);
  const in14 = day(new Date(now.getTime() + 14 * 86400e3));
  const in30 = day(new Date(now.getTime() + 30 * 86400e3));
  const weekAgo = day(new Date(now.getTime() - 1 * 86400e3));
  const q = <T>(p: PromiseLike<{ data: T | null }>) => Promise.resolve(p).then((r) => r.data).catch(() => null);
  const [events, bills, meals, cars, jobs, settings, money, goals, shopping, wishes] = await Promise.all([
    q(admin.from("calendar_events").select("title,event_date,event_time,kind").eq("user_id", userId).gte("event_date", today).lte("event_date", in14).order("event_date").limit(25)),
    q(admin.from("bills").select("name,amount,frequency,next_due_date,category").eq("user_id", userId).eq("is_active", true).order("next_due_date").limit(30)),
    q(admin.from("meal_plan").select("day,slot,title").eq("user_id", userId).gte("day", weekAgo).lte("day", in14).order("day").limit(40)),
    q(admin.from("vehicles").select("nickname,make,model,reg,mot_due,tax_due,insurance_due,service_due,mileage").eq("user_id", userId).limit(5)),
    q(admin.from("home_tasks").select("name,area,next_due,every_days").eq("user_id", userId).lte("next_due", in14).order("next_due").limit(15)),
    q(admin.from("user_settings").select("prefs").eq("user_id", userId).maybeSingle()),
    q(admin.from("finance_profile").select("monthly_income,payday").eq("user_id", userId).maybeSingle()),
    q(admin.from("savings_goals").select("name,target,saved,target_date").eq("user_id", userId).limit(10)),
    q(admin.from("shopping_items").select("name,quantity,checked").eq("user_id", userId).eq("checked", false).limit(40)),
    q(admin.from("wishlist_items").select("name,current_price,target_price").eq("user_id", userId).eq("purchased", false).limit(15)),
  ]);
  const lines: string[] = [];
  const list = <T>(label: string, rows: T[] | null | undefined, f: (r: T) => string) => {
    if (rows?.length) lines.push(`${label}:\n${rows.map((r) => `- ${f(r)}`).join("\n")}`);
  };
  type R = Record<string, unknown>;
  list("Calendar (next 14 days)", events as R[], (e) => `${e.event_date}${e.event_time ? " " + String(e.event_time).slice(0, 5) : ""} ${e.title} (${e.kind})`);
  list("Bills", bills as R[], (b) => `${b.name}: £${Number(b.amount).toFixed(2)} ${b.frequency}, next due ${b.next_due_date}${b.category ? `, ${b.category}` : ""}`);
  list("Meal plan", meals as R[], (m) => `${m.day} ${m.slot}: ${m.title}`);
  list("Vehicles", cars as R[], (v) => `${[v.nickname, v.make, v.model, v.reg].filter(Boolean).join(" ")} — MOT ${v.mot_due ?? "?"}, tax ${v.tax_due ?? "?"}, insurance ${v.insurance_due ?? "?"}, service ${v.service_due ?? "?"}`);
  list("Household jobs due", jobs as R[], (j) => `${j.name} (${j.area ?? "home"}) due ${j.next_due}`);
  list("Savings goals", goals as R[], (g) => `${g.name}: £${g.saved ?? 0} of £${g.target}${g.target_date ? ` by ${g.target_date}` : ""}`);
  list("Shopping list (not yet bought)", shopping as R[], (i) => `${i.name}${Number(i.quantity) > 1 ? ` x${i.quantity}` : ""}`);
  list("Wish list", wishes as R[], (w) => `${w.name}${w.current_price ? ` now £${w.current_price}` : ""}${w.target_price ? ` (target £${w.target_price})` : ""}`);
  const m = money as R | null;
  if (m?.monthly_income || m?.payday) lines.push(`Money: income £${m.monthly_income ?? "?"} a month, payday day ${m.payday ?? "?"}`);
  const p = (settings as { prefs?: R } | null)?.prefs;
  if (p) {
    const teams = ((p.teams as { name?: string }[] | undefined) ?? []).map((t) => t.name).filter(Boolean).join(", ");
    lines.push(`Preferences: ${[teams && `teams ${teams}`, p.airport && `home airport ${p.airport}`, p.supermarket && `supermarket ${p.supermarket}`, (p.diet as string[] | undefined)?.length && `diet ${(p.diet as string[]).join(", ")}`].filter(Boolean).join("; ")}`);
  }
  // Next fixtures for favourite teams (TheSportsDB free key)
  const teamIds = ((p?.teams as { id?: string }[] | undefined) ?? []).map((t) => String(t.id)).filter((id) => /^\d{3,9}$/.test(id)).slice(0, 4);
  const fixtures: string[] = [];
  const seen = new Set<string>();
  await Promise.all(
    (teamIds.length ? teamIds : ["133601", "133914"]).map(async (id) => {
      try {
        const r = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${id}`, { signal: AbortSignal.timeout(4000) });
        for (const e of ((await r.json())?.events ?? []).slice(0, 2) as Record<string, string>[]) {
          if (seen.has(e.idEvent)) continue;
          seen.add(e.idEvent);
          const ts = e.strTimestamp ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`) : null;
          const when = ts ? ts.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : e.dateEvent;
          fixtures.push(`${when}: ${e.strHomeTeam} (home) v ${e.strAwayTeam} (away) — ${e.strLeague}${e.strVenue ? `, at ${e.strVenue}` : ""}`);
        }
      } catch {
        /* feed slow — skip */
      }
    }),
  );
  if (fixtures.length) lines.push(`Upcoming matches for his teams:\n${fixtures.map((f) => `- ${f}`).join("\n")}`);
  return lines.join("\n\n").slice(0, 6500);
}

async function chatCall(base: string, key: string, model: string, messages: unknown[], opts: { json?: boolean; maxTokens?: number } = {}) {
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens ?? 1200, temperature: 0.6, ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, j?.error?.message ?? `AI error ${r.status}`);
  const text = j?.choices?.[0]?.message?.content ?? "";
  return String(text).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/* ---------- Actions: the AI can put things into LifeHub ("dentist Tuesday 3pm and add milk") ---------- */

const ACTIONS_GUIDE = (iso: string) => `ADDING THINGS: when Jack asks you to add, put, book in, schedule, plan, remember or remind him about something, do it. At the very END of your reply add one line:
<actions>[ ...JSON objects... ]</actions>
Allowed objects (use only these):
{"type":"calendar","title":"Dentist","date":"YYYY-MM-DD","time":"HH:MM" or null,"kind":"personal"|"reminder"|"travel"}   — appointments, plans, events; "remind me to…" = kind "reminder" (default time 09:00 if he gives none for a reminder)
{"type":"shopping","items":[{"name":"Milk","quantity":1}]}   — anything to buy at the shops / groceries
{"type":"wishlist","name":"PS5 Pro","target_price":number or null}   — things he wants to buy one day / gift ideas
{"type":"meal","day":"YYYY-MM-DD","slot":"breakfast"|"lunch"|"dinner","title":"Spag bol","ingredients":["mince","spaghetti"]}   — meals for a day
{"type":"homejob","name":"Clean the oven","next_due":"YYYY-MM-DD" or null,"every_days":number or null}   — chores around the house
{"type":"birthday","name":"Mum","date":"MM-DD","year":number or null}   — someone's birthday
{"type":"parcel","number":"tracking number exactly as said, no spaces","label":"what it is"}   — track a parcel
{"type":"warranty","item":"Air fryer","shop":"Argos" or null,"return_days":30 or null,"warranty_years":1 or null}   — something he bought, to remember returns/warranty
{"type":"habit","name":"Gym"}   — he did a habit today ("I went to the gym", "done my 10k steps")
{"type":"parking","minutes":120 or null}   — he's just parked (null = no time limit)
{"type":"packing","place":"Málaga","start":"YYYY-MM-DD" or null,"days":4}   — he's going away and wants a packing list
{"type":"activity","kind":"walk"|"run"}   — he's starting a walk or run now (opens the tracker)
Today is ${iso}. Coming days: ${nextDays(iso)}. Work out real dates from that list ("Tuesday" = the next Tuesday, "tomorrow", "next Friday"). Split one sentence into several objects if he mentions several things, each in the right place. Capitalise names nicely. In the visible reply just confirm in a few friendly words what you've added (no JSON, no dates in YYYY-MM-DD). Never add actions for questions, and never invent things he didn't ask for.`;

const nextDays = (from: string) =>
  Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return `${d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} ${d.toISOString().slice(0, 10)}`;
  }).join(", ");
const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const hm = (v: unknown) => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, "0") : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function splitActions(raw: string): { text: string; actions: Record<string, unknown>[] } {
  const m = raw.match(/<actions>([\s\S]*?)<\/actions>/i);
  if (!m) return { text: raw, actions: [] };
  const text = raw.replace(m[0], "").trim();
  let list: unknown = [];
  try {
    const inner = m[1].trim().replace(/^```(?:json)?|```$/g, "");
    list = JSON.parse(inner);
  } catch {
    return { text, actions: [] };
  }
  const out: Record<string, unknown>[] = [];
  for (const a of (Array.isArray(list) ? list : [list]).slice(0, 12) as Record<string, unknown>[]) {
    if (!a || typeof a !== "object") continue;
    if (a.type === "calendar" && str(a.title, 200) && iso(a.date)) out.push({ type: "calendar", title: str(a.title, 200), date: iso(a.date), time: hm(a.time), kind: ["personal", "reminder", "travel"].includes(String(a.kind)) ? a.kind : "personal" });
    else if (a.type === "shopping" && Array.isArray(a.items)) {
      const items = (a.items as Record<string, unknown>[]).map((i) => ({ name: str(i?.name, 120), quantity: Math.min(99, Math.max(1, Math.round(Number(i?.quantity) || 1))) })).filter((i) => i.name).slice(0, 30);
      if (items.length) out.push({ type: "shopping", items });
    } else if (a.type === "wishlist" && str(a.name, 120)) out.push({ type: "wishlist", name: str(a.name, 120), target_price: Number(a.target_price) > 0 ? Math.round(Number(a.target_price) * 100) / 100 : null });
    else if (a.type === "meal" && iso(a.day) && ["breakfast", "lunch", "dinner"].includes(String(a.slot)) && str(a.title, 120))
      out.push({ type: "meal", day: iso(a.day), slot: a.slot, title: str(a.title, 120), ingredients: (Array.isArray(a.ingredients) ? a.ingredients : []).map((x) => str(x, 50)).filter(Boolean).slice(0, 15) });
    else if (a.type === "birthday" && str(a.name, 80) && /^\d{2}-\d{2}$/.test(String(a.date))) out.push({ type: "birthday", name: str(a.name, 80), date: a.date, year: Number(a.year) > 1900 && Number(a.year) < 2100 ? Math.round(Number(a.year)) : null });
    else if (a.type === "parcel" && /^[A-Z0-9]{6,40}$/i.test(String(a.number ?? "").replace(/[\s-]/g, ""))) out.push({ type: "parcel", number: String(a.number).replace(/[\s-]/g, "").toUpperCase(), label: str(a.label, 60) || "Parcel" });
    else if (a.type === "warranty" && str(a.item, 120)) out.push({ type: "warranty", item: str(a.item, 120), shop: str(a.shop, 60) || null, return_days: Number(a.return_days) > 0 ? Math.min(730, Math.round(Number(a.return_days))) : null, warranty_years: Number(a.warranty_years) > 0 ? Math.min(25, Math.round(Number(a.warranty_years))) : null });
    else if (a.type === "habit" && str(a.name, 60)) out.push({ type: "habit", name: str(a.name, 60) });
    else if (a.type === "parking") out.push({ type: "parking", minutes: Number(a.minutes) > 0 ? Math.min(1440, Math.round(Number(a.minutes))) : null });
    else if (a.type === "packing" && str(a.place, 80)) out.push({ type: "packing", place: str(a.place, 80), start: iso(a.start), days: Math.min(30, Math.max(1, Math.round(Number(a.days) || 3))) });
    else if (a.type === "activity" && ["walk", "run"].includes(String(a.kind))) out.push({ type: "activity", kind: a.kind });
    else if (a.type === "homejob" && str(a.name, 120)) out.push({ type: "homejob", name: str(a.name, 120), next_due: iso(a.next_due), every_days: Number(a.every_days) > 0 ? Math.min(3650, Math.round(Number(a.every_days))) : null });
  }
  return { text, actions: out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const configured = GROQ_KEY.length > 20 || GEMINI_KEY.length > 20;
  if (req.method === "GET") return json({ configured, provider: GROQ_KEY ? "groq" : GEMINI_KEY ? "gemini" : null, backup: Boolean(GROQ_KEY && GEMINI_KEY), images: false });
  if (!configured) return json({ error: "AI isn't switched on yet — it needs a free Groq key (GROQ_API_KEY) in Supabase secrets." }, 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Please unlock the app with your PIN first." }, 401);

  let body: { mode?: string; messages?: Msg[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (body.mode === "image") return json({ error: "Creating and editing pictures isn't available on the free AI. You can still send a photo and ask about it." }, 400);

  // ---- Packing list: checks the forecast at the destination, then builds a checklist (JSON out)
  if (body.mode === "packing") {
    const b = body as { place?: string; start?: string; days?: number; notes?: string };
    const place = String(b.place ?? "").trim().slice(0, 80);
    const days = Math.min(30, Math.max(1, Math.round(Number(b.days) || 3)));
    const start = typeof b.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.start) ? b.start : null;
    if (!place) return json({ error: "Where are you going?" }, 400);
    if (!(await bump(user.id))) return json({ error: `Daily AI limit reached (${MAX_CHATS}). Try again tomorrow.` }, 429);
    let weather = "";
    try {
      const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en`, { signal: AbortSignal.timeout(6000) })).json();
      const loc = g?.results?.[0];
      if (loc) {
        const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`, { signal: AbortSignal.timeout(6000) })).json();
        const dates = (w?.daily?.time ?? []) as string[];
        const from = start ?? dates[0];
        const idx = dates.map((d, i) => (d >= from ? i : -1)).filter((i) => i >= 0).slice(0, days);
        if (idx.length) {
          const hi = Math.round(Math.max(...idx.map((i) => w.daily.temperature_2m_max[i])));
          const lo = Math.round(Math.min(...idx.map((i) => w.daily.temperature_2m_min[i])));
          const wet = idx.filter((i) => w.daily.precipitation_probability_max[i] >= 50).length;
          weather = `Forecast for ${loc.name}${loc.country ? `, ${loc.country}` : ""}: ${lo}–${hi}°C, ${wet ? `rain likely on ${wet} of ${idx.length} days` : "mostly dry"}${idx.length < days ? " (forecast only covers part of the trip)" : ""}.`;
        } else weather = `${loc.name}${loc.country ? `, ${loc.country}` : ""} — too far ahead for a forecast; use typical weather for the time of year.`;
      }
    } catch {
      /* no forecast — the AI uses typical weather */
    }
    const prompt = `Make a practical packing list for Jack (from Shrewsbury, UK) going to ${place} for ${days} day${days > 1 ? "s" : ""}${start ? ` from ${start}` : ""}. ${weather || "No forecast available — use the typical weather for that time of year."}${b.notes ? ` Notes: ${String(b.notes).slice(0, 200)}.` : ""}
Group into sections like Documents & money, Clothes, Toiletries, Tech, Health, Extras. Give clothing quantities for the trip length (e.g. "4 × T-shirts"). Include a UK→destination plug adapter if needed, passport/EHIC-GHIC if abroad. 25–45 items total.
Reply with JSON only: {"weather":"one friendly line about the weather to expect","sections":[{"title":"Clothes","items":["..."]}]}`;
    const msgsP = [{ role: "system", content: "You are a practical travel packing assistant. Output valid JSON only." }, { role: "user", content: prompt }];
    try {
      const t = GROQ_KEY
        ? await chatCall("https://api.groq.com/openai/v1", GROQ_KEY, await pickGroqModel(CHAT_PREFS), msgsP, { json: true, maxTokens: 2000 })
        : await chatCall("https://generativelanguage.googleapis.com/v1beta/openai", GEMINI_KEY, GEMINI_MODEL, msgsP, { json: true, maxTokens: 2000 });
      const m = t.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m ? m[0] : t);
      const sections = ((j.sections ?? []) as { title?: string; items?: unknown[] }[])
        .map((x) => ({ title: String(x.title ?? "Extras").slice(0, 40), items: (Array.isArray(x.items) ? x.items : []).map((i) => String(i).trim().slice(0, 80)).filter(Boolean).slice(0, 20) }))
        .filter((x) => x.items.length)
        .slice(0, 8);
      return json({ weather: String(j.weather ?? weather).slice(0, 200) || weather, sections });
    } catch (e) {
      return json({ error: `Couldn't build the list (${(e as Error).message.slice(0, 100)}).` }, 502);
    }
  }

  // ---- Daily pub quiz: 5 multiple-choice questions (JSON out)
  if (body.mode === "quiz") {
    if (!(await bump(user.id))) return json({ error: `Daily AI limit reached (${MAX_CHATS}). Try again tomorrow.` }, 429);
    const date = String((body as { date?: string }).date ?? "").slice(0, 10);
    const prompt = `Write today's (${date}) 5-question pub quiz for Jack, a UK football fan who supports Aston Villa.
Exactly 5 questions: 1) Aston Villa history or famous players, 2) English football / Premier League history, 3) world football or another sport, 4) UK general knowledge or geography, 5) film, TV or music.
Rules: only well-established facts you are certain of (nothing from the last 12 months, no current squads, managers or league positions); 4 options each, one clearly correct; medium difficulty; vary the questions (use the date as inspiration so each day is different).
Reply with JSON only: {"questions":[{"topic":"Villa","q":"...","options":["A","B","C","D"],"answer":0,"explain":"one short sentence"}]} — answer is the index 0–3 of the correct option.`;
    const msgsQ = [{ role: "system", content: "You write accurate, fun pub-quiz questions. Output valid JSON only." }, { role: "user", content: prompt }];
    try {
      const t = GROQ_KEY
        ? await chatCall("https://api.groq.com/openai/v1", GROQ_KEY, await pickGroqModel(CHAT_PREFS), msgsQ, { json: true, maxTokens: 1800 })
        : await chatCall("https://generativelanguage.googleapis.com/v1beta/openai", GEMINI_KEY, GEMINI_MODEL, msgsQ, { json: true, maxTokens: 1800 });
      const m = t.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m ? m[0] : t);
      const questions = ((j.questions ?? []) as Record<string, unknown>[])
        .filter((x) => typeof x.q === "string" && Array.isArray(x.options) && (x.options as unknown[]).length === 4 && Number.isInteger(Number(x.answer)) && Number(x.answer) >= 0 && Number(x.answer) <= 3)
        .slice(0, 5)
        .map((x) => {
          // shuffle the options so the right answer isn't always in the same place
          const opts = (x.options as unknown[]).map((o, i) => ({ o: String(o).slice(0, 100), right: i === Number(x.answer) }));
          for (let i = opts.length - 1; i > 0; i--) {
            const k = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[k]] = [opts[k], opts[i]];
          }
          return { topic: String(x.topic ?? "General").slice(0, 30), q: String(x.q).slice(0, 300), options: opts.map((y) => y.o), answer: opts.findIndex((y) => y.right), explain: String(x.explain ?? "").slice(0, 200) };
        });
      if (questions.length < 3) return json({ error: "The quiz came out wrong — try again." }, 502);
      return json({ questions });
    } catch (e) {
      return json({ error: `Couldn't write the quiz (${(e as Error).message.slice(0, 100)}).` }, 502);
    }
  }

  // ---- Voice notes → text (Groq Whisper, free). Works in the iPhone Home Screen app, unlike the browser's speech recognition.
  if (body.mode === "transcribe") {
    const audio = String((body as { audio?: string }).audio ?? "");
    const m = audio.match(/^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/i);
    if (!m || audio.length > 9_000_000) return json({ error: "Send a short voice note (up to a minute)." }, 400);
    if (!GROQ_KEY) return json({ error: "Voice needs the Groq key." }, 503);
    if (!(await bump(user.id))) return json({ error: `Daily AI limit reached (${MAX_CHATS}). Try again tomorrow.` }, 429);
    const mime = m[1].toLowerCase();
    const ext = /mp4|m4a|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : /wav/.test(mime) ? "wav" : /mpeg|mp3/.test(mime) ? "mp3" : "webm";
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: mime }), `voice.${ext}`);
    fd.append("model", Deno.env.get("GROQ_WHISPER_MODEL") ?? "whisper-large-v3-turbo");
    fd.append("language", "en");
    fd.append("response_format", "json");
    fd.append("prompt", "Jack in Shrewsbury, UK. Aston Villa, Tesco, Aldi, Lidl, MOT, spag bol, Sainsbury's.");
    try {
      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${GROQ_KEY}` }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: `Couldn't hear that (${String(j?.error?.message ?? r.status).slice(0, 100)}).` }, 502);
      return json({ text: String(j.text ?? "").trim() });
    } catch (e) {
      return json({ error: `Couldn't hear that (${(e as Error).message.slice(0, 80)}).` }, 502);
    }
  }

  // ---- Meal plan: fill the given empty slots with varied, UK-supermarket-friendly meals (JSON out)
  if (body.mode === "mealplan") {
    const slots = ((body as { slots?: { day: string; slot: string }[] }).slots ?? [])
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.day) && ["breakfast", "lunch", "dinner"].includes(x.slot))
      .slice(0, 21);
    const avoid = ((body as { avoid?: string[] }).avoid ?? []).map(String).slice(0, 40);
    if (!slots.length) return json({ meals: [] });
    if (!(await bump(user.id))) return json({ error: `Daily AI limit reached (${MAX_CHATS}). Try again tomorrow.` }, 429);
    const { data: st } = await admin.from("user_settings").select("prefs").eq("user_id", user.id).maybeSingle();
    const prefs = (st?.prefs ?? {}) as { diet?: string[]; supermarket?: string | null };
    const prompt = `Plan these meals for Jack (UK, cooking for himself, budget-friendly, quick on weekdays, a bit more effort at weekends).
Diet/preferences: ${prefs.diet?.length ? prefs.diet.join(", ") : "none stated"}. Supermarket: ${prefs.supermarket ?? "any UK supermarket"}.
Make every meal different${avoid.length ? ` and don't repeat these: ${avoid.join("; ")}` : ""}. Breakfasts simple, lunches portable or quick, dinners proper meals; reuse ingredients across the week to cut waste.
Slots to fill (day, slot): ${slots.map((x) => `${x.day} ${x.slot}`).join(", ")}.
Reply with JSON only: {"meals":[{"day":"YYYY-MM-DD","slot":"breakfast|lunch|dinner","title":"short meal name","ingredients":["ingredient as you'd write it on a shopping list", ...]}]} — 3 to 8 ingredients each, UK names (courgette, mince, coriander).`;
    const wanted = new Set(slots.map((x) => `${x.day}|${x.slot}`));
    const tryParse = (t: string) => {
      const m = t.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m ? m[0] : t);
      return ((j.meals ?? []) as { day: string; slot: string; title: string; ingredients: unknown }[])
        .filter((x) => wanted.has(`${x.day}|${x.slot}`) && typeof x.title === "string" && x.title.trim())
        .map((x) => ({
          day: x.day,
          slot: x.slot,
          title: x.title.trim().slice(0, 80),
          ingredients: (Array.isArray(x.ingredients) ? x.ingredients : []).map(String).map((i) => i.trim().slice(0, 50)).filter(Boolean).slice(0, 12),
        }));
    };
    const msgs2 = [{ role: "system", content: "You are a practical UK meal planner. Output valid JSON only." }, { role: "user", content: prompt }];
    try {
      if (GROQ_KEY) {
        const model = await pickGroqModel(CHAT_PREFS);
        return json({ meals: tryParse(await chatCall("https://api.groq.com/openai/v1", GROQ_KEY, model, msgs2, { json: true, maxTokens: 3500 })) });
      }
      return json({ meals: tryParse(await chatCall("https://generativelanguage.googleapis.com/v1beta/openai", GEMINI_KEY, GEMINI_MODEL, msgs2, { json: true, maxTokens: 3500 })) });
    } catch (e) {
      return json({ error: `The AI couldn't plan meals right now (${(e as Error).message.slice(0, 120)}).` }, 502);
    }
  }

  // ---- Food photo: estimate what's on the plate (name, grams, kcal, macros) for the food diary
  if (body.mode === "foodphoto") {
    const image = String((body as { image?: string }).image ?? "");
    const note = String((body as { note?: string }).note ?? "").slice(0, 200);
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 4_000_000) return json({ error: "Send a photo of your food." }, 400);
    if (!GROQ_KEY) return json({ error: "Food photos need the Groq key." }, 503);
    if (!(await bump(user.id))) return json({ error: `Daily AI limit reached (${MAX_CHATS}). Try again tomorrow.` }, 429);
    const ask = `Estimate the food in this photo for a UK calorie diary.${note ? ` Jack says: "${note}".` : ""}
List each separate item you can see with a realistic portion in grams and its nutrition for that portion.
Reply with JSON only: {"items":[{"name":"e.g. Chips","grams":200,"kcal":0,"protein":0,"carbs":0,"fat":0}],"confidence":"low|medium|high","note":"one short line, e.g. what you weren't sure about"}.
If it isn't food, reply {"items":[],"confidence":"low","note":"That doesn't look like food."}`;
    const msgs3 = [{ role: "user", content: [{ type: "text", text: ask }, { type: "image_url", image_url: { url: image } }] }];
    try {
      const model = await pickGroqModel(VISION_PREFS);
      const t = await chatCall("https://api.groq.com/openai/v1", GROQ_KEY, model, msgs3, { maxTokens: 900 });
      const m = t.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m ? m[0] : t);
      const num = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) * 10) / 10 || 0));
      const items = ((j.items ?? []) as Record<string, unknown>[])
        .filter((x) => typeof x.name === "string" && String(x.name).trim())
        .slice(0, 8)
        .map((x) => ({ name: String(x.name).trim().slice(0, 60), grams: num(x.grams, 2000), kcal: num(x.kcal, 4000), protein: num(x.protein, 300), carbs: num(x.carbs, 600), fat: num(x.fat, 300) }));
      return json({ items, confidence: ["low", "medium", "high"].includes(j.confidence) ? j.confidence : "medium", note: String(j.note ?? "").slice(0, 160) });
    } catch (e) {
      return json({ error: `Couldn't read that photo (${(e as Error).message.slice(0, 100)}). Try again or add it by hand.` }, 502);
    }
  }

  const msgs = (body.messages ?? []).slice(-16);
  if (!msgs.length) return json({ error: "Say something first." }, 400);
  if (!(await bump(user.id))) return json({ error: `Daily chat limit reached (${MAX_CHATS}). Try again tomorrow.` }, 429);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  const isoToday = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const hasImage = msgs.some((m) => m.image && m.role === "user");
  // Only the latest photo is sent (free vision models take a small number of images)
  const lastImageIdx = msgs.map((m) => Boolean(m.image && m.role === "user")).lastIndexOf(true);
  const context = await lifeContext(user.id).catch(() => "");
  const messages = [
    {
      role: "system",
      content: `You are Jack's personal assistant inside his LifeHub app. Jack lives near Shrewsbury, Shropshire (UK) and supports Aston Villa. Today is ${today}. Be friendly, direct and concise — short paragraphs, UK spelling, prices in £. You can't browse the web, so if a fact may have changed recently, say you're not certain.
${ACTIONS_GUIDE(isoToday)}

Below is Jack's own data from LifeHub (read-only). Use it when he asks about his plans, bills, meals, car, jobs, shopping, goals or upcoming matches; never invent entries that aren't listed, and say so if something isn't there. Dates are YYYY-MM-DD.

${context || "(no LifeHub data yet)"}`,
    },
    ...msgs.map((m, i) =>
      i === lastImageIdx
        ? { role: "user", content: [{ type: "text", text: m.text || "What's in this picture?" }, { type: "image_url", image_url: { url: m.image } }] }
        : { role: m.role, content: String(m.text ?? "").slice(0, 8000) || "(photo)" },
    ),
  ];

  const errors: string[] = [];
  if (GROQ_KEY) {
    const prefs = hasImage ? VISION_PREFS : CHAT_PREFS;
    for (const refresh of [false, true]) {
      try {
        const model = await pickGroqModel(prefs, refresh);
        const { text, actions } = splitActions(await chatCall("https://api.groq.com/openai/v1", GROQ_KEY, model, messages));
        return json({ text: text || (actions.length ? "Done." : "Sorry, I didn't get a reply — try again."), actions, provider: "groq", model });
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 401) return json({ error: "The Groq key isn't valid — re-copy it into Supabase secrets." }, 502);
        errors.push(err.message);
        // Retired/unknown model → refresh the model list once; anything else → try the backup
        if (!(err.status === 404 || /model/i.test(err.message)) || refresh) break;
      }
    }
  }
  if (GEMINI_KEY) {
    try {
      const { text, actions } = splitActions(await chatCall("https://generativelanguage.googleapis.com/v1beta/openai", GEMINI_KEY, GEMINI_MODEL, messages));
      return json({ text: text || (actions.length ? "Done." : "Sorry, I didn't get a reply — try again."), actions, provider: "gemini", model: GEMINI_MODEL });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  const busy = errors.some((m) => /rate|limit|busy|quota|429/i.test(m));
  return json({ error: busy ? "The free AI is busy right now — give it a minute and try again." : `The AI couldn't answer: ${errors[0] ?? "unknown error"}` }, 502);
});
