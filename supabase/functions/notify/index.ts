// LifeHub — push notifications (Supabase Edge Function, Deno)
//
// GET            → { configured, publicKey }        (public key for the app to subscribe with)
// POST {test}    → sends a test notification to the signed-in caller (needs their JWT)
// POST (cron)    → sends anything that's due: morning briefing, bill reminders, kick-off alerts, Met Office warnings, wish-list deals,
//                  and checks each wish-list link's price once a day (price drop / target alerts). Idempotent.
//
// Secrets (set in Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Strip any spaces/new lines/quotes picked up when pasting
const clean = (v: string | undefined) => (v ?? "").replace(/[\s"']/g, "");
const VAPID_PUBLIC = clean(Deno.env.get("VAPID_PUBLIC_KEY"));
const VAPID_PRIVATE = clean(Deno.env.get("VAPID_PRIVATE_KEY"));
const TEAMS = ["133601", "133914"]; // Aston Villa, England (TheSportsDB ids)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
let configError: string | null = null;
try {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) throw new Error("Push keys not set yet (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  webpush.setVapidDetails("mailto:noreply@mylifehub.app", VAPID_PUBLIC, VAPID_PRIVATE);
} catch (e) {
  configError = (e as Error).message;
}
const configured = configError === null;

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


/* ---------- Wish-list price tracking ---------- */

type Found = { price: number; monthly: boolean };
const MONTHLY = /per[\s_-]?month|monthly|\/mo\b|P1M|"MON"|billingDuration|billingIncrement|subscription/i;

/** Reads a product page's price: structured data (JSON-LD offers) first, then price meta tags. GBP only. */
export function extractPrice(html: string): Found | null {
  const cands: Found[] = [];
  for (const [, raw] of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    const walk = (n: unknown, depth = 0): void => {
      if (!n || typeof n !== "object" || depth > 8) return;
      if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
      const o = n as Record<string, unknown>;
      if (/Offer/i.test(String(o["@type"] ?? ""))) {
        const spec = (o.priceSpecification ?? {}) as Record<string, unknown>;
        const cur = String(o.priceCurrency ?? spec.priceCurrency ?? "GBP").toUpperCase();
        const p = Number(String(o.price ?? o.lowPrice ?? spec.price ?? "").replace(/[^\d.]/g, ""));
        if (cur === "GBP" && Number.isFinite(p) && p > 0) cands.push({ price: p, monthly: MONTHLY.test(JSON.stringify(o)) });
      }
      for (const v of Object.values(o)) walk(v, depth + 1);
    };
    walk(data);
  }
  if (cands.length) {
    const full = cands.filter((c) => !c.monthly);
    const pool = full.length ? full : cands;
    return { price: Math.min(...pool.map((c) => c.price)), monthly: !full.length };
  }
  const meta =
    html.match(/<meta[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|twitter:data1|price)["'][^>]*content=["']£?\s?([\d,]+(?:\.\d{1,2})?)["']/i) ??
    html.match(/<meta[^>]+content=["']£?\s?([\d,]+(?:\.\d{1,2})?)["'][^>]*(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["']/i) ??
    html.match(/itemprop=["']price["'][^>]*content=["']([\d,]+(?:\.\d{1,2})?)["']/i);
  if (meta) {
    const p = Number(meta[1].replace(/,/g, ""));
    if (Number.isFinite(p) && p > 0) return { price: p, monthly: false };
  }
  return null;
}

/** Once a day (from 9am UK), visit each wish-list link, record the price and alert on drops. */
async function checkWishPrices(today: string, hour: number) {
  if (hour < 9 || hour >= 22) return { checked: 0, sent: 0 };
  const { data: items } = await admin
    .from("wishlist_items")
    .select("id,user_id,name,url,current_price,target_price")
    .eq("purchased", false)
    .not("url", "is", null);
  let checked = 0;
  let sent = 0;
  for (const it of items ?? []) {
    if (checked >= 12) break; // spread big lists over several runs
    if (!/^https?:\/\//i.test(it.url ?? "")) continue;
    if (!(await once(it.user_id, `price-${it.id}-${today}`))) continue;
    checked++;
    try {
      const r = await fetch(it.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-GB,en;q=0.9",
        },
      });
      if (!r.ok) {
        console.log("price check", it.id, "HTTP", r.status);
        continue;
      }
      const found = extractPrice((await r.text()).slice(0, 4_000_000));
      if (!found) {
        console.log("price check", it.id, "no price on page");
        continue;
      }
      await admin.from("wishlist_prices").insert({ user_id: it.user_id, item_id: it.id, price: found.price, source: found.monthly ? "auto (per month)" : "auto" });
      if (found.monthly) continue; // a monthly plan price isn't comparable with a buy-outright target
      const prev = it.current_price == null ? null : Number(it.current_price);
      await admin.from("wishlist_items").update({ current_price: found.price, updated_at: new Date().toISOString() }).eq("id", it.id);
      const target = it.target_price == null ? null : Number(it.target_price);
      const hitTarget = target != null && found.price <= target && (prev == null || prev > target);
      const bigDrop = prev != null && found.price <= prev * 0.95 && prev - found.price >= 1;
      if (!hitTarget && !bigDrop) continue;
      if (!(await once(it.user_id, `pricedrop-${it.id}-${found.price.toFixed(2)}`))) continue;
      const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").eq("user_id", it.user_id);
      sent += await sendTo((subs ?? []) as Sub[], {
        title: hitTarget ? `🎯 ${it.name} hit your target price` : `📉 ${it.name} dropped in price`,
        body: `Now ${gbp(found.price)}${prev != null ? ` (was ${gbp(prev)})` : ""}${target != null ? ` · target ${gbp(target)}` : ""}. Tap to view.`,
        url: "/wishlist",
        tag: `price-${it.id}`,
      });
    } catch (e) {
      console.error("price check failed", it.id, (e as Error).message);
    }
  }
  return { checked, sent };
}

/* ---------- Matchday goal alerts ---------- */

const APP_URL = (Deno.env.get("APP_URL") ?? "https://life-hub-nine-rouge.vercel.app").replace(/\/$/, "");
type LiveEv = { minute: number; extra: number | null; side: "home" | "away"; player: string; kind: "goal" | "pen" | "own" | "red" };
type Live = { status?: string; fixtureId?: number; home?: { name: string; goals: number | null }; away?: { name: string; goals: number | null }; events?: LiveEv[] };
const ukDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
const shortName = (n: string) => (/aston villa/i.test(n) ? "Villa" : n);

async function goalAlerts(
  allTeams: string[],
  byUser: Map<string, Sub[]>,
  teamsByUser: Map<string, string[]>,
  prefs: Map<string, { matches: boolean }>,
  now: number,
) {
  let sent = 0;
  const done = new Set<string>();
  for (const team of allTeams) {
    const lists = await Promise.all(
      ["eventsnext", "eventslast"].map((ep) =>
        fetch(`https://www.thesportsdb.com/api/v1/json/123/${ep}.php?id=${team}`)
          .then((r) => r.json())
          .then((j) => ((j?.events ?? j?.results ?? []) as Record<string, string>[]))
          .catch(() => [] as Record<string, string>[]),
      ),
    );
    for (const e of lists.flat()) {
      if (done.has(e.idEvent)) continue;
      const ts = e.strTimestamp ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`) : null;
      if (!ts) continue;
      const mins = (now - ts.getTime()) / 60000;
      if (mins < -2 || mins > 165) continue; // only from kick-off to ~2h45 after
      done.add(e.idEvent);
      const url = `${APP_URL}/api/live?date=${ukDay(ts)}&home=${encodeURIComponent(e.strHomeTeam)}&away=${encodeURIComponent(e.strAwayTeam)}&ko=${encodeURIComponent(ts.toISOString())}`;
      let live: Live;
      try {
        live = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();
      } catch {
        continue;
      }
      if (!live?.home || !live.away) continue;
      const home = live.home.name;
      const away = live.away.name;
      // Running score after each goal
      let h = 0;
      let a = 0;
      const goals = (live.events ?? []).filter((x) => x.kind !== "red").map((g) => {
        if (g.side === "home") h++;
        else a++;
        return { ...g, h, a };
      });
      for (const [userId, userSubs] of byUser) {
        if (prefs.get(userId)?.matches === false) continue;
        const mine = teamsByUser.get(userId) ?? TEAMS;
        if (!mine.includes(team) && !mine.includes(String(e.idHomeTeam)) && !mine.includes(String(e.idAwayTeam))) continue;
        const oursSide: "home" | "away" = mine.includes(String(e.idAwayTeam)) && !mine.includes(String(e.idHomeTeam)) ? "away" : "home";
        for (const g of goals) {
          const key = `goal-${e.idEvent}-${g.h}-${g.a}`; // one alert per score change, even if the scorer name is corrected later
          if (!(await once(userId, key))) continue;
          const ours = g.side === oursSide;
          const tag = g.kind === "pen" ? " (pen)" : g.kind === "own" ? " (OG)" : "";
          sent += await sendTo(userSubs, {
            title: ours ? `⚽ GOAL! ${shortName(home)} ${g.h}–${g.a} ${shortName(away)}` : `😬 Goal for ${shortName(g.side === "home" ? home : away)}. ${shortName(home)} ${g.h}–${g.a} ${shortName(away)}`,
            body: `${g.player}${tag} ${g.minute}${g.extra ? `+${g.extra}` : ""}'`,
            url: `/sport/match/${e.idEvent}`,
            tag: `live-${e.idEvent}`,
          });
        }
        if (["FT", "AET", "PEN"].includes(live.status ?? "") && (await once(userId, `ft-${e.idEvent}`))) {
          const hs = live.home.goals ?? h;
          const as = live.away.goals ?? a;
          const us = oursSide === "home" ? hs : as;
          const them = oursSide === "home" ? as : hs;
          sent += await sendTo(userSubs, {
            title: `${us > them ? "🦁 Full time — WIN!" : us < them ? "Full time — gutted" : "Full time — a point"} ${shortName(home)} ${hs}–${as} ${shortName(away)}`,
            body: us > them ? "Get in! Tap for the stats." : "Tap for the stats.",
            url: `/sport/match/${e.idEvent}`,
            tag: `live-${e.idEvent}`,
          });
        }
      }
    }
  }
  return sent;
}

