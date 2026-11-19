import type { Bin, BinSetup } from "@/lib/prefs";

/** Bin collection maths: each bin has one known collection date (anchor) and repeats every 1, 2 or 4 weeks. */

export const BIN_PRESETS: Omit<Bin, "id" | "anchor">[] = [
  { name: "General waste", colour: "#6b7280", every: 2 },
  { name: "Recycling", colour: "#7c6cff", every: 2 },
  { name: "Garden waste", colour: "#00c46a", every: 2 },
  { name: "Food waste", colour: "#a16207", every: 1 },
  { name: "Glass box", colour: "#2f9bff", every: 4 },
];

const DAY = 86400e3;
const parse = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Next collection date for a bin on or after `from` (YYYY-MM-DD). */
export function nextFor(bin: Bin, from: string): string {
  const a = parse(bin.anchor);
  const f = parse(from);
  const step = bin.every * 7 * DAY;
  if (f <= a) {
    // step backwards so an anchor in the future still gives the earliest date on/after `from`
    const back = Math.floor((a - f) / step);
    return fmt(a - back * step);
  }
  const k = Math.ceil((f - a) / step);
  return fmt(a + k * step);
}

/** Collections grouped by date for the next `weeks` weeks. */
export function upcomingCollections(setup: BinSetup | null | undefined, from: string, weeks = 6) {
  if (!setup?.bins.length) return [];
  const end = fmt(parse(from) + weeks * 7 * DAY);
  const byDate = new Map<string, Bin[]>();
  for (const b of setup.bins) {
    let d = nextFor(b, from);
    while (d <= end) {
      byDate.set(d, [...(byDate.get(d) ?? []), b]);
      d = fmt(parse(d) + b.every * 7 * DAY);
    }
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, bins]) => ({ date, bins }));
}

export const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
