// LifeHub Today — a short plain-text summary of your day for Apple Watch / Siri (via an iPhone Shortcut).
// URL: /functions/v1/today?token=<the same private token as the Apple Health link>
// Optional: &lat=..&lon=.. for the weather (defaults to Solihull), &format=json
// Leaves bills out on purpose (Jack keeps bills on the Bills page).
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TZ = "Europe/London";
const DEFAULT_TEAMS = ["133601", "133914"]; // Aston Villa, England

const WX: [number[], string, string][] = [
  [[0], "☀️", "Clear"],
  [[1, 2], "🌤️", "Partly cloudy"],
  [[3], "☁️", "Cloudy"],
  [[45, 48], "🌫️", "Fog"],
  [[51, 53, 55, 56, 57], "🌦️", "Drizzle"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "🌧️", "Rain"],
  [[71, 73, 75, 77, 85, 86], "🌨️", "Snow"],
  [[95, 96, 99], "⛈️", "Thunder"],
];
const wx = (code: number, isDay: boolean) => {
  const hit = WX.find(([codes]) => codes.includes(code)) ?? [[], "🌡️", "—"];
  return { emoji: code === 0 && !isDay ? "🌙" : hit[1], label: hit[2] };
};

const ukDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const ukTime = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayName = (iso: string, today: string) => {
  if (iso === today) return "today";
  if (iso === addDays(today, 1)) return "tomorrow";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400e3);

Deno.serve(async (req) => {
  const sp = new URL(req.url).searchParams;
  const token = sp.get("token") ?? "";
  const text = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (!/^[0-9a-f-]{36}$/i.test(token)) return text("Missing link token — copy the link from LifeHub → Health.", 401);
  const { data: t } = await admin.from("health_tokens").select("user_id").eq("token", token).maybeSingle();
  if (!t) return text("Unknown link — copy it again from LifeHub → Health.", 401);
  const uid = t.user_id as string;

  const today = ukDate();
  const now = new Date();
  const lat = Number(sp.get("lat") ?? 52.4118);
  const lon = Number(sp.get("lon") ?? -1.7776);
  const lines: string[] = [];

  const [weather, events, health, meals, jobs, cars, settings] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FLondon&forecast_days=1`,
      { signal: AbortSignal.timeout(6000) },
    )
      .then((r) => r.json())
      .catch(() => null),
    admin.from("calendar_events").select("title,event_date,event_time,kind").eq("user_id", uid).gte("event_date", today).lte("event_date", addDays(today, 14)).order("event_date").order("event_time"),
    admin.from("health_daily").select("steps,active_kcal,distance_km").eq("user_id", uid).eq("day", today).maybeSingle(),
    admin.from("meal_plan").select("slot,title").eq("user_id", uid).eq("day", today),
    admin.from("home_tasks").select("name,next_due").eq("user_id", uid).lte("next_due", today),
    admin.from("vehicles").select("nickname,make,mot_due,tax_due,insurance_due,service_due").eq("user_id", uid),
    admin.from("user_settings").select("prefs").eq("user_id", uid).maybeSingle(),
  ]);

  // Weather
  if (weather?.current) {
    const w = wx(weather.current.weather_code, weather.current.is_day === 1);
    const hi = weather.daily?.temperature_2m_max?.[0];
    const lo = weather.daily?.temperature_2m_min?.[0];
    const rain = weather.daily?.precipitation_probability_max?.[0];
    lines.push(`${w.emoji} ${Math.round(weather.current.temperature_2m)}° ${w.label}${hi != null ? ` · H${Math.round(hi)}° L${Math.round(lo)}°` : ""}${rain ? ` · ${rain}% rain` : ""}`);
  }

  // Calendar: today's things still to come, else the next one
  const mins = Number(ukTime(now).slice(0, 2)) * 60 + Number(ukTime(now).slice(3, 5));
  const upcoming = (events.data ?? []).filter((e) => e.kind !== "bill" && !(e.event_date === today && e.event_time && Number(String(e.event_time).slice(0, 2)) * 60 + Number(String(e.event_time).slice(3, 5)) + 60 < mins));
  const todays = upcoming.filter((e) => e.event_date === today);
  if (todays.length) lines.push(`📅 ${todays.slice(0, 3).map((e) => `${e.event_time ? String(e.event_time).slice(0, 5) + " " : ""}${e.title}`).join(", ")}${todays.length > 3 ? ` +${todays.length - 3}` : ""}`);
  else if (upcoming[0]) lines.push(`📅 Next: ${upcoming[0].title} ${dayName(upcoming[0].event_date, today)}${upcoming[0].event_time ? ` ${String(upcoming[0].event_time).slice(0, 5)}` : ""}`);
  else lines.push("📅 Nothing planned");

  // Next match for favourite teams
  const prefs = (settings.data?.prefs ?? {}) as { teams?: { id: string | number }[] };
  const teams = (prefs.teams ?? []).map((x) => String(x.id)).filter((id) => /^\d{3,9}$/.test(id));
  let best: { when: Date; label: string } | null = null;
  for (const team of (teams.length ? teams : DEFAULT_TEAMS).slice(0, 3)) {
    try {
      const j = await (await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${team}`, { signal: AbortSignal.timeout(5000) })).json();
      const e = (j?.events ?? [])[0] as Record<string, string> | undefined;
      if (!e?.strTimestamp) continue;
      const when = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`);
      if (when.getTime() < now.getTime() - 2 * 3600e3) continue;
      if (!best || when < best.when) best = { when, label: `${e.strHomeTeam} v ${e.strAwayTeam}` };
    } catch {
      /* skip */
    }
  }
  if (best) {
    const d = ukDate(best.when);
    const n = daysBetween(today, d);
    lines.push(`⚽ ${best.label} · ${n === 0 ? `today ${ukTime(best.when)}` : n === 1 ? `tomorrow ${ukTime(best.when)}` : `${dayName(d, today)} ${ukTime(best.when)}`}`);
  }

  // Activity
  const h = health.data;
  if (h && (h.steps || h.active_kcal)) lines.push(`👟 ${h.steps != null ? `${Number(h.steps).toLocaleString("en-GB")} steps` : ""}${h.steps != null && h.active_kcal != null ? " · " : ""}${h.active_kcal != null ? `${h.active_kcal} kcal` : ""}`);

  // Food plan
  const dinner = (meals.data ?? []).find((m) => m.slot === "dinner") ?? (meals.data ?? [])[0];
  if (dinner) lines.push(`🍽️ ${dinner.slot === "dinner" ? "Dinner" : dinner.slot}: ${dinner.title}`);

  // Car + house reminders (within a week)
  const in7 = addDays(today, 7);
  for (const v of cars.data ?? [])
    for (const [k, label] of [["mot_due", "MOT"], ["tax_due", "Tax"], ["insurance_due", "Insurance"], ["service_due", "Service"]] as const) {
      const d = v[k] as string | null;
      if (d && d <= in7) lines.push(`🚗 ${label} ${d < today ? "overdue" : `due ${dayName(d, today)}`}`);
    }
  const due = jobs.data ?? [];
  if (due.length) lines.push(`🏠 ${due.slice(0, 2).map((j) => j.name).join(", ")}${due.length > 2 ? ` +${due.length - 2}` : ""}`);

  if (sp.get("format") === "json") return new Response(JSON.stringify({ lines }), { headers: { "content-type": "application/json" } });
  return text(lines.join("\n"));
});