/* ---------- Parking, usual train and the Sunday night plan ---------- */

type LifePrefs = {
  parking?: { started: string; expires: string | null } | null;
  train?: { from: string; to: string; time: string; days: number[] } | null;
  parcels?: { delivered?: boolean }[];
  teams?: { id: string }[];
  birthdays?: { id: string; name: string; date: string; year?: number | null; gift?: string }[];
  bins?: { remind?: boolean; bins: { id: string; name: string; every: number; anchor: string }[] } | null;
  warranties?: { id: string; item: string; returnBy?: string | null; warrantyUntil?: string | null }[];
};

const dayMs = 86400e3;
const isoUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
/** Is `date` one of this bin's collection days? */
const binOn = (b: { every: number; anchor: string }, date: string) => {
  const diff = Math.round((isoUtc(date) - isoUtc(b.anchor)) / dayMs);
  return diff % (b.every * 7) === 0;
};

function ukClock(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { dow, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const hhmmUk = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

async function lifeAlerts(byUser: Map<string, Sub[]>, settings: { user_id: string; prefs: unknown }[], today: string, hour: number) {
  let sent = 0;
  const now = Date.now();
  const { dow, minutes } = ukClock();
  for (const [userId, subs] of byUser) {
    const p = ((settings.find((x) => x.user_id === userId)?.prefs ?? {}) as LifePrefs) || {};

    // Parking: warn 25 → 0 minutes before, then once when it's run out
    const exp = p.parking?.expires;
    if (exp) {
      const left = (Date.parse(exp) - now) / 60000;
      if (left > 0 && left <= 25 && (await once(userId, `park-${exp}`)))
        sent += await sendTo(subs, { title: `🅿️ Parking runs out at ${hhmmUk(exp)}`, body: `About ${Math.ceil(left)} min left. Tap to add time or find your car.`, url: "/parking", tag: "parking" });
      else if (left <= 0 && left > -40 && (await once(userId, `park-over-${exp}`)))
        sent += await sendTo(subs, { title: "🅿️ Your parking has run out", body: `It ended at ${hhmmUk(exp)}. Tap for the way back to the car.`, url: "/parking", tag: "parking" });
    }

    // Usual train: from 95 min before departure, alert on cancellation / delay (once per state)
    const t = p.train;
    if (t && t.days?.includes(dow) && /^\d\d:\d\d$/.test(t.time)) {
      const dep = Number(t.time.slice(0, 2)) * 60 + Number(t.time.slice(3));
      const until = dep - minutes;
      if (until <= 95 && until >= -5) {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/trains?from=${t.from}&to=${t.to}&rows=20`, { signal: AbortSignal.timeout(12000) });
          const b = await r.json();
          const svc = ((b?.services ?? []) as { std: string; etd: string; cancelled: boolean; reason: string | null; destination: string; platform: string | null }[]).find((x) => x.std === t.time);
          if (svc) {
            const where = svc.destination || t.to;
            if (svc.cancelled && (await once(userId, `train-${today}-${t.time}-cancelled`)))
              sent += await sendTo(subs, { title: `🚆 Your ${t.time} to ${where} is cancelled`, body: svc.reason ?? "Tap for the next trains.", url: "/trains", tag: "train" });
            else if (/^\d\d:\d\d$/.test(svc.etd) && svc.etd !== t.time && (await once(userId, `train-${today}-${t.time}-late-${svc.etd}`)))
              sent += await sendTo(subs, { title: `🚆 Your ${t.time} to ${where} is running late`, body: `Now expected ${svc.etd}${svc.platform ? `, platform ${svc.platform}` : ""}.${svc.reason ? ` ${svc.reason}` : ""}`, url: "/trains", tag: "train" });
            else if (svc.etd === "Delayed" && (await once(userId, `train-${today}-${t.time}-delayed`)))
              sent += await sendTo(subs, { title: `🚆 Your ${t.time} to ${where} is delayed`, body: svc.reason ?? "No new time yet — tap to keep an eye on it.", url: "/trains", tag: "train" });
          }
        } catch {
          /* trains feed not set up / busy — try next run */
        }
      }
    }

    // Birthdays: a week before and on the day (from 9am)
    if (hour >= 9 && hour < 21) {
      for (const b of p.birthdays ?? []) {
        const yr = Number(today.slice(0, 4));
        let next = `${yr}-${b.date}`;
        if (next < today) next = `${yr + 1}-${b.date}`;
        const days = Math.round((isoUtc(next) - isoUtc(today)) / dayMs);
        const age = b.year ? Number(next.slice(0, 4)) - b.year : null;
        if (days === 7 && (await once(userId, `bday7-${b.id}-${next}`)))
          sent += await sendTo(subs, { title: `🎂 ${b.name}'s birthday is next week`, body: `${age ? `Turning ${age} · ` : ""}${b.gift ? `Gift idea: ${b.gift}` : "Time to sort a card and present."}`, url: "/birthdays", tag: `bday-${b.id}` });
        if (days === 0 && (await once(userId, `bday0-${b.id}-${next}`)))
          sent += await sendTo(subs, { title: `🎉 It's ${b.name}'s birthday today!`, body: age ? `They're ${age} — send them a message.` : "Don't forget to message them.", url: "/birthdays", tag: `bday-${b.id}` });
      }
    }

    // Bins: the night before, from 7pm
    if (p.bins?.bins?.length && p.bins.remind !== false && hour >= 19 && hour < 22) {
      const tomorrowIso = addDays(today, 1);
      const out = p.bins.bins.filter((b) => binOn(b, tomorrowIso));
      if (out.length && (await once(userId, `bins-${tomorrowIso}`)))
        sent += await sendTo(subs, { title: `🗑️ Bins out tonight`, body: `${out.map((b) => b.name).join(" + ")} — collected tomorrow.`, url: "/bins", tag: "bins" });
    }

    // Warranties & returns: 3 days before the return window closes, 2 weeks before a warranty ends
    if (hour >= 9 && hour < 21) {
      for (const w of p.warranties ?? []) {
        if (w.returnBy) {
          const d = Math.round((isoUtc(w.returnBy) - isoUtc(today)) / dayMs);
          if (d >= 0 && d <= 3 && (await once(userId, `ret-${w.id}`)))
            sent += await sendTo(subs, { title: `↩️ Last chance to return ${w.item}`, body: d === 0 ? "The return window closes today." : `The return window closes in ${d} day${d > 1 ? "s" : ""}.`, url: "/warranties", tag: `w-${w.id}` });
        }
        if (w.warrantyUntil) {
          const d = Math.round((isoUtc(w.warrantyUntil) - isoUtc(today)) / dayMs);
          if (d >= 0 && d <= 14 && (await once(userId, `war-${w.id}`)))
            sent += await sendTo(subs, { title: `🛡️ ${w.item}: warranty ends soon`, body: `It runs out in ${d} day${d === 1 ? "" : "s"} — anything to claim for?`, url: "/warranties", tag: `w-${w.id}` });
        }
      }
    }

    // Sunday night plan: one push between 6pm and 9pm with the week ahead
    if (dow === 0 && hour >= 18 && hour < 21 && (await once(userId, `week-${today}`))) {
      try {
        const in7 = addDays(today, 7);
        const [ev, bl] = await Promise.all([
          admin.from("calendar_events").select("title,event_date,event_time").eq("user_id", userId).gt("event_date", today).lte("event_date", in7).order("event_date").order("event_time"),
          admin.from("bills").select("name,amount").eq("user_id", userId).eq("is_active", true).gt("next_due_date", today).lte("next_due_date", in7),
        ]);
        const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
        const parts: string[] = [];
        const events = ev.data ?? [];
        if (events.length) parts.push(`📅 ${events.slice(0, 3).map((e) => `${day(e.event_date)} ${e.title}`).join(", ")}${events.length > 3 ? ` +${events.length - 3}` : ""}`);
        const bills = bl.data ?? [];
        if (bills.length) parts.push(`💷 ${bills.length} bill${bills.length > 1 ? "s" : ""}, ${gbp(bills.reduce((a, b) => a + Number(b.amount), 0))}`);
        // matches this week
        const teams = (p.teams ?? []).map((x) => String(x.id)).filter((id) => /^\d{3,9}$/.test(id));
        const games: string[] = [];
        for (const id of (teams.length ? teams : TEAMS).slice(0, 3)) {
          try {
            const j = await (await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${id}`)).json();
            for (const e of (j?.events ?? []) as Record<string, string>[]) if (e.dateEvent > today && e.dateEvent <= in7 && !games.some((g) => g.includes(e.strAwayTeam))) games.push(`${day(e.dateEvent)} ${shortName(e.strHomeTeam)} v ${shortName(e.strAwayTeam)}`);
          } catch {}
        }
        if (games.length) parts.push(`⚽ ${games.slice(0, 2).join(", ")}`);
        // weather for the week (Shrewsbury)
        try {
          const w = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=52.707&longitude=-2.755&daily=temperature_2m_max,precipitation_probability_max&timezone=Europe%2FLondon&forecast_days=8")).json();
          const dates = (w?.daily?.time ?? []) as string[];
          const wet = dates.map((d, i) => ({ d, rain: w.daily.precipitation_probability_max[i] as number })).filter((x, i) => i > 0 && x.rain >= 60).map((x) => day(x.d));
          const maxes = ((w?.daily?.temperature_2m_max ?? []) as number[]).slice(1);
          if (maxes.length) parts.push(`🌦️ ${Math.round(Math.min(...maxes))}–${Math.round(Math.max(...maxes))}°${wet.length ? `, rain ${wet.slice(0, 3).join("/")}` : ", mostly dry"}`);
        } catch {}
        const parcels = (p.parcels ?? []).filter((x) => !x.delivered).length;
        if (parcels) parts.push(`📦 ${parcels} parcel${parcels > 1 ? "s" : ""} on the way`);
        sent += await sendTo(subs, { title: "🗓️ Your week ahead", body: parts.length ? parts.join(" · ").slice(0, 230) : "A quiet week — nothing booked yet. Enjoy it.", url: "/calendar", tag: `week-${today}` });
      } catch (e) {
        console.error("week plan failed", (e as Error).message);
      }
    }
  }
  return sent;
}

async function runScheduled() {
  // Price tracking runs even for people without notifications switched on
  let prices = { checked: 0, sent: 0 };
  try {
    const { date, hour } = ukParts();
    prices = await checkWishPrices(date, hour);
  } catch (e) {
    console.error("price tracking failed", (e as Error).message);
  }
  const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth");
  if (!subs?.length) return { users: 0, sent: prices.sent, pricesChecked: prices.checked };
  const byUser = new Map<string, Sub[]>();
  for (const s of subs as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const { data: prefRows } = await admin.from("notification_prefs").select("user_id,bills,matches,weather,weather_region,briefing").in("user_id", [...byUser.keys()]);
  const prefs = new Map((prefRows ?? []).map((p) => [p.user_id as string, p as { bills: boolean; matches: boolean; weather: boolean; weather_region: string; briefing: boolean }]));

  const { date: today, hour } = ukParts();
  const tomorrow = addDays(today, 1);
  let sent = 0;

  // ---- Morning briefing: once a day, from 7am UK time
  if (hour >= 7 && hour < 11) {
    const ids = [...byUser.keys()].filter((u) => prefs.get(u)?.briefing !== false);
    if (ids.length) {
      const in7 = addDays(today, 7);
      const [ev, bl, ml, ht, vh] = await Promise.all([
        admin.from("calendar_events").select("user_id,title,event_time").in("user_id", ids).eq("event_date", today).order("event_time"),
        admin.from("bills").select("user_id,name,amount,next_due_date").eq("is_active", true).in("user_id", ids).lte("next_due_date", tomorrow),
        admin.from("meal_plan").select("user_id,slot,title").in("user_id", ids).eq("day", today),
        admin.from("home_tasks").select("user_id,name").in("user_id", ids).lte("next_due", today),
        admin.from("vehicles").select("user_id,nickname,make,mot_due,tax_due,insurance_due").in("user_id", ids),
      ]);
      for (const uid of ids) {
        if (!(await once(uid, `brief-${today}`))) continue;
        const parts: string[] = [];
        const events = (ev.data ?? []).filter((x) => x.user_id === uid);
        if (events.length) parts.push(`📅 ${events.slice(0, 2).map((e) => `${e.event_time ? String(e.event_time).slice(0, 5) + " " : ""}${e.title}`).join(", ")}${events.length > 2 ? ` +${events.length - 2}` : ""}`);
        for (const b of (bl.data ?? []).filter((x) => x.user_id === uid).slice(0, 2))
          parts.push(`💷 ${b.name} ${gbp(Number(b.amount))} ${b.next_due_date === tomorrow ? "tomorrow" : b.next_due_date === today ? "today" : "overdue"}`);
        const dinner = (ml.data ?? []).find((x) => x.user_id === uid && x.slot === "dinner") ?? (ml.data ?? []).find((x) => x.user_id === uid);
        if (dinner) parts.push(`🍽️ ${dinner.slot === "dinner" ? "Dinner" : dinner.slot}: ${dinner.title}`);
        const jobs = (ht.data ?? []).filter((x) => x.user_id === uid);
        if (jobs.length) parts.push(`🏠 ${jobs.slice(0, 2).map((j) => j.name).join(", ")}${jobs.length > 2 ? ` +${jobs.length - 2}` : ""}`);
        for (const v of (vh.data ?? []).filter((x) => x.user_id === uid))
          for (const [k, label] of [["mot_due", "MOT"], ["tax_due", "Tax"], ["insurance_due", "Insurance"]] as const) {
            const d = v[k] as string | null;
            if (d && d <= in7) parts.push(`🚗 ${v.nickname || v.make || "Car"} ${label} ${d < today ? "overdue" : d === today ? "due today" : `due ${d.slice(8)}/${d.slice(5, 7)}`}`);
          }
        sent += await sendTo(byUser.get(uid)!, {
          title: "☀️ Good morning, here's your day",
          body: parts.length ? parts.join(" · ").slice(0, 230) : "Nothing due today. Enjoy it.",
          url: "/",
          tag: `brief-${today}`,
        });
      }
    }
  }

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

  // ---- Kick-off alerts: matches starting in the next 75 minutes, for each person's favourite teams
  const now = Date.now();
  const seen = new Set<string>();
  const { data: settings } = await admin.from("user_settings").select("user_id,prefs").in("user_id", [...byUser.keys()]);
  const teamsByUser = new Map<string, string[]>();
  for (const [uid] of byUser) {
    const p = (settings ?? []).find((x) => x.user_id === uid)?.prefs as { teams?: { id: string }[] } | null;
    const ids = (p?.teams ?? []).map((t) => String(t.id)).filter((id) => /^\d{3,9}$/.test(id));
    teamsByUser.set(uid, ids.length ? ids : TEAMS);
  }
  const allTeams = [...new Set([...teamsByUser.values()].flat())];
  for (const team of allTeams) {
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
          const mine = teamsByUser.get(userId) ?? TEAMS;
          if (!mine.includes(team) && !mine.includes(String(e.idHomeTeam)) && !mine.includes(String(e.idAwayTeam))) continue;
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
  // ---- Matchday: goal + full-time alerts for favourite teams' live matches (score from the app's /api/live,
  //      which shares one cached API-Football call between the app and this job)
  try {
    sent += await goalAlerts(allTeams, byUser, teamsByUser, prefs, now);
  } catch (err) {
    console.error("goal alerts failed", (err as Error).message);
  }

  // ---- Parking, usual train, Sunday night plan
  try {
    sent += await lifeAlerts(byUser, (settings ?? []) as { user_id: string; prefs: unknown }[], today, hour);
  } catch (err) {
    console.error("life alerts failed", (err as Error).message);
  }

  // ---- Met Office weather warnings for each person's region (7am–10pm)
  if (hour >= 7 && hour < 22) {
    const feeds = new Map<string, { title: string; desc: string; link: string }[]>();
    for (const [userId, userSubs] of byUser) {
      const p = prefs.get(userId);
      if (p?.weather === false) continue;
      const region = p?.weather_region ?? "wm";
      if (!feeds.has(region)) {
        try {
          const xml = await (await fetch(`https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/${region}`)).text();
          const tag = (x: string, n: string) => x.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`))?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() ?? "";
          feeds.set(
            region,
            [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => ({ title: tag(it, "title"), desc: tag(it, "description").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), link: tag(it, "link") })),
          );
        } catch {
          feeds.set(region, []);
        }
      }
      for (const w of feeds.get(region) ?? []) {
        if (!w.title) continue;
        const key = `wx-${region}-${w.title}-${w.desc.slice(0, 80)}`.slice(0, 250);
        if (!(await once(userId, key))) continue;
        const emoji = /\bred\b/i.test(w.title) ? "🔴" : /\bamber\b/i.test(w.title) ? "🟠" : "🟡";
        sent += await sendTo(userSubs, { title: `${emoji} ${w.title}`, body: w.desc.slice(0, 160) || "Tap for details.", url: "/weather", tag: "weather-warning" });
      }
    }
  }

  // ---- Wish-list deal alerts (HotUKDeals hot + new feeds), 8am–10pm
  if (hour >= 8 && hour < 22) {
    const { data: wishes } = await admin.from("wishlist_items").select("id,user_id,name,target_price").eq("purchased", false).in("user_id", [...byUser.keys()]);
    if (wishes?.length) {
      const stop = new Set(["the", "and", "for", "with", "pack", "set", "new", "of", "in", "to"]);
      const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
      const items: { title: string; link: string; price: string | null; merchant: string | null }[] = [];
      for (const feed of ["hot", "new"]) {
        try {
          const xml = await (await fetch(`https://www.hotukdeals.com/rss/${feed}`, { headers: { "User-Agent": "LifeHub/1.0 (personal dashboard)" } })).text();
          for (const [, it] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
            const title = (it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? "").replace(/^-?\d+°\s*-\s*/, "").trim();
            const link = it.match(/<link>([^<]+)<\/link>/)?.[1] ?? "";
            const price = it.match(/<pepper:merchant[^>]*price="([^"]*)"/)?.[1] ?? null;
            const merchant = it.match(/<pepper:merchant[^>]*name="([^"]*)"/)?.[1] ?? null;
            if (title && link) items.push({ title, link, price, merchant });
          }
        } catch {
          /* feed down — try next run */
        }
      }
      for (const w of wishes) {
        if (prefs.get(w.user_id)?.matches === false && prefs.get(w.user_id)?.bills === false) continue;
        const ws = words(w.name);
        if (!ws.length) continue;
        for (const d of items) {
          const t = d.title.toLowerCase();
          if (ws.filter((x) => t.includes(x)).length < Math.max(1, Math.ceil(ws.length * 0.6))) continue;
          const id = d.link.match(/(\d+)(?:[/?#]|$)/)?.[1] ?? d.link;
          if (!(await once(w.user_id, `deal-${w.id}-${id}`))) continue;
          sent += await sendTo(byUser.get(w.user_id)!, {
            title: `🎁 Deal on your wish list: ${w.name}`,
            body: `${d.title}${d.price ? ` — ${d.price}` : ""}${d.merchant ? ` at ${d.merchant}` : ""}`.slice(0, 170),
            url: "/deals",
            tag: `deal-${w.id}`,
          });
        }
      }
    }
  }

  return { users: byUser.size, sent: sent + prices.sent, pricesChecked: prices.checked };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // The public key is safe to share (browsers need it to subscribe); the private key never leaves the server.
  if (req.method === "GET") return json({ configured, publicKey: VAPID_PUBLIC || null, publicKeyLength: VAPID_PUBLIC.length, privateKeyLength: VAPID_PRIVATE.length, error: configError });
  if (!configured) return json({ ok: false, error: configError }, 503);

  const body = await req.json().catch(() => ({}));
  if (body?.test) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ ok: false, error: "Sign in first" }, 401);
    const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").eq("user_id", u.user.id);
    const sent = await sendTo((subs ?? []) as Sub[], { title: "🎉 Notifications are on", body: "LifeHub will remind you about bills and kick-offs.", url: "/settings", tag: "test" });
    return json({ ok: true, sent, devices: subs?.length ?? 0 });
  }

  const result = await runScheduled();
  return json({ ok: true, ...result });
});
