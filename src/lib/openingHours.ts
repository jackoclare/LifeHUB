// Small reader for OpenStreetMap opening_hours strings, enough for the common forms:
//   "24/7", "Mo-Fr 09:00-17:30; Sa 10:00-16:00; Su off", "Mo-Su 11:00-23:00", "Tu-Th,Su 12:00-14:30,17:00-22:00"
// Returns true (open), false (closed) or null when the string is too unusual to judge.

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function daySet(spec: string): Set<number> | null {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = DAYS.indexOf(m[1]);
    const b = m[2] ? DAYS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) {
      out.add(i);
      if (i === b) break;
    }
  }
  return out;
}

const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** UK-local day index (Mo=0) and minutes past midnight */
function ukNow(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  return { day, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}

export function isOpenNow(hours: string | null | undefined, at = new Date()): boolean | null {
  if (!hours) return null;
  const h = hours.trim();
  if (h === "24/7") return true;
  const { day, min } = ukNow(at);
  const yesterday = (day + 6) % 7;
  let decided: boolean | null = null;
  let understood = false;

  for (const rule of h.split(";").map((r) => r.trim()).filter(Boolean)) {
    // "Mo-Fr 09:00-17:00" or just "09:00-17:00" (every day)
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? daySet(m[1].replace(/,$/, "")) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    const times = m[2].trim();
    if (/^(off|closed)$/i.test(times)) {
      if (days.has(day)) decided = false;
      understood = true;
      continue;
    }
    const ranges = times.split(",").map((r) => r.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/));
    if (!ranges.length || ranges.some((r) => !r)) return null;
    understood = true;
    // Later rules override earlier ones for the days they mention (OSM semantics)
    if (days.has(day)) decided = false;
    for (const r of ranges as RegExpMatchArray[]) {
      const a = mins(r[1]);
      let b = mins(r[2]);
      if (b <= a) b += 24 * 60; // runs past midnight
      if (days.has(day) && min >= a && min < b) decided = true;
      if (days.has(yesterday) && b > 24 * 60 && min < b - 24 * 60) decided = true;
    }
  }
  if (!understood) return null;
  return decided ?? false;
}
