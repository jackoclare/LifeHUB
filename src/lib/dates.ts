export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function formatDay(iso: string) {
  const today = toISODate(new Date());
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  return fromISODate(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
