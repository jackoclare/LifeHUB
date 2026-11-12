"use client";

import { BellPlus, Check, Search, Star, Tv, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DateStrip, PillTabs, SectionHeader, daysFrom } from "@/components/kit";
import { ErrorNote, Sheet, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { readCache, writeCache } from "@/lib/cache";

type Prog = { id: number; channel: string; start_at: string; stop_at: string; title: string; descr: string | null; icon: string | null; episode: string | null };

// Display names + colours, in Freeview order
const CHANNELS: { id: string; name: string; color: string }[] = [
  { id: "BBCOneWestMidlands.uk", name: "BBC One", color: "#e4002b" },
  { id: "BBCTwoHD.uk", name: "BBC Two", color: "#7b2d8e" },
  { id: "ITV1CentralW.uk", name: "ITV1", color: "#1fb6ff" },
  { id: "Channel4Midlands.uk", name: "Channel 4", color: "#2e2e2e" },
  { id: "5.uk", name: "Channel 5", color: "#ff2d55" },
  { id: "ITV2.uk", name: "ITV2", color: "#00a3e0" },
  { id: "BBCThreeHD.uk", name: "BBC Three", color: "#ff6a00" },
  { id: "BBCFourHD.uk", name: "BBC Four", color: "#0f6e6e" },
  { id: "ITV3.uk", name: "ITV3", color: "#4a90e2" },
  { id: "ITV4.uk", name: "ITV4", color: "#2c3e8f" },
  { id: "SkyMix.uk", name: "Sky Mix", color: "#0072c9" },
  { id: "QuestHD.uk", name: "Quest", color: "#f39c12" },
  { id: "E4.uk", name: "E4", color: "#7e2d86" },
  { id: "Film4.uk", name: "Film4", color: "#b8a200" },
  { id: "More4.uk", name: "More4", color: "#0c8b44" },
  { id: "UAndDave.uk", name: "U&Dave", color: "#00c2a8" },
  { id: "UAndDrama.uk", name: "U&Drama", color: "#c0392b" },
  { id: "UAndYesterday.uk", name: "U&Yesterday", color: "#a0522d" },
  { id: "5USA.uk", name: "5USA", color: "#d63384" },
  { id: "5Star.uk", name: "5Star", color: "#e83e8c" },
  { id: "Challenge.uk", name: "Challenge", color: "#5856d6" },
  { id: "DMAX.uk", name: "DMAX", color: "#555" },
  { id: "QuestRed.uk", name: "Quest Red", color: "#c0392b" },
  { id: "SkyArts.uk", name: "Sky Arts", color: "#8e44ad" },
  { id: "TalkingPicturesTV.uk", name: "Talking Pictures", color: "#6d4c41" },
  { id: "Legend.uk", name: "Legend", color: "#34495e" },
  { id: "CBBC.uk", name: "CBBC", color: "#7cb342" },
  { id: "CBeebies.uk", name: "CBeebies", color: "#fbc02d" },
  { id: "BBCNews.uk", name: "BBC News", color: "#bb1919" },
  { id: "SkyNews.uk", name: "Sky News", color: "#c8102e" },
  { id: "GBNews.uk", name: "GB News", color: "#003c71" },
];
const chan = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));
const FAV_KEY = "mlh.tv.favs";
const TV = "var(--c-tv)";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const ukDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
const ukHour = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(new Date(iso))) % 24;

