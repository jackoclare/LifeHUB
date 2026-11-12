/**
 * MyLife assistant — understands everyday commands without any paid AI.
 * parse() turns a sentence into an intent; the UI carries it out.
 */

export type Intent =
  | { kind: "shopping"; items: { name: string; quantity: number }[]; list?: string }
  | { kind: "wishlist"; name: string }
  | { kind: "event"; title: string; date: string; time?: string; reminder: boolean }
  | { kind: "navigate"; href: string; label: string }
  | { kind: "weather" }
  | { kind: "nextMatch"; team: "villa" | "england" | "any" }
  | { kind: "billsDue" }
  | { kind: "billsTotal" }
  | { kind: "directions"; dest: string; from?: string }
  | { kind: "fuel"; fuel: "E10" | "E5" | "B7_Standard" }
  | { kind: "help" }
  | { kind: "unknown"; text: string };

const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, dozen: 12, couple: 2 };
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PAGES: [RegExp, string, string][] = [
  [/\bbills?\b|\bspending\b/, "/bills", "Bills"],
  [/\bcalendar\b|\bdiary\b|\bschedule\b/, "/calendar", "Calendar"],
  [/\bshopping\b/, "/shopping", "Shopping list"],
  [/\bwish ?list\b/, "/wishlist", "Wish list"],
  [/\bweather\b|\bforecast\b/, "/weather", "Weather"],
  [/\bnews\b|\bheadlines\b/, "/news", "News"],
  [/\bf1\b|\bformula (1|one)\b|\bgrand prix\b/, "/sport", "Sport"],
  [/\bdarts\b/, "/sport", "Sport"],
  [/\bsport\b|\bfootball\b|\bfixtures?\b|\bscores?\b|\btable\b/, "/sport", "Sport"],
  [/\bmaps?\b|\bsat ?nav\b/, "/map", "Map"],
  [/\btravel\b|\bholidays?\b|\bflights?\b/, "/travel", "Travel"],
  [/\bexplore\b|\brestaurants?\b|\bpubs?\b|\bcaf(e|é)s?\b|\bthings to do\b/, "/explore", "Explore"],
  [/\bfuel\b|\bpetrol\b|\bdiesel\b/, "/fuel", "Fuel"],
  [/\bsettings\b/, "/settings", "Settings"],
  [/\bhome\b|\bdashboard\b/, "/", "Dashboard"],
];

/** Parse a date phrase. Returns ISO date or null. */
export function parseDate(text: string, now = new Date()): string | null {
  const t = text.toLowerCase();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\btoday\b|\btonight\b/.test(t)) return iso(base);
  if (/\btomorrow\b/.test(t)) return iso(new Date(base.getTime() + 86400000));
  const inDays = t.match(/\bin (\d+|a|one|two|three|four|five|six|seven) (day|week)s?\b/);
  if (inDays) {
    const n = NUMBERS[inDays[1]] ?? Number(inDays[1]);
    const d = new Date(base);
    d.setDate(d.getDate() + n * (inDays[2] === "week" ? 7 : 1));
    return iso(d);
  }
  const wd = t.match(/\b(next |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    let diff = (target - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    if (wd[1] === "next " && diff < 7 && base.getDay() !== 0 && target > base.getDay()) diff += 7;
    const d = new Date(base);
    d.setDate(d.getDate() + diff);
    return iso(d);
  }
  // 20th november / november 20 / 20 nov
  const m1 = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?(?: of)? (jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/);
  const m2 = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?\b/);
  const md = m1 ? { day: Number(m1[1]), mon: m1[2] } : m2 ? { day: Number(m2[2]), mon: m2[1] } : null;
  if (md) {
    const month = MONTHS.findIndex((m) => m.startsWith(md.mon.slice(0, 3)));
    let d = new Date(base.getFullYear(), month, md.day);
    if (d < base) d = new Date(base.getFullYear() + 1, month, md.day);
    return iso(d);
  }
  // 20/11 or 20-11
  const num = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (num) {
    const y = num[3] ? (num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3])) : base.getFullYear();
    let d = new Date(y, Number(num[2]) - 1, Number(num[1]));
    if (!num[3] && d < base) d = new Date(y + 1, Number(num[2]) - 1, Number(num[1]));
    return iso(d);
  }
  // "on the 20th"
  const th = t.match(/\b(?:on )?the (\d{1,2})(?:st|nd|rd|th)\b/);
  if (th) {
    let d = new Date(base.getFullYear(), base.getMonth(), Number(th[1]));
    if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, Number(th[1]));
    return iso(d);
  }
  return null;
}

