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
  const hasImage = msgs.some((m) => m.image && m.role === "user");
  // Only the latest photo is sent (free vision models take a small number of images)
  const lastImageIdx = msgs.map((m) => Boolean(m.image && m.role === "user")).lastIndexOf(true);
  const context = await lifeContext(user.id).catch(() => "");
  const messages = [
    {
      role: "system",
      content: `You are Jack's personal assistant inside his LifeHub app. Jack lives near Shrewsbury, Shropshire (UK) and supports Aston Villa. Today is ${today}. Be friendly, direct and concise — short paragraphs, UK spelling, prices in £. You can't browse the web, so if a fact may have changed recently, say you're not certain.
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
        const text = await chatCall("https://api.groq.com/openai/v1", GROQ_KEY, model, messages);
        return json({ text: text || "Sorry, I didn't get a reply — try again.", provider: "groq", model });
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
      const text = await chatCall("https://generativelanguage.googleapis.com/v1beta/openai", GEMINI_KEY, GEMINI_MODEL, messages);
      return json({ text: text || "Sorry, I didn't get a reply — try again.", provider: "gemini", model: GEMINI_MODEL });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  const busy = errors.some((m) => /rate|limit|busy|quota|429/i.test(m));
  return json({ error: busy ? "The free AI is busy right now — give it a minute and try again." : `The AI couldn't answer: ${errors[0] ?? "unknown error"}` }, 502);
});
