// LifeHub AI — free models only, no card needed.
//   Main:   Groq (console.groq.com) free plan — fast open models, doesn't train on your data.  Secret: GROQ_API_KEY
//   Backup: Google Gemini free tier (aistudio.google.com), used only if Groq is busy.        Secret: GEMINI_API_KEY (optional)
//           Note: Google may use free-tier prompts to improve its products.
// Optional overrides: GROQ_CHAT_MODEL, GROQ_VISION_MODEL, GEMINI_MODEL.
// Signed-in users only; a daily cap keeps it inside the free limits.
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

async function chatCall(base: string, key: string, model: string, messages: unknown[]) {
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.6 }),
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

  const msgs = (body.messages ?? []).slice(-16);
  if (!msgs.length) return json({ error: "Say something first." }, 400);
  if (!(await bump(user.id))) return json({ error: `Daily chat limit reached (${MAX_CHATS}). Try again tomorrow.` }, 429);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  const hasImage = msgs.some((m) => m.image && m.role === "user");
  // Only the latest photo is sent (free vision models take a small number of images)
  const lastImageIdx = msgs.map((m) => Boolean(m.image && m.role === "user")).lastIndexOf(true);
  const messages = [
    {
      role: "system",
      content: `You are Jack's personal assistant inside his LifeHub app. Jack lives near Shrewsbury, Shropshire (UK) and supports Aston Villa. Today is ${today}. Be friendly, direct and concise — short paragraphs, UK spelling, prices in £. You can't browse the web, so if a fact may have changed recently, say you're not certain.`,
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
