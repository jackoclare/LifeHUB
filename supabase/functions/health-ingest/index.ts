// Receives daily activity from an iPhone Shortcut (Apple Health → "Get Contents of URL" POST).
// URL: /functions/v1/health-ingest?token=<personal token>   Body (JSON): { steps, distance, activeEnergy, exerciseMinutes, restingHeartRate, sleepHours, date? }
// Values may arrive as numbers, text, or lists of numbers (Shortcuts often sends a list) — lists are summed (averaged for heart rate).
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

function num(v: unknown, mode: "sum" | "avg" = "sum"): number | null {
  if (v == null || v === "") return null;
  const list = Array.isArray(v) ? v : String(v).split(/[\n,]+/);
  const nums = list.map((x) => parseFloat(String(x).replace(/[^\d.\-]/g, ""))).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  const total = nums.reduce((a, b) => a + b, 0);
  return mode === "avg" ? total / nums.length : total;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Send a POST from the Shortcut" }, 405);
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ ok: false, error: "Missing or bad token" }, 401);
  const { data: t } = await admin.from("health_tokens").select("user_id").eq("token", token).maybeSingle();
  if (!t) return json({ ok: false, error: "Unknown token — copy the link again from LifeHub → Health" }, 401);

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    body = text.trim().startsWith("{") ? JSON.parse(text) : Object.fromEntries(new URLSearchParams(text));
  } catch {
    return json({ ok: false, error: "Couldn't read the data" }, 400);
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const day = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : today;
  const steps = num(body.steps);
  let distance = num(body.distance);
  // Shortcuts reports distance in the phone's units — treat big numbers as metres, otherwise km/miles as sent
  if (distance != null && distance > 200) distance = distance / 1000;
  if (distance != null && body.distanceUnit === "mi") distance = distance * 1.609;
  const row = {
    user_id: t.user_id,
    day,
    steps: steps != null ? Math.round(steps) : null,
    distance_km: distance != null ? Math.round(distance * 100) / 100 : null,
    active_kcal: num(body.activeEnergy) != null ? Math.round(num(body.activeEnergy)!) : null,
    exercise_min: num(body.exerciseMinutes) != null ? Math.round(num(body.exerciseMinutes)!) : null,
    resting_hr: num(body.restingHeartRate, "avg") != null ? Math.round(num(body.restingHeartRate, "avg")!) : null,
    sleep_hours: num(body.sleepHours) != null ? Math.round(num(body.sleepHours)! * 100) / 100 : null,
    updated_at: new Date().toISOString(),
  };
  // Don't wipe values the Shortcut didn't send this time
  const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));
  const { error } = await admin.from("health_daily").upsert(clean, { onConflict: "user_id,day" });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, saved: clean });
});
