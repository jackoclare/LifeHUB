import {
  CalendarDays,
  CloudSun,
  Dumbbell,
  Fuel,
  Gift,
  House,
  MapPinned,
  Newspaper,
  Plane,
  ReceiptPoundSterling,
  Settings,
  ShoppingBasket,
  Tag,
  Trophy,
  Tv,
  type LucideIcon, Map as MapIcon, Sparkles as SparklesIcon, Bell, Car, FolderLock, Compass, CircleUserRound, Wallet, ChefHat, Hammer as HomeIcon } from "lucide-react";

export type Section = {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  /** CSS variable for the section colour */
  color: string;
  phase: number;
  blurb: string;
  group: Hub;
};

export const sections: Section[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: House, color: "var(--accent)", phase: 1, group: "Home", blurb: "Your day at a glance." },
  { href: "/alerts", label: "Alerts", icon: Bell, color: "#ff3b30", phase: 6, group: "Home", blurb: "Everything that needs your attention, in one place." },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, color: "var(--c-travel)", phase: 1, group: "Home & life", blurb: "Bills, matches, trips and reminders in one calendar." },

  { href: "/money", label: "Money", icon: Wallet, color: "var(--c-money)", phase: 2, group: "Money", blurb: "Income vs bills, savings goals and repayment calculators." },
  { href: "/bills", label: "Bills", icon: ReceiptPoundSterling, color: "var(--c-money)", phase: 2, group: "Money", blurb: "Track bills, due dates and monthly spending." },
  { href: "/shopping", label: "Shopping list", short: "Shopping", icon: ShoppingBasket, color: "var(--c-shop)", phase: 2, group: "Food & shopping", blurb: "Supermarket lists you can tick off as you go." },
  { href: "/meals", label: "Meal planner", short: "Meals", icon: ChefHat, color: "var(--c-shop)", phase: 3, group: "Food & shopping", blurb: "Plan the week's meals and send the ingredients to your shopping list." },
  { href: "/home", label: "Household", icon: HomeIcon, color: "var(--c-money)", phase: 3, group: "Home & life", blurb: "Cleaning rota, maintenance and garden jobs that come back round." },
  { href: "/documents", label: "Documents", icon: FolderLock, color: "var(--c-tv)", phase: 2, group: "Home & life", blurb: "Private wallet for insurance, warranties, receipts and bookings." },
  { href: "/wishlist", label: "Wish list", icon: Gift, color: "var(--c-shop)", phase: 2, group: "Money", blurb: "Things you want, with target prices and price drops." },

  { href: "/weather", label: "Weather", icon: CloudSun, color: "var(--c-travel)", phase: 3, group: "Out & about", blurb: "Live forecast for where you are." },
  { href: "/deals", label: "Deals", icon: Tag, color: "var(--c-shop)", phase: 3, group: "Money", blurb: "Verified deals from the retailers you care about." },
  { href: "/travel", label: "Travel", icon: Plane, color: "var(--c-travel)", phase: 3, group: "Out & about", blurb: "Destinations map, weather and one-tap flight, hotel and holiday searches." },
  { href: "/ai", label: "AI chat", short: "AI", icon: SparklesIcon, color: "var(--accent)", phase: 3, group: "App", blurb: "Free AI: ask anything, or send a photo and ask about it." },
  { href: "/map", label: "Map", icon: MapIcon, color: "var(--c-discover)", phase: 3, group: "Car", blurb: "One big map: fuel prices, holidays abroad, saved places and sat-nav follow-me." },
  { href: "/car", label: "Car", icon: Car, color: "var(--c-travel)", phase: 3, group: "Car", blurb: "Your vehicles, MOT, tax, insurance and running costs." },
  { href: "/fuel", label: "Fuel", icon: Fuel, color: "var(--c-discover)", phase: 3, group: "Car", blurb: "Cheapest and nearest UK fuel prices." },
  { href: "/explore", label: "Explore", icon: MapPinned, color: "var(--c-discover)", phase: 3, group: "Out & about", blurb: "Restaurants, pubs, days out and events near you." },

  { href: "/news", label: "News", icon: Newspaper, color: "var(--c-news)", phase: 4, group: "Sport & TV", blurb: "Live headlines from the BBC — top stories, UK, football and sport." },
  { href: "/sport", label: "Sport", icon: Trophy, color: "var(--c-sport)", phase: 4, group: "Sport & TV", blurb: "Live scores, fixtures, tables and football news." },
  { href: "/tv", label: "TV guide", short: "TV", icon: Tv, color: "var(--c-tv)", phase: 4, group: "Sport & TV", blurb: "What's on now and tonight across UK Freeview channels." },

  { href: "/health", label: "Health", icon: Dumbbell, color: "var(--c-health)", phase: 5, group: "Health", blurb: "Apple Watch activity, food diary and nutrition." },

  { href: "/settings", label: "Settings", icon: Settings, color: "var(--c-news)", phase: 1, group: "App", blurb: "Theme, dashboard and notification preferences." },
];

/** The five tabs on the iPhone bottom bar. */
export const mobileTabs = [
  sections[0], // Home
  sections.find((s) => s.href === "/ai")!,
  { href: "/menu", label: "Explore", short: "Explore", icon: Compass, color: "var(--accent)", phase: 1, group: "App", blurb: "" } satisfies Section,
  sections.find((s) => s.href === "/alerts")!,
  { href: "/settings", label: "Profile", short: "Profile", icon: CircleUserRound, color: "var(--accent)", phase: 1, group: "App", blurb: "" } satisfies Section,
];

export const groups = ["Home", "Money", "Food & shopping", "Home & life", "Car", "Out & about", "Sport & TV", "Health", "App"] as const;
export type Hub = (typeof groups)[number];

/** Hubs bunch related sections together; each hub page shows tabs for its sections. */
export const hubs: { id: Hub; icon: LucideIcon; color: string }[] = [
  { id: "Money", icon: Wallet, color: "var(--c-money)" },
  { id: "Food & shopping", icon: ChefHat, color: "var(--c-shop)" },
  { id: "Home & life", icon: HomeIcon, color: "var(--c-travel)" },
  { id: "Car", icon: Car, color: "var(--c-discover)" },
  { id: "Out & about", icon: Compass, color: "var(--c-discover)" },
  { id: "Sport & TV", icon: Trophy, color: "var(--c-sport)" },
  { id: "Health", icon: Dumbbell, color: "var(--c-health)" },
];
const HUB_ORDER = ["/money", "/bills", "/wishlist", "/deals", "/meals", "/shopping", "/calendar", "/home", "/documents", "/car", "/fuel", "/map", "/explore", "/travel", "/weather", "/sport", "/tv", "/news", "/health"];
export const hubSections = (hub: Hub) => sections.filter((s) => s.group === hub).sort((a, b) => HUB_ORDER.indexOf(a.href) - HUB_ORDER.indexOf(b.href));

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
