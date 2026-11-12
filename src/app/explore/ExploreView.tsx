"use client";

import { Beer, Bookmark, BookmarkCheck, Clock, Coffee, ExternalLink, Landmark, MapPin, Navigation, Phone, Sandwich, Smile, Theater, Trees, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapView, distanceKm, googleDirections, miles } from "@/components/map/MapView";
import { PlacePicker } from "@/components/weather/WeatherWidgets";
import { ErrorNote, Sheet, Spinner } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { run, useRows } from "@/lib/useRows";
import { usePlace } from "@/lib/weather";

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

  return (
    <div className="space-y-4">
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
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {cats.map((c) => {
          const Icon = c.icon;
          const on = cat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              aria-pressed={on}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${on ? "text-white" : "card text-muted hover:text-ink"}`}
              style={on ? { background: c.color } : undefined}
            >
              <Icon size={15} /> {c.label}
            </button>
          );
        })}
        {user && (
          <button
            onClick={() => setCat("saved")}
            aria-pressed={cat === "saved"}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ${cat === "saved" ? "bg-accent text-white" : "card text-muted hover:text-ink"}`}
          >
            <BookmarkCheck size={15} /> Saved ({saved.rows.length})
          </button>
        )}
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <MapView
          live
          className="h-[45dvh] min-h-72 lg:h-[calc(100dvh-16rem)]"
          center={place}
          zoom={radius > 3000 ? 13 : 14}
          me={place}
          selectedId={selected}
          onSelect={setSelected}
          points={list.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, color: catColor[p.category] ?? "var(--accent)", label: p.name }))}
        />
        <div className="lg:h-[calc(100dvh-16rem)] lg:overflow-y-auto">
          {loading ? (
            <Spinner label="Finding places" />
          ) : list.length === 0 ? (
            <p className="card p-6 text-sm text-muted">{cat === "saved" ? "Nothing saved yet — tap the bookmark on any place." : "Nothing found here. Try a bigger distance."}</p>
          ) : (
            <ul className="stagger space-y-2">
              {list.slice(0, 60).map((p, i) => (
                <li key={p.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                  <button
                    onClick={() => setSelected(p.id)}
                    className={`card card-interactive flex w-full items-center gap-3 p-3 text-left ${selected === p.id ? "ring-2 ring-accent" : ""}`}
                    style={{ "--tile": catColor[p.category] } as React.CSSProperties}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: catColor[p.category] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block truncate text-xs capitalize text-muted">{[p.cuisine ?? p.kind, p.address].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-faint">{miles(distanceKm(place, p))}</span>
                    {savedIds.has(p.id) && <BookmarkCheck size={14} className="shrink-0 text-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-faint">
        Places from Geoapify and OpenStreetMap (© OpenStreetMap contributors). OSM doesn&apos;t include ratings, reviews or offers — those need a paid provider, which I&apos;ll only add if you
        want.
      </p>

      <Sheet open={!!sel} title={sel?.name ?? ""} onClose={() => setSelected(null)}>
        {sel && (
          <div className="space-y-4">
            <p className="text-sm capitalize text-muted">
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
