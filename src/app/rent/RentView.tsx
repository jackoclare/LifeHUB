"use client";

import { BellRing, Building2, ChevronRight, ExternalLink, Home, Landmark, Phone, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_RENT, readPrefs, savePrefs, usePrefs, type RentSearch } from "@/lib/prefs";
import { SectionHeader } from "@/components/kit";
import { inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

/**
 * Homes to rent. The big portals don't allow other apps to read their listings, so instead
 * LifeHub keeps one saved search and opens it, already filtered, on each site in one tap —
 * and walks you through turning on their own instant alerts so new homes ping your phone.
 */

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const enc = encodeURIComponent;
// Rightmove's town pages: /property-to-rent/Shrewsbury.html, /property-to-rent/Church-Stretton.html
const rmTown = (s: string) =>
  s
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("-") || "Shrewsbury";

type Portal = { id: string; name: string; colour: string; note: string; url: (r: RentSearch) => string; rooms?: boolean };

const PORTALS: Portal[] = [
  {
    id: "rightmove",
    name: "Rightmove",
    colour: "#00deb6",
    note: "Biggest UK site",
    url: (r) =>
      `https://www.rightmove.co.uk/property-to-rent/${rmTown(r.area)}.html?radius=${r.radius}.0${r.maxRent ? `&maxPrice=${r.maxRent}` : ""}&minBedrooms=${r.minBeds}${r.kind === "house" ? "&propertyTypes=detached%2Csemi-detached%2Cterraced" : r.kind === "flat" ? "&propertyTypes=flat" : ""}`,
  },
  {
    id: "zoopla",
    name: "Zoopla",
    colour: "#8046f1",
    note: "Lots of agents not on Rightmove",
    url: (r) =>
      `https://www.zoopla.co.uk/to-rent/${r.kind === "house" ? "houses" : r.kind === "flat" ? "flats" : "property"}/${slug(r.area)}/?q=${enc(r.area)}&radius=${r.radius}&beds_min=${r.minBeds}${r.maxRent ? `&price_max=${r.maxRent}&price_frequency=per_month` : ""}`,
  },
  {
    id: "openrent",
    name: "OpenRent",
    colour: "#3fa9f5",
    note: "Rent direct from landlords, no agent fees",
    url: (r) =>
      `https://www.openrent.co.uk/properties-to-rent/${slug(r.area)}?term=${enc(r.area)}&within=${Math.round(r.radius * 1.609)}&bedrooms_min=${r.minBeds}${r.maxRent ? `&prices_max=${r.maxRent}` : ""}`,
  },
  {
    id: "otm",
    name: "OnTheMarket",
    colour: "#2b2d6e",
    note: "Some homes appear here first",
    url: (r) => `https://www.onthemarket.com/to-rent/property/${slug(r.area)}/?radius=${r.radius}.0&min-bedrooms=${r.minBeds}${r.maxRent ? `&max-price=${r.maxRent}` : ""}`,
  },
  {
    id: "spareroom",
    name: "SpareRoom",
    colour: "#f15a29",
    note: "Rooms and house shares",
    rooms: true,
    url: (r) => `https://www.spareroom.co.uk/flatshare/?mode=list&where=${enc(r.area)}&miles_from_max=${r.radius}${r.maxRent ? `&max_rent=${r.maxRent}&per=pcm` : ""}`,
  },
];

export function RentView() {
  const prefs = usePrefs();
  const { user } = useAuth();
  const [r, setR] = useState<RentSearch>(DEFAULT_RENT);
  const [income, setIncome] = useState<number | null>(null);

  useEffect(() => {
    setR({ ...DEFAULT_RENT, ...(prefs.rent ?? {}) });
  }, [prefs.rent]);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from("finance_profile")
      .select("monthly_income")
      .maybeSingle()
      .then(({ data }) => setIncome(data?.monthly_income ? Number(data.monthly_income) : null));
  }, [user]);

  // Save as you change it (kept on the phone and in your account)
  const update = (patch: Partial<RentSearch>) => {
    const next = { ...r, ...patch };
    setR(next);
    savePrefs({ ...readPrefs(), rent: next }).catch(() => {});
  };

  const portals = PORTALS.filter((p) => (r.kind === "room" ? p.rooms : !p.rooms));
  const share = income && r.maxRent ? Math.round((r.maxRent / income) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Saved search */}
      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Search size={16} className="text-accent" /> Your search
          <span className="ml-auto text-[11px] font-medium text-faint">Saved automatically</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="block text-xs font-medium text-muted">Area or postcode</span>
            <input className={inputClass} value={r.area} onChange={(e) => update({ area: e.target.value })} placeholder="Shrewsbury" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted">Max rent (£ / month)</span>
            <input
              className={inputClass}
              inputMode="numeric"
              value={r.maxRent ?? ""}
              onChange={(e) => update({ maxRent: e.target.value ? Math.max(0, Number(e.target.value.replace(/\D/g, ""))) : null })}
              placeholder="Any"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted">Within</span>
            <select className={inputClass} value={r.radius} onChange={(e) => update({ radius: Number(e.target.value) })}>
              {[1, 3, 5, 10, 15].map((m) => (
                <option key={m} value={m}>
                  {m} mile{m > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-muted">Bedrooms (at least)</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((b) => (
              <button key={b} onClick={() => update({ minBeds: b })} className={`chip min-h-10 flex-1 justify-center ${r.minBeds === b ? "bg-accent! text-white!" : ""}`}>
                {b}
                {b === 4 ? "+" : ""}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-xs font-medium text-muted">Type</span>
          <div className="flex gap-2">
            {(
              [
                ["any", "Any"],
                ["house", "House"],
                ["flat", "Flat"],
                ["room", "Room"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} onClick={() => update({ kind: k })} className={`chip min-h-10 flex-1 justify-center ${r.kind === k ? "bg-accent! text-white!" : ""}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {share != null && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${share > 40 ? "bg-[#ff3b30]/10 text-[#d70015]" : share > 30 ? "bg-[#ff9500]/12 text-[#b25000]" : "bg-[#34c759]/12 text-[#1f7a3a]"}`}>
            £{r.maxRent} is {share}% of your monthly income.{" "}
            {share > 40 ? "That's a stretch — most landlords look for income around 2.5× the rent." : share > 30 ? "Doable, but tight once bills are added." : "Comfortable."}
          </p>
        )}
      </section>

      {/* One-tap searches */}
      <section>
        <SectionHeader title="Search now" />
        <ul className="stagger card divide-y divide-line overflow-hidden">
          {portals.map((p, i) => (
            <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
              <a href={p.url(r)} target="_blank" rel="noopener noreferrer" className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black text-white" style={{ background: p.colour }}>
                  {p.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{p.note}</span>
                </span>
                <ExternalLink size={16} className="shrink-0 text-faint" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-xs text-faint">
          Opens each site with your area, rent, bedrooms and distance already filled in. If you have their app installed, it opens there.
        </p>
      </section>

      {/* Instant alerts */}
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <span className="icon-tile shrink-0" style={{ "--tile": "#ff9500" } as React.CSSProperties}>
            <BellRing size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Get a ping the second a home is listed</p>
            <p className="mt-0.5 text-sm text-muted">
              Rightmove, Zoopla and OpenRent don&apos;t let other apps read their listings, but their own apps send instant notifications. Set it up once on each:
            </p>
          </div>
        </div>
        <ol className="mt-3 space-y-2 text-sm">
          {[
            "Install the Rightmove, Zoopla and OpenRent apps and sign in (free).",
            "Tap that site above — your search opens already filtered.",
            "Tap “Save search” / “Create alert” and pick Instant (not daily).",
            "Allow notifications when the app asks — that's what makes your phone buzz.",
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">{i + 1}</span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-faint">Good rentals in Shrewsbury can go within a day or two — instant alerts plus a quick call to the agent is the winning combo.</p>
      </section>

      {/* Social housing */}
      <section>
        <SectionHeader title="Council and housing association homes" />
        <div className="space-y-2">
          <a href="https://www.shropshirehomepoint.co.uk/" target="_blank" rel="noopener noreferrer" className="card flex min-h-16 items-center gap-3 p-4">
            <span className="icon-tile shrink-0" style={{ "--tile": "#34c759" } as React.CSSProperties}>
              <Landmark size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Shropshire HomePoint</span>
              <span className="block text-xs text-muted">The housing register for Shropshire. Register, then bid on council and housing association homes each week.</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-faint" />
          </a>
          <a href="tel:03003038595" className="card flex min-h-14 items-center gap-3 p-4">
            <span className="icon-tile shrink-0" style={{ "--tile": "#0a84ff" } as React.CSSProperties}>
              <Phone size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Call HomePoint</span>
              <span className="block text-xs text-muted">0300 303 8595 — help registering or with your banding</span>
            </span>
          </a>
          <a href="https://www.homesplus.co.uk/finding-a-home/homes-to-rent/" target="_blank" rel="noopener noreferrer" className="card flex min-h-16 items-center gap-3 p-4">
            <span className="icon-tile shrink-0" style={{ "--tile": "#af52de" } as React.CSSProperties}>
              <Building2 size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Homes Plus / Wrekin “Find a Home”</span>
              <span className="block text-xs text-muted">Affordable homes available now — use their “Save a search” to get emailed when one matches.</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-faint" />
          </a>
          <a href="https://shropshire.gov.uk/housing-options-and-homelessness/types-of-housing-available" target="_blank" rel="noopener noreferrer" className="card flex min-h-14 items-center gap-3 p-4">
            <span className="icon-tile shrink-0" style={{ "--tile": "#8e8e93" } as React.CSSProperties}>
              <Home size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Other options in Shropshire</span>
              <span className="block text-xs text-muted">Shared ownership, supported housing and help from the council.</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-faint" />
          </a>
        </div>
      </section>

      <p className="flex items-start gap-2 px-1 text-xs text-faint">
        <Users size={14} className="mt-0.5 shrink-0" /> Viewing a place? Add it to your Calendar from the Home screen&apos;s “Add event” so you get a reminder.
      </p>
    </div>
  );
}
