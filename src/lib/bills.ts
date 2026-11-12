import type { Bill, Frequency } from "./types";
import { fromISODate, toISODate } from "./dates";

export const frequencyLabel: Record<Frequency, string> = {
  weekly: "Weekly",
  fortnightly: "Every 2 weeks",
  four_weekly: "Every 4 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  six_monthly: "Every 6 months",
  annually: "Yearly",
  one_off: "One-off",
};

export const billCategories = [
  "Housing",
  "Utilities",
  "Water",
  "Council tax",
  "Phone & internet",
  "Insurance",
  "Car & travel",
  "Subscriptions",
  "Credit & loans",
  "Health & fitness",
  "Other",
] as const;

/** How many of this bill fall in an average month. */
const perMonth: Record<Frequency, number> = {
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  four_weekly: 13 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  six_monthly: 1 / 6,
  annually: 1 / 12,
  one_off: 0,
};

export function monthlyEquivalent(b: Pick<Bill, "amount" | "frequency">) {
  return Number(b.amount) * perMonth[b.frequency];
}

function addMonthsClamped(d: Date, months: number, anchorDay: number) {
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(anchorDay, last));
}

/** The due date after `iso` for a given frequency. `anchorDay` keeps e.g. the 31st from drifting. */
export function nextDate(iso: string, f: Frequency, anchorDay?: number): string | null {
  const d = fromISODate(iso);
  const day = anchorDay ?? d.getDate();
  switch (f) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      return toISODate(d);
    case "fortnightly":
      d.setDate(d.getDate() + 14);
      return toISODate(d);
    case "four_weekly":
      d.setDate(d.getDate() + 28);
      return toISODate(d);
    case "monthly":
      return toISODate(addMonthsClamped(d, 1, day));
    case "quarterly":
      return toISODate(addMonthsClamped(d, 3, day));
    case "six_monthly":
      return toISODate(addMonthsClamped(d, 6, day));
    case "annually":
      return toISODate(addMonthsClamped(d, 12, day));
    case "one_off":
      return null;
  }
}

/** Every due date for an active bill between two dates (inclusive), starting at next_due_date. */
export function occurrences(b: Bill, fromISO: string, toISO: string, limit = 400): string[] {
  if (!b.is_active) return [];
  const out: string[] = [];
  const anchor = fromISODate(b.next_due_date).getDate();
  let cur: string | null = b.next_due_date;
  let guard = 0;
  while (cur && cur <= toISO && guard++ < limit) {
    if (cur >= fromISO) out.push(cur);
    cur = nextDate(cur, b.frequency, anchor);
  }
  return out;
}

export function isOverdue(b: Bill, todayISO = toISODate(new Date())) {
  return b.is_active && b.next_due_date < todayISO;
}

export function daysUntil(iso: string) {
  const today = fromISODate(toISODate(new Date()));
  return Math.round((fromISODate(iso).getTime() - today.getTime()) / 86_400_000);
}

export function dueLabel(iso: string) {
  const n = daysUntil(iso);
  if (n < -1) return `${-n} days overdue`;
  if (n === -1) return "1 day overdue";
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n < 7) return `Due in ${n} days`;
  return `Due ${fromISODate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/** Projected cost per calendar month for the next `months` months (from this month). */
export function projectByMonth(bills: Bill[], months = 12) {
  const now = new Date();
  const result: { key: string; label: string; total: number }[] = [];
  for (let i = 0; i < months; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    const s = toISODate(start);
    const e = toISODate(end);
    let total = 0;
    for (const b of bills) total += occurrences(b, s, e).length * Number(b.amount);
    result.push({ key: s.slice(0, 7), label: start.toLocaleDateString("en-GB", { month: "short" }), total });
  }
  return result;
}
