"use client";

import { BellRing, CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { metRegion } from "@/components/weather/WeatherWidgets";
import { upcoming, useCalendarEvents } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import { usePlace } from "@/lib/weather";

type Alert = { id: string; emoji: string; title: string; detail: string; days: number; href: string; external?: boolean };

const today0 = () => new Date(new Date().toDateString() + " 12:00").getTime();
const daysUntil = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - today0()) / 864e5);
const when = (d: number) => (d < 0 ? `${-d} day${d === -1 ? "" : "s"} overdue` : d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`);
const tone = (d: number) => (d < 0 ? "#ff3b30" : d <= 1 ? "#ff9500" : d <= 7 ? "var(--accent)" : "var(--text-muted)");

/** Everything that needs attention, from every part of the app, in one list */
export function useAlerts() {
  const { user } = useAuth();
  const { events } = useCalendarEvents();
  const { place } = usePlace();
  const [vehicleAlerts, setVehicleAlerts] = useState<Alert[]>([]);
  const [docAlerts, setDocAlerts] = useState<Alert[]>([]);
  const [wx, setWx] = useState<Alert[]>([]);

  useEffect(() => {
    if (!user) return;
    const sb = createClient();
    sb.from("vehicles")
      .select("id,make,model,nickname,reg,mot_due,tax_due,insurance_due,service_due")
      .then(({ data }) => {
        const out: Alert[] = [];
        for (const v of data ?? []) {
          const name = v.nickname || `${v.make} ${v.model ?? ""}`.trim();
          for (const [k, label, emoji] of [
            ["mot_due", "MOT", "🔧"],
            ["tax_due", "Road tax", "🧾"],
            ["insurance_due", "Car insurance", "🛡️"],
            ["service_due", "Service", "🛠️"],
          ] as const) {
            const iso = v[k] as string | null;
            if (!iso) continue;
            const d = daysUntil(iso);
            if (d <= 30) out.push({ id: `veh-${v.id}-${k}`, emoji, title: `${label} — ${name}`, detail: `${when(d)}${v.reg ? ` · ${v.reg}` : ""}`, days: d, href: "/car" });
          }
        }
        setVehicleAlerts(out);
      });
    sb.from("documents")
      .select("id,title,expires_on")
      .not("expires_on", "is", null)
      .then(({ data }) =>
        setDocAlerts(
          (data ?? [])
            .map((doc) => ({ doc, d: daysUntil(doc.expires_on as string) }))
            .filter(({ d }) => d <= 30)
            .map(({ doc, d }) => ({ id: `doc-${doc.id}`, emoji: "📄", title: `${doc.title} ${d < 0 ? "has expired" : "expires"}`, detail: when(d), days: d, href: "/documents" })),
        ),
      );
  }, [user]);

  useEffect(() => {
    if (!place) return;
    fetch(`/api/weather-warnings?region=${metRegion(place.lat, place.lon)}`)
      .then((r) => r.json())
      .then((j: { warnings?: { title: string; link: string; level: string }[] }) =>
        setWx((j.warnings ?? []).map((w, i) => ({ id: `wx-${i}`, emoji: w.level === "red" ? "🔴" : w.level === "amber" ? "🟠" : "🟡", title: w.title, detail: "Met Office warning", days: 0, href: "/weather" }))),
      )
      .catch(() => {});
  }, [place]);

  return useMemo(() => {
    const fromCalendar: Alert[] = [];
    const stillToCome = new Set(upcoming(events, 60).map((e) => e.id));
    for (const e of events) {
      if (e.kind !== "bill" && !stillToCome.has(e.id)) continue; // finished matches/reminders drop off
      const d = daysUntil(e.date);
      if (e.kind === "bill" && d <= 7) fromCalendar.push({ id: `cal-${e.id}`, emoji: "💷", title: `${e.title}${e.amount != null ? ` — £${Number(e.amount).toFixed(2)}` : ""}`, detail: `Bill ${when(d).toLowerCase()}`, days: d, href: "/bills" });
      else if (e.kind === "reminder" && d >= 0 && d <= 3) fromCalendar.push({ id: `cal-${e.id}`, emoji: "🔔", title: e.title, detail: `${when(d)}${e.time ? ` at ${e.time}` : ""}`, days: d, href: "/calendar" });
      else if (e.kind === "football" && d >= 0 && d <= 2) fromCalendar.push({ id: `cal-${e.id}`, emoji: "⚽", title: e.title, detail: `${when(d)}${e.time ? ` · ${e.time}` : ""}`, days: d + 0.5, href: e.id.startsWith("match-") ? `/sport/match/${e.id.slice(6)}` : "/sport" });
      else if (e.kind === "travel" && d >= 0 && d <= 14) fromCalendar.push({ id: `cal-${e.id}`, emoji: "✈️", title: e.title, detail: when(d), days: d, href: "/calendar" });
    }
    return [...wx, ...fromCalendar, ...vehicleAlerts, ...docAlerts].sort((a, b) => a.days - b.days);
  }, [events, vehicleAlerts, docAlerts, wx]);
}

export function AlertsView() {
  const { user, loading } = useAuth();
  const alerts = useAlerts();
  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to see your alerts." />;

  return (
    <div className="space-y-4">
      {alerts.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto text-[var(--c-money)]" size={34} />
          <p className="mt-2 font-semibold">All clear</p>
          <p className="mt-1 text-sm text-muted">Nothing due in the next week. Bills, MOT and tax dates, documents, reminders, matches and weather warnings will show here.</p>
        </div>
      ) : (
        <ul className="card stagger divide-y divide-line overflow-hidden">
          {alerts.map((a, i) => (
            <li key={a.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <Link href={a.href} className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">{a.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.title}</span>
                  <span className="block text-sm font-medium" style={{ color: tone(Math.floor(a.days)) }}>
                    {a.detail}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/settings#notifications" className="card flex items-center gap-3 p-4">
        <span className="icon-tile" style={{ "--tile": "#ff3b30" } as React.CSSProperties}>
          <BellRing size={18} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Phone notifications</span>
          <span className="block text-sm text-muted">Choose what LifeHub tells you about</span>
        </span>
        <ChevronRight size={16} className="text-faint" />
      </Link>
    </div>
  );
}
