import {
  CalendarDays,
  Dumbbell,
  Fuel,
  Gift,
  House,
  LayoutGrid,
  MapPinned,
  Plane,
  ReceiptPoundSterling,
  Settings,
  ShoppingBasket,
  Tag,
  Trophy,
  Tv,
  type LucideIcon,
} from "lucide-react";

export type Section = {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  /** CSS variable for the section colour */
  color: string;
  phase: number;
  blurb: string;
  group: "Home" | "Money & lists" | "Discover" | "Sport & TV" | "Health" | "App";
};

export const sections: Section[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: House, color: "var(--accent)", phase: 1, group: "Home", blurb: "Your day at a glance." },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, color: "var(--c-travel)", phase: 1, group: "Home", blurb: "Bills, matches, trips and reminders in one calendar." },

  { href: "/bills", label: "Bills", icon: ReceiptPoundSterling, color: "var(--c-money)", phase: 2, group: "Money & lists", blurb: "Track bills, due dates and monthly spending." },
  { href: "/shopping", label: "Shopping list", short: "Shopping", icon: ShoppingBasket, color: "var(--c-shop)", phase: 2, group: "Money & lists", blurb: "Supermarket lists you can tick off as you go." },
  { href: "/wishlist", label: "Wish list", icon: Gift, color: "var(--c-shop)", phase: 2, group: "Money & lists", blurb: "Things you want, with target prices and price drops." },

  { href: "/deals", label: "Deals", icon: Tag, color: "var(--c-shop)", phase: 3, group: "Discover", blurb: "Verified deals from the retailers you care about." },
  { href: "/travel", label: "Travel", icon: Plane, color: "var(--c-travel)", phase: 3, group: "Discover", blurb: "Cheapest flights and holidays on a map." },
  { href: "/fuel", label: "Fuel", icon: Fuel, color: "var(--c-discover)", phase: 3, group: "Discover", blurb: "Cheapest and nearest UK fuel prices." },
  { href: "/explore", label: "Explore", icon: MapPinned, color: "var(--c-discover)", phase: 3, group: "Discover", blurb: "Restaurants, pubs, days out and events near you." },

  { href: "/sport", label: "Sport", icon: Trophy, color: "var(--c-sport)", phase: 4, group: "Sport & TV", blurb: "Live scores, fixtures, tables and football news." },
  { href: "/tv", label: "TV guide", short: "TV", icon: Tv, color: "var(--c-tv)", phase: 4, group: "Sport & TV", blurb: "What's on tonight across UK and Sky channels." },

  { href: "/health", label: "Health", icon: Dumbbell, color: "var(--c-health)", phase: 5, group: "Health", blurb: "Apple Watch activity, food diary and nutrition." },

  { href: "/settings", label: "Settings", icon: Settings, color: "var(--c-news)", phase: 1, group: "App", blurb: "Theme, dashboard and notification preferences." },
];

/** The five tabs on the iPhone bottom bar. */
export const mobileTabs = [
  sections[0], // Home
  sections[1], // Calendar
  sections.find((s) => s.href === "/bills")!,
  sections.find((s) => s.href === "/sport")!,
  { href: "/menu", label: "More", short: "More", icon: LayoutGrid, color: "var(--text-muted)", phase: 1, group: "App", blurb: "" } satisfies Section,
];

export const groups = ["Home", "Money & lists", "Discover", "Sport & TV", "Health", "App"] as const;

export function findSection(href: string) {
  return sections.find((s) => s.href === href);
}

export const phaseNames: Record<number, string> = {
  1: "Foundations",
  2: "Personal management",
  3: "Discovery & shopping",
  4: "Sport & entertainment",
  5: "Health & fitness",
  6: "Notifications & polish",
};
