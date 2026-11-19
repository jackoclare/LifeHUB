"use client";

import { CalendarPlus, Check, ExternalLink, MapPin, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PillTabs, SectionHeader } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import { usePlace } from "@/lib/weather";

/**
 * What's on in and around Shrewsbury: live listings (gigs, comedy, theatre, sport) from Ticketmaster's free
 * feed when TICKETMASTER_KEY is set, plus one-tap links to the local venues and listings sites.
 */

type Ev = { name: string; date: string | null; time: string | null; venue: string | null; town: string | null; url: string | null; image: string | null; kind: string | null; from: number | null };
type Range = "weekend" | "week" | "month";

const LOCAL = [
  { name: "Theatre Severn", note: "Shows, comedy, panto", href: "https://www.theatresevern.co.uk/whats-on/" },
  { name: "Original Shrewsbury", note: "Town events & markets", href: "https://www.originalshrewsbury.co.uk/events" },
  { name: "Shrewsbury Market Hall", note: "Food, makers, late opening", href: "https://www.shrewsburymarkethall.co.uk/" },
  { name: "The Buttermarket", note: "Club nights & gigs", href: "https://www.buttermarket.co.uk/" },
  { name: "Skiddle — Shrewsbury", note: "Gigs, clubs, festivals", href: "https://www.skiddle.com/whats-on/Shrewsbury/" },
  { name: "Eventbrite — this weekend", note: "Local one-offs", href: "https://www.eventbrite.co.uk/d/united-kingdom--shrewsbury/events--this-weekend/" },
];

const ukDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);

function weekendBounds(now = new Date()) {
  const d = now.getDay(); // 0 Sun … 6 Sat
  const add = (n: number) => ukDay(new Date(now.getTime() + n * 86400e3));
  if (d === 0) return [add(0), add(0)];
  if (d >= 5) return [add(0), add(7 - d)];
  return [add(5 - d), add(7 - d)];
}

export function WhatsOnView() {
  const { place } = usePlace();
  const [range, setRange] = useState<Range>("weekend");
  const [data, setData] = useState<{ configured: boolean; events: Ev[]; error?: string } | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const lat = place?.lat ?? 52.7073;
    const lon = place?.lon ?? -2.7553;
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/events?lat=${lat}&lon=${lon}&miles=20&days=31`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ configured: true, events: [], error: "Couldn't load events — check your signal." }));
  }, [place?.lat, place?.lon]);

  const shown = useMemo(() => {
    const today = ukDay(new Date());
    const [wkFrom, wkTo] = weekendBounds();
    const in7 = ukDay(new Date(Date.now() + 7 * 86400e3));
    return (data?.events ?? []).filter((e) => {
      if (!e.date) return false;
      if (range === "weekend") return e.date >= wkFrom && e.date <= wkTo;
      if (range === "week") return e.date >= today && e.date <= in7;
      return true;
    });
  }, [data, range]);

  const toCalendar = async (e: Ev) => {
    if (!e.date) return;
    const { error } = await createClient()
      .from("calendar_events")
      .insert({ title: e.name.slice(0, 200), event_date: e.date, event_time: e.time, kind: "personal", notes: [e.venue, e.url].filter(Boolean).join(" · ") });
    if (!error) setAdded((s) => new Set(s).add(`${e.name}|${e.date}`));
  };

  return (
    <div className="space-y-5">
      <PillTabs
        value={range}
        onChange={setRange}
        options={[
          { value: "weekend", label: "This weekend" },
          { value: "week", label: "Next 7 days" },
          { value: "month", label: "This month" },
        ]}
      />

      {data && !data.configured ? (
        <section className="card space-y-2 p-5">
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <Ticket size={20} className="text-[#00e5ff]" /> Switch on live listings (free, 3 minutes)
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>
              Sign up at{" "}
              <a className="font-semibold text-accent" href="https://developer-acct.ticketmaster.com/user/register" target="_blank" rel="noopener noreferrer">
                developer.ticketmaster.com
              </a>{" "}
              (free).
            </li>
            <li>Open <b>My Apps</b> and copy your <b>Consumer Key</b>.</li>
            <li>In Supabase → Edge Functions → Secrets, add <b>TICKETMASTER_KEY</b> with it, then tell Claude.</li>
          </ol>
          <p className="text-xs text-faint">Until then, the local listings below cover most of what&apos;s on.</p>
        </section>
      ) : (
        <section>
          <SectionHeader title={`Gigs, comedy, shows & sport · ${shown.length}`} />
          {!data && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-56 animate-pulse rounded-[1.6rem]" />
              ))}
            </div>
          )}
          {data?.error && <p className="text-sm text-[#ff6b61]">{data.error}</p>}
          {data && !data.error && shown.length === 0 && <p className="card p-5 text-sm text-muted">Nothing listed for then — try &quot;This month&quot;, or the local listings below.</p>}
          <div className="stagger grid gap-3 sm:grid-cols-2">
            {shown.map((e, i) => {
              const key = `${e.name}|${e.date}`;
              const when = e.date ? new Date(`${e.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "";
              return (
                <article key={key} className="card card-interactive overflow-hidden" style={{ "--i": i, "--tile": "var(--c-sport)" } as React.CSSProperties}>
                  {e.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.image} alt="" loading="lazy" className="aspect-[16/8] w-full object-cover opacity-90" />
                  )}
                  <div className="p-4">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#b15cff]">
                      {when}
                      {e.time ? ` · ${e.time}` : ""}
                      {e.kind ? ` · ${e.kind}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 font-display text-lg font-bold leading-snug">{e.name}</p>
                    <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted">
                      <MapPin size={13} /> {[e.venue, e.town].filter(Boolean).join(", ")}
                      {e.from ? ` · from £${Math.round(e.from)}` : ""}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {e.url && (
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-1 min-h-10!">
                          <Ticket size={16} /> Tickets
                        </a>
                      )}
                      <button className="btn btn-ghost min-h-10!" onClick={() => toCalendar(e)} disabled={added.has(key)} aria-label="Add to calendar">
                        {added.has(key) ? <Check size={16} /> : <CalendarPlus size={16} />}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Local listings" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LOCAL.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="card card-interactive flex items-center gap-3 p-3" style={{ "--tile": "var(--c-sport)" } as React.CSSProperties}>
              <span className="icon-tile">
                <Ticket size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{l.name}</span>
                <span className="block truncate text-xs text-muted">{l.note}</span>
              </span>
              <ExternalLink size={15} className="text-faint" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
