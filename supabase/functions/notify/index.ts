// MyLife Hub — push notifications (Supabase Edge Function, Deno)
//
// GET            → { configured, publicKey }        (public key for the app to subscribe with)
// POST {test}    → sends a test notification to the signed-in caller (needs their JWT)
// POST (cron)    → sends anything that's due: bill reminders, kick-off alerts. Idempotent.
//
// Secrets (set in Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const TEAMS = ["133601", "133914"]; // Aston Villa, England (TheSportsDB ids)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const configured = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (configured) webpush.setVapidDetails("mailto:noreply@mylifehub.app", VAPID_PUBLIC, VAPID_PRIVATE);

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type Msg = { title: string; body: string; url?: string; tag?: string };

async function sendTo(subs: Sub[], msg: Msg) {
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id); // device unsubscribed
      else console.error("push failed", code, (e as Error).message);
    }
  }
  return sent;
}

/** Record a notification key; returns false if it was already sent. */
async function once(userId: string, key: string) {
  const { error } = await admin.from("notification_log").insert({ user_id: userId, key });
  return !error;
}

function ukParts(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

async function runScheduled() {
  const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth");
  if (!subs?.length) return { users: 0, sent: 0 };
  const byUser = new Map<string, Sub[]>();
  for (const s of subs as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const { data: prefRows } = await admin.from("notification_prefs").select("user_id,bills,matches").in("user_id", [...byUser.keys()]);
  const prefs = new Map((prefRows ?? []).map((p) => [p.user_id as string, p as { bills: boolean; matches: boolean }]));

  const { date: today, hour } = ukParts();
  const tomorrow = addDays(today, 1);
  let sent = 0;

  // ---- Bills: between 8am and 9pm UK time
  if (hour >= 8 && hour < 21) {
    const { data: bills } = await admin
      .from("bills")
      .select("id,user_id,name,amount,next_due_date")
      .eq("is_active", true)
      .in("user_id", [...byUser.keys()])
      .lte("next_due_date", tomorrow);
    for (const b of bills ?? []) {
      if (prefs.get(b.user_id)?.bills === false) continue;
      const kind = b.next_due_date === tomorrow ? "tomorrow" : b.next_due_date === today ? "today" : "overdue";
      if (!(await once(b.user_id, `bill-${b.id}-${b.next_due_date}-${kind}`))) continue;
      const amount = gbp(Number(b.amount));
      const msg: Msg =
        kind === "tomorrow"
          ? { title: `💷 ${b.name} due tomorrow`, body: `${amount} goes out tomorrow.`, url: "/bills", tag: `bill-${b.id}` }
          : kind === "today"
            ? { title: `💷 ${b.name} due today`, body: `${amount} is due today. Tap to mark it paid.`, url: "/bills", tag: `bill-${b.id}` }
            : { title: `⚠️ ${b.name} is overdue`, body: `${amount} was due ${b.next_due_date}. Tap to sort it.`, url: "/bills", tag: `bill-${b.id}` };
      sent += await sendTo(byUser.get(b.user_id)!, msg);
    }
  }

  // ---- Kick-off alerts: matches starting in the next 75 minutes
  const now = Date.now();
  const seen = new Set<string>();
  for (const team of TEAMS) {
    try {
      const r = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${team}`);
      const j = await r.json();
      for (const e of (j?.events ?? []) as Record<string, string>[]) {
        if (seen.has(e.idEvent)) continue;
        seen.add(e.idEvent);
        const ts = e.strTimestamp ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`) : null;
        if (!ts) continue;
        const mins = (ts.getTime() - now) / 60000;
        if (mins <= 0 || mins > 75) continue;
        const time = ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
        for (const [userId, userSubs] of byUser) {
          if (prefs.get(userId)?.matches === false) continue;
          if (!(await once(userId, `match-${e.idEvent}`))) continue;
          sent += await sendTo(userSubs, {
            title: `⚽ ${e.strHomeTeam} v ${e.strAwayTeam}`,
            body: `Kick-off at ${time} — tap for lineups.`,
            url: `/sport/match/${e.idEvent}`,
            tag: `match-${e.idEvent}`,
          });
        }
      }
    } catch (err) {
      console.error("fixtures failed", team, (err as Error).message);
    }
  }
  return { users: byUser.size, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ configured, publicKey: VAPID_PUBLIC || null });
  if (!configured) return json({ ok: false, error: "Push keys not set yet (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)" }, 503);

  const body = await req.json().catch(() => ({}));
  if (body?.test) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ ok: false, error: "Sign in first" }, 401);
    const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").eq("user_id", u.user.id);
    const sent = await sendTo((subs ?? []) as Sub[], { title: "🎉 Notifications are on", body: "MyLife Hub will remind you about bills and kick-offs.", url: "/settings", tag: "test" });
    return json({ ok: true, sent, devices: subs?.length ?? 0 });
  }

  const result = await runScheduled();
  return json({ ok: true, ...result });
});
