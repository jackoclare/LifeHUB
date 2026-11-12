// AI assistant backed by OpenAI (ChatGPT models). Signed-in users only; daily caps keep costs predictable.
// Secrets: OPENAI_API_KEY (required); optional OPENAI_CHAT_MODEL, OPENAI_IMAGE_MODEL
import { createClient } from "npm:@supabase/supabase-js@2";

const KEY = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
const CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-5.5";
const IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-2";
const MAX_CHATS = 200;
const MAX_IMAGES = 25;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Msg = { role: "user" | "assistant"; text: string; image?: string };

function dataUrlToBlob(d: string): Blob {
  const m = d.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) throw new Error("Unsupported image");
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Blob([bin], { type: m[1] });
}

async function bump(userId: string, field: "chats" | "images", max: number) {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const { data } = await admin.from("ai_usage").select("chats,images").eq("user_id", userId).eq("day", day).maybeSingle();
  const used = (data?.[field] as number | undefined) ?? 0;
  if (used >= max) return false;
  await admin.from("ai_usage").upsert({ user_id: userId, day, chats: (data?.chats ?? 0) + (field === "chats" ? 1 : 0), images: (data?.images ?? 0) + (field === "images" ? 1 : 0) });
  return true;
}

async function openai(path: string, init: RequestInit) {
  const r = await fetch(`https://api.openai.com/v1${path}`, { ...init, headers: { authorization: `Bearer ${KEY}`, ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message ?? `OpenAI error ${r.status}`;
    throw new Error(r.status === 401 ? "The OpenAI key isn't valid — re-copy it into Supabase secrets." : r.status === 429 ? "OpenAI says the account is out of credit or busy — check billing on platform.openai.com." : msg);
  }
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ configured: KEY.length > 20, chatModel: CHAT_MODEL, imageModel: IMAGE_MODEL });
  if (!KEY) return json({ error: "AI isn't switched on yet — add OPENAI_API_KEY in Supabase secrets." }, 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Please unlock the app with your PIN first." }, 401);

  let body: { mode?: string; messages?: Msg[]; prompt?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  try {
    if (body.mode === "image") {
      const prompt = String(body.prompt ?? "").slice(0, 2000).trim();
      if (!prompt) return json({ error: "Tell me what to create or change." }, 400);
      if (!(await bump(user.id, "images", MAX_IMAGES))) return json({ error: `Daily image limit reached (${MAX_IMAGES}). Try again tomorrow.` }, 429);

      let out;
      if (body.image) {
        const fd = new FormData();
        fd.append("model", IMAGE_MODEL);
        fd.append("prompt", prompt);
        fd.append("image", dataUrlToBlob(body.image), "input.png");
        out = await openai("/images/edits", { method: "POST", body: fd });
      } else {
        out = await openai("/images/generations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1024", n: 1 }) });
      }
      const b64 = out?.data?.[0]?.b64_json;
      const url = out?.data?.[0]?.url;
      let bytes: Uint8Array;
      if (b64) bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      else if (url) bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      else throw new Error("No image came back — try rewording.");

      const path = `${user.id}/${crypto.randomUUID()}.png`;
      const up = await admin.storage.from("ai-images").upload(path, bytes, { contentType: "image/png" });
      if (up.error) throw new Error(up.error.message);
      await admin.from("ai_images").insert({ user_id: user.id, prompt, path });
      const { data: signed } = await admin.storage.from("ai-images").createSignedUrl(path, 60 * 60 * 24 * 7);
      return json({ image: signed?.signedUrl, path });
    }

    // Chat (with optional photos)
    const msgs = (body.messages ?? []).slice(-16);
    if (!msgs.length) return json({ error: "Say something first." }, 400);
    if (!(await bump(user.id, "chats", MAX_CHATS))) return json({ error: `Daily chat limit reached (${MAX_CHATS}). Try again tomorrow.` }, 429);
    const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
    const out = await openai("/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_completion_tokens: 900,
        messages: [
          {
            role: "system",
            content: `You are Jack's personal assistant inside his MyLife Hub app. Jack lives in the UK (West Midlands) and supports Aston Villa. Today is ${today}. Be friendly, direct and concise — short paragraphs, UK spelling, prices in £. If you're not sure of a fact that may have changed recently, say so.`,
          },
          ...msgs.map((m) =>
            m.image && m.role === "user"
              ? { role: "user", content: [{ type: "text", text: m.text || "What's in this picture?" }, { type: "image_url", image_url: { url: m.image } }] }
              : { role: m.role, content: String(m.text ?? "").slice(0, 8000) },
          ),
        ],
      }),
    });
    const text = out?.choices?.[0]?.message?.content ?? "";
    return json({ text: text || "Sorry, I didn't get a reply — try again." });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
