"use client";

import {
  Bell,
  CalendarDays,
  CloudSun,
  Dumbbell,
  Newspaper,
  Plane,
  ReceiptPoundSterling,
  Salad,
  Store,
  Tag,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type CardId =
  | "calendar"
  | "weather"
  | "bills"
  | "football"
  | "news"
  | "sport-news"
  | "activity"
  | "nutrition"
  | "travel"
  | "shopping"
  | "local"
  | "reminders";

export type CardDef = {
  id: CardId;
  title: string;
  icon: LucideIcon;
  color: string;
  href: string;
  phase: number;
  /** What the card will show once it's connected */
  promise: string;
  wide?: boolean;
};

export const cards: CardDef[] = [
  { id: "calendar", title: "Coming up", icon: CalendarDays, color: "var(--c-travel)", href: "/calendar", phase: 1, promise: "Your next events, bills and matches.", wide: true },
  { id: "weather", title: "Weather", icon: CloudSun, color: "var(--c-travel)", href: "/weather", phase: 3, promise: "Today's forecast for your area." },
  { id: "bills", title: "Upcoming bills", icon: ReceiptPoundSterling, color: "var(--c-money)", href: "/bills", phase: 1, promise: "What's due in the next 7 days and anything overdue." },
  { id: "football", title: "Aston Villa & England", icon: Trophy, color: "var(--c-sport)", href: "/sport", phase: 4, promise: "Next match and recent results." },
  { id: "activity", title: "Steps & activity", icon: Dumbbell, color: "var(--c-health)", href: "/health", phase: 5, promise: "Steps, distance and active calories from your Apple Watch." },
  { id: "nutrition", title: "Calories & nutrition", icon: Salad, color: "var(--c-health)", href: "/health", phase: 5, promise: "Today's calories, protein, carbs and fat." },
  { id: "news", title: "Latest news", icon: Newspaper, color: "var(--c-news)", href: "/news", phase: 4, promise: "Top UK headlines." },
  { id: "sport-news", title: "Football headlines", icon: Trophy, color: "var(--c-sport)", href: "/news", phase: 4, promise: "The latest football news." },
  { id: "travel", title: "Travel deals", icon: Plane, color: "var(--c-travel)", href: "/travel", phase: 3, promise: "Cheapest flights and holidays to your saved destinations." },
  { id: "shopping", title: "Shopping discounts", icon: Tag, color: "var(--c-shop)", href: "/deals", phase: 3, promise: "Verified deals and wish-list price drops." },
  { id: "local", title: "Local offers", icon: Store, color: "var(--c-discover)", href: "/explore", phase: 3, promise: "Things to do and offers near you." },
  { id: "reminders", title: "Reminders", icon: Bell, color: "var(--c-shop)", href: "/calendar", phase: 1, promise: "Reminders you've added to the calendar." },
];

export type DashboardPrefs = { order: CardId[]; hidden: CardId[] };

const KEY = "mlh.dashboard.v1";
const defaults: DashboardPrefs = { order: cards.map((c) => c.id), hidden: [] };

function read(): DashboardPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as DashboardPrefs;
    const known = new Set(cards.map((c) => c.id));
    // keep saved order, drop unknown ids, append any new cards added in later versions
    const order = p.order.filter((id) => known.has(id));
    for (const c of cards) if (!order.includes(c.id)) order.push(c.id);
    return { order, hidden: (p.hidden ?? []).filter((id) => known.has(id)) };
  } catch {
    return defaults;
  }
}

export function useDashboardPrefs() {
  const [prefs, setPrefs] = useState<DashboardPrefs>(defaults);
  useEffect(() => setPrefs(read()), []);

  const save = useCallback((p: DashboardPrefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (id: CardId) =>
    save({ ...prefs, hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((h) => h !== id) : [...prefs.hidden, id] });

  const move = (id: CardId, dir: -1 | 1) => {
    const order = [...prefs.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    save({ ...prefs, order });
  };

  const reset = () => save(defaults);

  return { prefs, toggle, move, reset };
}
