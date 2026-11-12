// MyLife Hub — calendar subscription feed (iCalendar / .ics)
// GET /functions/v1/calendar?token=<private token>
// Includes: your own events & reminders, bill due dates (next 12 months), Aston Villa & England fixtures.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TEAMS = ["133601", "133914"];

type Bill = { id: string; name: string; amount: number; frequency: string; next_due_date: string; provider: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (iso: string) => iso.replaceAll("-", "");
const utcStamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => {
  // RFC 5545: lines longer than 75 octets are folded
  const out: string[] = [];
  let s = line;
  while (s.length > 74) {
    out.push(s.slice(0, 74));
    s = " " + s.slice(74);
  }
  out.push(s);
  return out.join("\r\n");
};
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function addMonths(iso: string, months: number, anchor: number) {
  const [y, m] = iso.split("-").map(Number);
  const total = m - 1 + months;
  const yy = y + Math.floor(total / 12);
  const mm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  return `${yy}-${pad(mm + 1)}-${pad(Math.min(anchor, last))}`;
}
function addDaysIso(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function occurrences(b: Bill, until: string) {
  const out: string[] = [];
  const anchor = Number(b.next_due_date.slice(8, 10));
  let cur: string | null = b.next_due_date;
  let i = 0;
  while (cur && cur <= until && i++ < 400) {
    out.push(cur);
    switch (b.frequency) {
      case "weekly": cur = addDaysIso(cur, 7); break;
      case "fortnightly": cur = addDaysIso(cur, 14); break;
      case "four_weekly": cur = addDaysIso(cur, 28); break;
      case "monthly": cur = addMonths(cur, 1, anchor); break;
      case "quarterly": cur = addMonths(cur, 3, anchor); break;
      case "six_monthly": cur = addMonths(cur, 6, anchor); break;
      case "annually": cur = addMonths(cur, 12, anchor); break;
      default: cur = null;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{40,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const { data: settings } = await admin.from("user_settings").select("user_id").eq("calendar_token", token).maybeSingle();
  if (!settings) return new Response("Not found", { status: 404 });
  const userId = settings.user_id as string;

  const now = new Date();
  const stamp = utcStamp(now);
  const today = now.toISOString().slice(0, 10);
  const until = addDaysIso(today, 366);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyLife Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:MyLife Hub",
    "X-WR-TIMEZONE:Europe/London",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  const push = (...l: string[]) => lines.push(...l.map(fold));

  // Your own events
  const { data: events } = await admin.from("calendar_events").select("id,title,event_date,event_time,kind,notes").eq("user_id", userId).gte("event_date", addDaysIso(today, -60));
  for (const e of events ?? []) {
    push("BEGIN:VEVENT", `UID:event-${e.id}@mylifehub`, `DTSTAMP:${stamp}`);
    if (e.event_time) {
      const [h, m] = String(e.event_time).split(":");
      push(`DTSTART;TZID=Europe/London:${ymd(e.event_date)}T${h}${m}00`, "DURATION:PT1H");
    } else {
      push(`DTSTART;VALUE=DATE:${ymd(e.event_date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(e.event_date))}`);
    }
    push(`SUMMARY:${esc(e.kind === "reminder" ? `🔔 ${e.title}` : e.title)}`);
    if (e.notes) push(`DESCRIPTION:${esc(e.notes)}`);
    if (e.kind === "reminder") push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "TRIGGER:-PT30M", "END:VALARM");
    push("END:VEVENT");
  }

  // Bills
  const { data: bills } = await admin.from("bills").select("id,name,amount,frequency,next_due_date,provider").eq("user_id", userId).eq("is_active", true);
  const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
  for (const b of (bills ?? []) as Bill[]) {
    for (const d of occurrences(b, until)) {
      push(
        "BEGIN:VEVENT",
        `UID:bill-${b.id}-${d}@mylifehub`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(d)}`,
        `DTEND;VALUE=DATE:${ymd(nextDay(d))}`,
        `SUMMARY:${esc(`💷 ${b.name} – ${gbp(Number(b.amount))}`)}`,
        `DESCRIPTION:${esc(`Bill due${b.provider ? ` (${b.provider})` : ""}. Open LifeHub → Bills to mark it paid.`)}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      );
    }
  }

  // Football fixtures — the person's favourite teams (Profile → preferences), or Villa & England by default
  const { data: st } = await admin.from("user_settings").select("prefs").eq("user_id", userId).maybeSingle();
  const myTeams = ((st?.prefs as { teams?: { id: string }[] } | null)?.teams ?? []).map((t) => String(t.id)).filter((id) => /^\d{3,9}$/.test(id));
  const seen = new Set<string>();
  for (const team of myTeams.length ? myTeams : TEAMS) {
    try {
      const j = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${team}`).then((r) => r.json());
      for (const e of (j?.events ?? []) as Record<string, string>[]) {
        if (seen.has(e.idEvent) || !e.strTimestamp) continue;
        seen.add(e.idEvent);
        const start = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`);
        if (Number.isNaN(start.getTime())) continue;
        push(
          "BEGIN:VEVENT",
          `UID:match-${e.idEvent}@mylifehub`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${utcStamp(start)}`,
          "DURATION:PT2H",
          `SUMMARY:${esc(`⚽ ${e.strHomeTeam} v ${e.strAwayTeam}`)}`,
          `DESCRIPTION:${esc(`${e.strLeague ?? ""}\nLineups: https://life-hub-nine-rouge.vercel.app/sport/match/${e.idEvent}`)}`,
          ...(e.strVenue ? [`LOCATION:${esc(e.strVenue)}`] : []),
          "END:VEVENT",
        );
      }
    } catch {
      /* fixtures are optional */
    }
  }

  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900", "Content-Disposition": 'inline; filename="mylife-hub.ics"' },
  });
});