function ChannelBadge({ id, size = "md" }: { id: string; size?: "sm" | "md" }) {
  const c = chan[id];
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl px-1 text-center font-extrabold leading-none tracking-tight text-white ${size === "sm" ? "h-8 w-14 text-[10px]" : "h-11 w-16 text-[11px]"}`}
      style={{ background: c?.color ?? "#555" }}
    >
      {c?.name ?? id}
    </span>
  );
}

export function TvView() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"now" | "tonight" | "search">("now");
  const [progs, setProgs] = useState<Prog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(() => ukDate(new Date()));
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Prog | null>(null);
  const [favs, setFavs] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [reminded, setReminded] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"));
    } catch {}
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const cached = readCache<Prog[]>("tv.day", 6 * 3600e3);
    if (cached?.length) {
      setProgs(cached);
      setLoading(false);
    }
    (async () => {
      const sb = createClient();
      const out: Prog[] = [];
      // Page through the week (Supabase returns up to 1,000 rows per request)
      for (let from = 0; from < 8000; from += 1000) {
        const { data, error } = await sb
          .from("tv_programmes")
          .select("id,channel,start_at,stop_at,title,descr,icon,episode")
          .gte("stop_at", new Date(Date.now() - 3600e3).toISOString())
          .order("start_at")
          .range(from, from + 999);
        if (error) {
          if (alive) setError("Couldn't load the TV guide");
          break;
        }
        out.push(...((data ?? []) as Prog[]));
        if (!data || data.length < 1000) break;
      }
      if (!alive) return;
      if (out.length) {
        setProgs(out);
        // Keep a light copy of the next 24 hours on the phone so "On now" opens instantly
        const cutoff = Date.now() + 24 * 3600e3;
        writeCache("tv.day", out.filter((p) => Date.parse(p.start_at) < cutoff));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {}
  };

  const order = useMemo(() => [...CHANNELS.filter((c) => favs.includes(c.id)), ...CHANNELS.filter((c) => !favs.includes(c.id))], [favs]);
  const byChannel = useMemo(() => {
    const m = new Map<string, Prog[]>();
    for (const p of progs) m.set(p.channel, [...(m.get(p.channel) ?? []), p]);
    return m;
  }, [progs]);

  const remind = async (p: Prog) => {
    if (!user) return;
    const start = new Date(p.start_at);
    const { error } = await createClient()
      .from("calendar_events")
      .insert({ title: `📺 ${p.title} · ${chan[p.channel]?.name ?? ""}`.slice(0, 200), event_date: ukDate(start), event_time: time(p.start_at), kind: "reminder" });
    if (error) setError("Couldn't add the reminder");
    else setReminded((s) => new Set(s).add(p.id));
  };

  const days = daysFrom(ukDate(new Date()), 7);
  const q = query.trim().toLowerCase();
  const results = q.length >= 2 ? progs.filter((p) => p.title.toLowerCase().includes(q) && Date.parse(p.stop_at) > now).slice(0, 80) : [];

  return (
    <div className="space-y-5">
      <PillTabs
        value={mode}
        onChange={setMode}
        accent={TV}
        options={[
          { value: "now", label: "On now" },
          { value: "tonight", label: "Tonight" },
          { value: "search", label: "Search" },
        ]}
      />

      {error && <ErrorNote message={error} />}
      {loading && <Spinner label="Loading the TV guide" />}
      {!loading && !progs.length && !error && <p className="card p-6 text-sm text-muted">Listings are on their way. They refresh every few hours, so check back shortly.</p>}

      {mode === "now" && progs.length > 0 && (
        <ul className="stagger space-y-2">
          {order.map((c, i) => {
            const list = byChannel.get(c.id) ?? [];
            const idx = list.findIndex((p) => Date.parse(p.start_at) <= now && Date.parse(p.stop_at) > now);
            const cur = list[idx];
            const next = idx >= 0 ? list[idx + 1] : list.find((p) => Date.parse(p.start_at) > now);
            if (!cur && !next) return null;
            const pct = cur ? Math.min(100, Math.max(0, ((now - Date.parse(cur.start_at)) / (Date.parse(cur.stop_at) - Date.parse(cur.start_at))) * 100)) : 0;
            return (
              <li key={c.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                <div className="card flex items-center gap-3 p-3">
                  <ChannelBadge id={c.id} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setSel(cur ?? next!)}>
                    <span className="block truncate text-[15px] font-semibold">{cur?.title ?? "Off air"}</span>
                    {cur && (
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: c.color }} />
                      </span>
                    )}
                    {next && (
                      <span className="mt-1 block truncate text-xs text-muted">
                        Next {time(next.start_at)} · {next.title}
                      </span>
                    )}
                  </button>
                  <button onClick={() => toggleFav(c.id)} aria-label={favs.includes(c.id) ? `Unfavourite ${c.name}` : `Favourite ${c.name}`} className="grid size-9 shrink-0 place-items-center">
                    <Star size={17} className={favs.includes(c.id) ? "fill-[#ffcc00] text-[#ffcc00]" : "text-faint"} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mode === "tonight" && progs.length > 0 && (
        <>
          <DateStrip days={days} value={day} onChange={setDay} accent={TV} />
          <SectionHeader title={day === ukDate(new Date()) ? "Tonight, 6pm to midnight" : "Evening, 6pm to midnight"} />
          <ul className="stagger space-y-3">
            {order.map((c, i) => {
              const list = (byChannel.get(c.id) ?? []).filter((p) => ukDate(new Date(p.start_at)) === day && ukHour(p.start_at) >= 18);
              if (!list.length) return null;
              return (
                <li key={c.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                  <div className="mb-1.5 flex items-center gap-2 px-1">
                    <ChannelBadge id={c.id} size="sm" />
                    {favs.includes(c.id) && <Star size={13} className="fill-[#ffcc00] text-[#ffcc00]" />}
                  </div>
                  <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
                    {list.map((p) => {
                      const live = Date.parse(p.start_at) <= now && Date.parse(p.stop_at) > now;
                      return (
                        <button key={p.id} onClick={() => setSel(p)} className={`card card-interactive w-40 shrink-0 snap-start p-3 text-left ${live ? "ring-2" : ""}`} style={live ? ({ "--tw-ring-color": c.color } as React.CSSProperties) : undefined}>
                          <span className="block text-xs font-bold tabular-nums" style={{ color: c.color }}>
                            {time(p.start_at)}
                            {live && " · LIVE"}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-sm font-semibold leading-snug">{p.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {mode === "search" && (
        <>
          <label className="glass flex min-h-12 items-center gap-2 rounded-2xl px-4">
            <Search size={17} className="shrink-0 text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search programmes this week, e.g. Match of the Day" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" enterKeyHint="search" autoFocus />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-faint">
                <X size={16} />
              </button>
            )}
          </label>
          {q.length >= 2 && (
            <ul className="card divide-y divide-line overflow-hidden">
              {results.length === 0 && <li className="p-4 text-sm text-muted">Nothing on in the next 7 days with that name.</li>}
              {results.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSel(p)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                    <ChannelBadge id={p.channel} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.title}</span>
                      <span className="block text-xs text-muted">
                        {new Date(p.start_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" })} · {time(p.start_at)}
                        {p.episode ? ` · ${p.episode}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="text-xs text-faint">Listings for UK free-to-air channels (Midlands region) from the open Freeview-EPG project, refreshed every 6 hours. Sky Sports and other pay channels aren&apos;t included.</p>

      <Sheet open={!!sel} title={sel?.title ?? ""} onClose={() => setSel(null)}>
        {sel && (
          <div className="space-y-4">
            {sel.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sel.icon} alt="" className="aspect-video w-full rounded-2xl bg-surface-2 object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
            )}
            <div className="flex items-center gap-3">
              <ChannelBadge id={sel.channel} />
              <p className="text-sm text-muted">
                {new Date(sel.start_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" })}
                <br />
                <span className="font-semibold text-ink">
                  {time(sel.start_at)} – {time(sel.stop_at)}
                </span>
                {sel.episode ? ` · ${sel.episode}` : ""}
              </p>
            </div>
            {sel.descr && <p className="text-[15px] leading-relaxed">{sel.descr}</p>}
            {user && Date.parse(sel.start_at) > now && (
              <button className="btn btn-primary w-full" onClick={() => remind(sel)} disabled={reminded.has(sel.id)}>
                {reminded.has(sel.id) ? <Check size={16} /> : <BellPlus size={16} />} {reminded.has(sel.id) ? "Added to your calendar" : "Remind me"}
              </button>
            )}
            {!sel.descr && !sel.icon && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Tv size={16} /> No more details for this one.
              </p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
