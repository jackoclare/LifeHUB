"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAlerts } from "@/app/alerts/AlertsView";
import { useAuth } from "@/components/AuthProvider";
import { type CalendarEvent, upcoming } from "@/lib/calendar";
import { toISODate } from "@/lib/dates";
import { describe, usePlace, useWeather } from "@/lib/weather";

/** A short, plain-English summary of the day — built from your own data, no AI cost */
export function DailyBriefing({ events }: { events: CalendarEvent[] }) {
  const { user } = useAuth();
  const { place } = usePlace();
  const { data: wx } = useWeather(place);
  const alerts = useAlerts();

  const lines = useMemo(() => {
    const out: { emoji: string; text: string; href?: string }[] = [];
    const today = toISODate(new Date());
    if (wx) {
      const d = wx.daily[0];
      const rain = d.rain ?? 0;
      out.push({
        emoji: "🌤️",
        text: `${describe(wx.current.code).label}, ${Math.round(wx.current.temp)}° now — high of ${Math.round(d.max)}°${rain >= 40 ? `, ${rain}% chance of rain so take a coat` : ""}.`,
        href: "/weather",
      });
    }
    // Only things still to come (finished events drop off); in the evening, look ahead to tomorrow
    const live = upcoming(events, 8);
    const evening = new Date().getHours() >= 18;
    const tomorrow = toISODate(new Date(Date.now() + 864e5));
    const list = (iso: string) => live.filter((e) => e.date === iso && e.kind !== "bill" && e.kind !== "football");
    const fmtList = (es: CalendarEvent[]) => `${es.slice(0, 3).map((e) => `${e.title}${e.time ? ` (${e.time})` : ""}`).join(", ")}${es.length > 3 ? ` +${es.length - 3} more` : ""}`;
    const todays = list(today);
    if (todays.length) out.push({ emoji: "📅", text: `Today: ${fmtList(todays)}.`, href: "/calendar" });
    if (evening && list(tomorrow).length) out.push({ emoji: "🗓️", text: `Tomorrow: ${fmtList(list(tomorrow))}.`, href: "/calendar" });
    const urgent = alerts.filter((a) => a.days <= 3 && !a.id.startsWith("wx-") && !(a.id.startsWith("cal-") && a.title && todays.some((t) => a.id === `cal-${t.id}`)));
    const bills = urgent.filter((a) => a.href === "/bills");
    if (bills.length) out.push({ emoji: "💷", text: `${bills.length === 1 ? bills[0].title : `${bills.length} bills`} due ${bills.length === 1 ? bills[0].detail.replace(/^Bill /, "") : "in the next 3 days"}.`, href: "/bills" });
    const other = urgent.filter((a) => a.href !== "/bills" && a.href !== "/sport" && !a.href.startsWith("/sport/"));
    if (other.length) out.push({ emoji: "🔔", text: `${other[0].title} — ${other[0].detail.toLowerCase()}${other.length > 1 ? ` (+${other.length - 1} more)` : ""}.`, href: "/alerts" });
    const wxw = alerts.find((a) => a.id.startsWith("wx-"));
    if (wxw) out.unshift({ emoji: wxw.emoji, text: wxw.title, href: "/weather" });
    const match = live.find((e) => e.kind === "football");
    if (match) {
      const d = Math.round((new Date(`${match.date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 864e5);
      if (d <= 7) out.push({ emoji: "⚽", text: `${match.title} ${d === 0 ? "today" : d === 1 ? "tomorrow" : `on ${new Date(`${match.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}`}${match.time ? ` at ${match.time}` : ""}.`, href: match.id.startsWith("match-") ? `/sport/match/${match.id.slice(6)}` : "/sport" });
    }
    if (!out.some((l) => l.emoji !== "🌤️")) out.push({ emoji: "✅", text: evening ? "Nothing else on tomorrow — enjoy your evening." : "Nothing else on today.", href: "/calendar" });
    return out;
  }, [wx, events, alerts]);

  if (!user || !lines.length) return null;
  return (
    <section className="card animate-rise mb-6 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[0.95rem] font-semibold">
        <Sparkles size={16} className="text-accent" /> Your briefing
      </h2>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="animate-rise" style={{ animationDelay: `${120 + i * 90}ms` }}>
            <Link href={l.href ?? "#"} className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-1.5 transition-colors active:bg-surface-2">
              <span className="text-lg leading-6">{l.emoji}</span>
              <span className="flex-1 text-[0.95rem] leading-6">{l.text}</span>
              <ChevronRight size={15} className="mt-1 shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
