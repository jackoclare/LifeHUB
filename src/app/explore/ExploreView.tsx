"use client";

import { Beer, Bookmark, BookmarkCheck, Clock, Coffee, ExternalLink, Landmark, MapPin, Navigation, Phone, Sandwich, Search, Smile, Theater, Trees, UtensilsCrossed, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapView, distanceKm, googleDirections, miles } from "@/components/map/MapView";
import { PlacePicker } from "@/components/weather/WeatherWidgets";
import { ErrorNote, Sheet, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { run, useRows } from "@/lib/useRows";
import { usePlace } from "@/lib/weather";
import { isOpenNow } from "@/lib/openingHours";
import { SectionHeader } from "@/components/kit";

type Cat = "restaurants" | "pubs" | "cafes" | "takeaway" | "attractions" | "activities" | "entertainment" | "outdoors";

const cats: { id: Cat; label: string; icon: typeof Beer; color: string }[] = [
  { id: "restaurants", label: "Restaurants", icon: UtensilsCrossed, color: "#f97316" },
  { id: "pubs", label: "Pubs & bars", icon: Beer, color: "#eab308" },
  { id: "cafes", label: "Cafés", icon: Coffee, color: "#a16207" },
  { id: "takeaway", label: "Takeaway", icon: Sandwich, color: "#ef4444" },
  { id: "attractions", label: "Attractions", icon: Landmark, color: "#8b5cf6" },
  { id: "activities", label: "Activities", icon: Smile, color: "#0ea5e9" },
  { id: "entertainment", label: "Cinema & shows", icon: Theater, color: "#ec4899" },
  { id: "outdoors", label: "Parks & nature", icon: Trees, color: "#22c55e" },
];
const catColor = Object.fromEntries(cats.map((c) => [c.id, c.color])) as Record<Cat, string>;

type Place = {
  id: string;
  name: string;
  category: Cat;
  kind: string;
  lat: number;
  lon: number;
  address: string | null;
  openingHours: string | null;
  website: string | null;
  phone: string | null;
  cuisine: string | null;
};
type Saved = { id: string; osm_id: string; name: string; category: Cat; kind: string | null; lat: number; lon: number; address: string | null; website: string | null };

export function ExploreView() {
  const { place, ready } = usePlace();
  const { user } = useAuth();
  const [cat, setCat] = useState<Cat | "saved">("restaurants");
  const [radius, setRadius] = useState(2000);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const saved = useRows<Saved>("saved_places", [{ column: "created_at", ascending: false }], Boolean(user));

  useEffect(() => {
    if (!place || cat === "saved") return;
    let alive = true;
    setLoading(true);
    setError(null);
    setSelected(null);
    fetch(`/api/places?lat=${place.lat}&lon=${place.lon}&cat=${cat}&radius=${radius}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setPlaces(d.places ?? []);
        setError(d.error ?? null);
      })
      .catch(() => alive && setError("Couldn't load places"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [place, cat, radius]);

  const list: Place[] = useMemo(() => {
    const base: Place[] =
      cat === "saved"
        ? saved.rows.map((s) => ({ id: s.osm_id, name: s.name, category: s.category, kind: s.kind ?? "", lat: s.lat, lon: s.lon, address: s.address, website: s.website, openingHours: null, phone: null, cuisine: null }))
        : places;
    if (!place) return base;
    return [...base].sort((a, b) => distanceKm(place, a) - distanceKm(place, b));
  }, [cat, saved.rows, places, place]);

  const savedIds = new Set(saved.rows.map((s) => s.osm_id));
  const sel = list.find((p) => p.id === selected) ?? null;

  if (!ready) return null;
  if (!place || changing)
    return (
      <div className="card mx-auto max-w-md p-6">
        <h2 className="mb-1 font-display text-lg font-semibold">Where should we look?</h2>
        <PlacePicker />
        {changing && (
          <button onClick={() => setChanging(false)} className="btn btn-ghost mt-3">
            Cancel
          </button>
        )}
      </div>
    );

  const toggleSave = async (p: Place) => {
    if (!user) return;
    const existing = saved.rows.find((s) => s.osm_id === p.id);
    const supabase = createClient();
    const msg = existing
      ? await run(() => supabase.from("saved_places").delete().eq("id", existing.id))
      : await run(() =>
          supabase.from("saved_places").insert({ osm_id: p.id, name: p.name, category: p.category, kind: p.kind, lat: p.lat, lon: p.lon, address: p.address, website: p.website }),
        );
    setError(msg);
    saved.reload();
  };

  const q = query.trim().toLowerCase();
  const shown = list.filter(
    (p) => (!q || `${p.name} ${p.cuisine ?? ""} ${p.kind}`.toLowerCase().includes(q)) && (!openOnly || isOpenNow(p.openingHours) === true),
  );
  const closest = shown.slice(0, 8);
  const activeCat = cats.find((c) => c.id === cat);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="glass flex min-h-12 items-center gap-2 rounded-2xl px-4">
          <Search size={17} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={cat === "saved" ? "Search your saved places" : `Search ${activeCat?.label.toLowerCase() ?? "places"}, e.g. "pizza"`}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            enterKeyHint="search"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="text-faint">
              <X size={16} />
            </button>
          )}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setChanging(true)} className="chip min-h-9 px-3!">
            <MapPin size={13} /> {place.name}
          </button>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="chip min-h-9 cursor-pointer px-3! outline-none" aria-label="Search radius">
            <option value={1000}>Within ~½ mile</option>
            <option value={2000}>Within ~1 mile</option>
            <option value={5000}>Within ~3 miles</option>
            <option value={8000}>Within ~5 miles</option>
          </select>
          <button
            onClick={() => setOpenOnly((v) => !v)}
            aria-pressed={openOnly}
            className={`chip min-h-9 px-3! transition-colors ${openOnly ? "bg-[#34c759]! text-white!" : ""}`}
          >
            <Clock size={13} /> Open now
          </button>
        </div>
      </div>

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {cats.map((c) => {
          const Icon = c.icon;
          const on = cat === c.id;
          return (
            <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={on} className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <span
                className={`grid size-14 place-items-center rounded-full transition-all duration-300 ${on ? "scale-105 text-white shadow-lg" : "card"}`}
                style={on ? { background: c.color, boxShadow: `0 8px 20px -8px ${c.color}` } : { color: c.color }}
              >
                <Icon size={22} />
              </span>
              <span className={`text-center text-[11px] leading-tight ${on ? "font-bold text-ink" : "font-medium text-muted"}`}>{c.label}</span>
            </button>
          );
        })}
        {user && (
          <button onClick={() => setCat("saved")} aria-pressed={cat === "saved"} className="flex w-16 shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform">
            <span className={`grid size-14 place-items-center rounded-full transition-all duration-300 ${cat === "saved" ? "scale-105 bg-accent text-white shadow-lg" : "card text-accent"}`}>
              <BookmarkCheck size={22} />
            </span>
            <span className={`text-center text-[11px] leading-tight ${cat === "saved" ? "font-bold text-ink" : "font-medium text-muted"}`}>Saved ({saved.rows.length})</span>
          </button>
        )}
      </div>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <Spinner label="Finding places" />
      ) : shown.length === 0 ? (
        <p className="card p-6 text-sm text-muted">
          {cat === "saved" && !saved.rows.length ? "Nothing saved yet — tap the bookmark on any place." : openOnly ? "Nothing open right now that I can confirm. Turn off “Open now” to see everything." : "Nothing found here. Try a bigger distance."}
        </p>
      ) : (
        <>
          <section>
            <SectionHeader title="Closest to you" />
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {closest.map((p, i) => {
                const c = catColor[p.category] ?? "var(--accent)";
                const Icon = cats.find((x) => x.id === p.category)?.icon ?? MapPin;
                const open = isOpenNow(p.openingHours);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className="card card-interactive w-44 shrink-0 snap-start overflow-hidden text-left animate-[rise_.5s_var(--spring)_both]"
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <span className="relative grid h-24 place-items-center text-white" style={{ background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 55%, #000))` }}>
                      <Icon size={34} strokeWidth={1.6} />
                      {open !== null && (
                        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${open ? "bg-white/90 text-[#1f9d47]" : "bg-black/35 text-white"}`}>{open ? "Open" : "Closed"}</span>
                      )}
                      {savedIds.has(p.id) && <BookmarkCheck size={15} className="absolute right-2 top-2" />}
                    </span>
                    <span className="block p-3">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block truncate text-xs capitalize text-muted">{p.cuisine ?? p.kind}</span>
                      <span className="mt-1 block text-xs font-semibold tabular-nums" style={{ color: c }}>
                        {miles(distanceKm(place, p))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <MapView
              live
              className="h-[38dvh] min-h-64 overflow-hidden rounded-[var(--radius-card)] lg:h-[calc(100dvh-20rem)]"
              center={place}
              zoom={radius > 3000 ? 13 : 14}
              me={place}
              selectedId={selected}
              onSelect={setSelected}
              points={shown.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, color: catColor[p.category] ?? "var(--accent)", label: p.name }))}
            />
            <section className="lg:h-[calc(100dvh-20rem)] lg:overflow-y-auto">
              <SectionHeader title={`All ${cat === "saved" ? "saved" : (activeCat?.label.toLowerCase() ?? "places")} · ${shown.length}`} />
              <ul className="stagger card divide-y divide-line overflow-hidden">
                {shown.slice(0, 60).map((p, i) => {
                  const open = isOpenNow(p.openingHours);
                  return (
                    <li key={p.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                      <button onClick={() => setSelected(p.id)} className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2 ${selected === p.id ? "bg-surface-2" : ""}`}>
                        <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: catColor[p.category] }}>
                          {(() => {
                            const Icon = cats.find((x) => x.id === p.category)?.icon ?? MapPin;
                            return <Icon size={16} />;
                          })()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.name}</span>
                          <span className="block truncate text-xs capitalize text-muted">
                            {open !== null && <span className={open ? "font-semibold text-[#1f9d47]" : "text-faint"}>{open ? "Open" : "Closed"} · </span>}
                            {[p.cuisine ?? p.kind, p.address].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-faint">{miles(distanceKm(place, p))}</span>
                        {savedIds.has(p.id) && <BookmarkCheck size={14} className="shrink-0 text-accent" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </>
      )}
      <p className="text-xs text-faint">
        Places from Geoapify and OpenStreetMap (© OpenStreetMap contributors). “Open now” is worked out from the opening hours listed there, so it&apos;s only shown where hours are known.
        Ratings and reviews open in Google Maps.
      </p>

      <Sheet open={!!sel} title={sel?.name ?? ""} onClose={() => setSelected(null)}>
        {sel && (
          <div className="space-y-4">
            <p className="text-sm capitalize text-muted">
              {(() => {
                const o = isOpenNow(sel.openingHours);
                return o === null ? null : <span className={o ? "font-semibold text-[#1f9d47]" : "font-semibold text-faint"}>{o ? "Open now" : "Closed now"} · </span>;
              })()}
              {[sel.cuisine, sel.kind].filter(Boolean).join(" · ")} · {miles(distanceKm(place, sel))} away
            </p>
            {sel.address && (
              <p className="flex items-start gap-2 text-sm">
                <MapPin size={16} className="mt-0.5 shrink-0 text-faint" /> {sel.address}
              </p>
            )}
            {sel.openingHours && (
              <p className="flex items-start gap-2 text-sm">
                <Clock size={16} className="mt-0.5 shrink-0 text-faint" /> <span className="break-words">{sel.openingHours.replace(/;\s*/g, " · ")}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <a className="btn btn-primary" href={googleDirections(sel)} target="_blank" rel="noopener noreferrer">
                <Navigation size={16} /> Google Maps
              </a>
              {user ? (
                <button className="btn btn-ghost" onClick={() => toggleSave(sel)}>
                  {savedIds.has(sel.id) ? <BookmarkCheck size={16} className="text-accent" /> : <Bookmark size={16} />} {savedIds.has(sel.id) ? "Saved" : "Save"}
                </button>
              ) : (
                <a className="btn btn-ghost" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sel.name} ${sel.address ?? ""}`)}`} target="_blank" rel="noopener noreferrer">
                  Reviews <ExternalLink size={14} />
                </a>
              )}
              {sel.website && (
                <a className="btn btn-ghost" href={sel.website.startsWith("http") ? sel.website : `https://${sel.website}`} target="_blank" rel="noopener noreferrer">
                  Website <ExternalLink size={14} />
                </a>
              )}
              {sel.phone && (
                <a className="btn btn-ghost" href={`tel:${sel.phone.replace(/\s/g, "")}`}>
                  <Phone size={16} /> Call
                </a>
              )}
              {user && (
                <a className="btn btn-ghost" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sel.name} ${sel.address ?? ""}`)}`} target="_blank" rel="noopener noreferrer">
                  Reviews <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