/** Parse a time phrase → "HH:MM" or null. */
export function parseTime(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bnoon\b|\bmidday\b/.test(t)) return "12:00";
  if (/\bmidnight\b/.test(t)) return "00:00";
  const m = t.match(/\b(?:at )?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/) ?? t.match(/\bat (\d{1,2})(?:[:.](\d{2}))?\b/) ?? t.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && m[0].startsWith("at") && h >= 1 && h <= 7) h += 12; // "at 3" → 3pm
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Remove date/time words from a title. */
function stripWhen(s: string) {
  return s
    .replace(/\b(on |for |this |next )?(today|tonight|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, "")
    .replace(/\bin (\d+|a|one|two|three|four|five|six|seven) (day|week)s?\b/gi, "")
    .replace(/\b(on )?(the )?\d{1,2}(st|nd|rd|th)?( of)? (jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi, "")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]* \d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/\b(on )?the \d{1,2}(st|nd|rd|th)\b/gi, "")
    .replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, "")
    .replace(/\b(at )?\d{1,2}([:.]\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/gi, "")
    .replace(/\bat \d{1,2}([:.]\d{2})?\b/gi, "")
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, "")
    .replace(/\b(at )?(noon|midday|midnight)\b/gi, "")
    .replace(/\s+(on|at|for)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitItems(s: string) {
  return s
    .split(/,|\band\b|\bplus\b|&/i)
    .map((x) => x.trim().replace(/^(some|a few|few|more)\s+/i, ""))
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|dozen|couple(?: of)?)\s+(?:x\s+)?(.+)$/i);
      if (m) {
        const q = NUMBERS[m[1].toLowerCase().replace(" of", "")] ?? Number(m[1]);
        return { name: cap(m[2].replace(/^of\s+/i, "")), quantity: q || 1 };
      }
      return { name: cap(x), quantity: 1 };
    });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function parse(input: string, now = new Date()): Intent {
  const raw = input.trim().replace(/[.!?]+$/, "");
  // keep original capitals for names/titles; match on a lower-case copy
  const src = raw.replace(/^(hey |ok |okay )?(mylife|my life|assistant)[,\s]*/i, "").replace(/^(please |can you |could you |will you )+/i, "");
  const t = src.toLowerCase();
  const on = (re: RegExp) => src.match(new RegExp(re.source, re.flags.includes("i") ? re.flags : re.flags + "i"));
  if (!t) return { kind: "unknown", text: input };
  if (/^(help|what can you do)/.test(t)) return { kind: "help" };

  // Shopping list
  const shop =
    on(/^(?:add|put|stick|pop)\s+(.+?)\s+(?:to|on|onto)\s+(?:the |my )?(?:(\w+)\s+)?(?:shopping(?: list)?|list)$/) ??
    on(/^(?:i |we )?(?:need(?: to buy)?|buy|get|pick up)\s+(.+)$/);
  if (shop && !/\bcalendar\b|\bwish ?list\b|\bdiary\b/.test(t)) {
    const list = shop[2] && !["the", "my", "a", "shopping"].includes(shop[2].toLowerCase()) ? shop[2] : undefined;
    return { kind: "shopping", items: splitItems(shop[1]), list };
  }

  // Wish list
  const wish = on(/^(?:add|put)\s+(?:a |an |the )?(.+?)\s+(?:to|on)\s+(?:the |my )?wish ?list$/) ?? on(/^i (?:want|would like|fancy)\s+(?:a |an |the )?(.+)$/);
  if (wish) return { kind: "wishlist", name: cap(wish[1]) };

  // Reminders & calendar events
  const remind = on(/^remind me (?:to |about )?(.+)$/);
  if (remind) {
    const date = parseDate(remind[1], now) ?? iso(now);
    return { kind: "event", title: cap(stripWhen(remind[1])), date, time: parseTime(remind[1]) ?? undefined, reminder: true };
  }
  const cal = on(/^(?:add|put|book|schedule|create)\s+(?:an? )?(?:event |appointment )?(.+?)(?:\s+(?:to|on|in)\s+(?:the |my )?(?:calendar|diary))?$/);
  if (cal && (parseDate(t, now) || /\bcalendar\b|\bdiary\b/.test(t))) {
    const body = cal[1].replace(/\s+(to|on|in)\s+(the |my )?(calendar|diary)/i, "");
    const date = parseDate(body, now) ?? parseDate(t, now) ?? iso(now);
    return { kind: "event", title: cap(stripWhen(body)) || "Event", date, time: parseTime(body) ?? undefined, reminder: false };
  }
  // "dentist friday at 3pm" (no verb but has a date)
  if (!/\?$/.test(raw) && !/^(what|when|where|how|show|open|go|take)/.test(t) && parseDate(t, now) && stripWhen(t).split(" ").length <= 6) {
    return { kind: "event", title: cap(stripWhen(src)), date: parseDate(t, now)!, time: parseTime(t) ?? undefined, reminder: false };
  }

  // Questions
  if (/\bweather\b|\brain\b|\bcold\b|\bhot\b|\bumbrella\b|\bcoat\b/.test(t) && !/^(show|open|go)/.test(t)) return { kind: "weather" };
  if (/\b(next|when).*(game|match|playing|kick ?off)|\b(villa|england)\b.*(play|game|match)/.test(t)) {
    return { kind: "nextMatch", team: /villa/.test(t) ? "villa" : /england/.test(t) ? "england" : "any" };
  }
  if (/\b(cheap|cheapest|price|prices|cost|how much)\b.*\b(fuel|petrol|diesel|unleaded)\b|\b(fuel|petrol|diesel|unleaded)\b.*\b(cheap|cheapest|price|prices|near)\b/.test(t)) {
    return { kind: "fuel", fuel: /diesel/.test(t) ? "B7_Standard" : /super|premium|e5/.test(t) ? "E5" : "E10" };
  }
  if (/how much.*(bills?|spend|pay)|bills? total|total.*bills?/.test(t)) return { kind: "billsTotal" };
  if (/(what|which|any).*(bills?).*(due|coming|owe)|bills? (due|this week)/.test(t)) return { kind: "billsDue" };

  // Directions: "take me to Tesco Extra", "how long to get to Villa Park", "directions to B90 4RT"
  const dir =
    t.match(/^(?:please )?(?:take me|directions|navigate|drive|route|sat ?nav|get me|guide me)(?: me)?(?: to| over to| down to)? (?:the )?(.+?)[?.!]*$/) ??
    t.match(/how (?:long|far)(?: is it| will it take| does it take)?(?: me)?(?: to (?:get|drive))? to (?:the )?(.+?)[?.!]*$/);
  const fromTo = t.match(/^(?:.*?\b)?(?:directions|route|drive|take me|get me|how (?:long|far)(?: is it)?)?\s*from (.+?) to (.+?)[?.!]*$/);
  if (fromTo && fromTo[1].trim() && fromTo[2].trim()) {
    const f = fromTo[1].trim();
    return { kind: "directions", dest: fromTo[2].replace(/^the /, "").trim(), from: /^(here|my location|current location|where i am)$/.test(f) ? undefined : f };
  }
  if (dir) {
    const dest = dir[1].replace(/\b(please|from here|now)\b/g, "").trim();
    const isPage = PAGES.some(([re]) => re.test(dest)) && dest.split(" ").length <= 2 && !/\b(tesco|asda|aldi|lidl|station|park|road|street|hospital|airport)\b/.test(dest);
    if (dest && !isPage) return { kind: "directions", dest };
  }

  // Navigation
  if (/^(show|open|go to|take me to|see|view|display|let me see)\b|^(my )?\w+( page)?$/.test(t) || /\bshow me\b/.test(t)) {
    for (const [re, href, label] of PAGES) if (re.test(t)) return { kind: "navigate", href, label };
  }
  for (const [re, href, label] of PAGES) if (re.test(t) && t.split(" ").length <= 3) return { kind: "navigate", href, label };

  return { kind: "unknown", text: input };
}
