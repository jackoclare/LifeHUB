"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { Crest } from "@/components/sport/SportWidgets";
import { type Prefs, savePrefs, usePrefs } from "@/lib/prefs";
import { UK_AIRPORTS } from "@/lib/travel";

const SUPERMARKETS = ["Tesco", "Asda", "Sainsbury's", "Aldi", "Lidl", "Morrisons", "Co-op", "Iceland", "Waitrose", "M&S"];
const DIETS = ["Vegetarian", "Vegan", "Pescatarian", "Gluten-free", "Dairy-free", "Halal", "Low-carb", "High-protein"];

/** Favourite teams, home airport, supermarket and diet — used across the app */
export function PreferencesCard() {
  const prefs = usePrefs();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; badge: string | null; league: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Prefs>) => savePrefs({ ...prefs, ...p });

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    const j = await fetch(`/api/sportsdb?kind=searchteam&id=${encodeURIComponent(q.trim())}`).then((r) => r.json()).catch(() => ({ items: [] }));
    setResults(
      ((j.items ?? []) as Record<string, string | null>[])
        .filter((t) => t.strSport === "Soccer")
        .slice(0, 8)
        .map((t) => ({ id: String(t.idTeam), name: String(t.strTeam), badge: t.strBadge ?? null, league: t.strLeague ?? null })),
    );
    setBusy(false);
  };

  return (
    <div className="card space-y-5 p-4">
      <h3 className="text-sm font-semibold">Your preferences</h3>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">Favourite teams (fixtures, calendar, kick-off alerts)</p>
        <ul className="space-y-1.5">
          {prefs.teams.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="flex-1 font-medium">{t.name}</span>
              {prefs.teams.length > 1 && (
                <button aria-label={`Remove ${t.name}`} className="text-faint" onClick={() => set({ teams: prefs.teams.filter((x) => x.id !== t.id) })}>
                  <X size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {prefs.teams.length < 4 && (
          <form onSubmit={search} className="mt-2 flex gap-2">
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3">
              <Search size={15} className="text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a team, e.g. Birmingham" className="w-full bg-transparent text-base outline-none" />
            </label>
            <button className="btn btn-ghost" disabled={busy}>
              Find
            </button>
          </form>
        )}
        {results.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {results.map((t) => (
              <li key={t.id}>
                <button
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm"
                  onClick={() => {
                    if (!prefs.teams.some((x) => x.id === t.id)) set({ teams: [...prefs.teams, { id: t.id, name: t.name }] });
                    setResults([]);
                    setQ("");
                  }}
                >
                  <Crest src={t.badge} alt="" size={24} />
                  <span className="flex-1">
                    <span className="block font-medium">{t.name}</span>
                    <span className="block text-xs text-muted">{t.league}</span>
                  </span>
                  <Plus size={16} className="text-accent" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Home airport</span>
        <select value={prefs.airport} onChange={(e) => set({ airport: e.target.value })} className="min-h-10 rounded-xl bg-surface-2 px-3 text-base outline-none">
          {UK_AIRPORTS.map((a) => (
            <option key={a.code} value={a.code}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Main supermarket</span>
        <select value={prefs.supermarket ?? ""} onChange={(e) => set({ supermarket: e.target.value || null })} className="min-h-10 rounded-xl bg-surface-2 px-3 text-base outline-none">
          <option value="">No preference</option>
          {SUPERMARKETS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">Diet (used for meal ideas)</p>
        <div className="flex flex-wrap gap-2">
          {DIETS.map((d) => {
            const on = prefs.diet.includes(d);
            return (
              <button key={d} onClick={() => set({ diet: on ? prefs.diet.filter((x) => x !== d) : [...prefs.diet, d] })} className={`min-h-9 rounded-full px-3 text-sm font-medium ${on ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
