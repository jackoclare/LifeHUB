"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type FavTeam, DEFAULT_TEAMS } from "@/lib/football";

/** Personal preferences — kept on the phone for speed and synced to your account */
export type Prefs = {
  teams: FavTeam[];
  airport: string;
  supermarket: string | null;
  diet: string[];
  /** Homes-to-rent search (Renting page) */
  rent?: RentSearch;
  /** Parcels being tracked (Parcels page) */
  parcels?: Parcel[];
  /** Current parking session (Parking page) — the alerts job reads this */
  parking?: Parking | null;
  /** Usual train, watched for delays (Trains page) */
  train?: UsualTrain | null;
  /** Saved train stations (CRS codes) */
  stations?: { from: string; to: string | null };
};
export type Parcel = { id: string; number: string; courier: string; label: string; added: string; delivered?: boolean };
export type Parking = { started: string; expires: string | null; lat?: number; lon?: number; note?: string };
export type UsualTrain = { from: string; to: string; time: string; days: number[] }; // days: 0=Sun … 6=Sat
export type RentSearch = { area: string; maxRent: number | null; minBeds: number; radius: number; kind: "any" | "house" | "flat" | "room" };
export const DEFAULT_RENT: RentSearch = { area: "Shrewsbury", maxRent: null, minBeds: 1, radius: 5, kind: "any" };
export const DEFAULT_PREFS: Prefs = { teams: DEFAULT_TEAMS, airport: "BHX", supermarket: null, diet: [] };
const KEY = "mlh.prefs.v1";

export function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (p && Array.isArray(p.teams)) return { ...DEFAULT_PREFS, ...p };
  } catch {}
  return DEFAULT_PREFS;
}

/** Change part of the prefs and save (merges with what's stored now). */
export function updatePrefs(patch: Partial<Prefs>) {
  return savePrefs({ ...readPrefs(), ...patch });
}

export async function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    localStorage.setItem("mlh.airport", p.airport);
  } catch {}
  window.dispatchEvent(new Event("mlh-prefs"));
  const sb = createClient();
  const { data } = await sb.auth.getUser();
  if (data.user) await sb.from("user_settings").upsert({ user_id: data.user.id, prefs: p, updated_at: new Date().toISOString() });
}

/** Load once from the account (another device may have changed them) */
export async function syncPrefsFromAccount() {
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return;
  const { data } = await sb.from("user_settings").select("prefs").eq("user_id", u.user.id).maybeSingle();
  if (data?.prefs && Array.isArray((data.prefs as Prefs).teams)) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_PREFS, ...(data.prefs as Prefs) }));
    } catch {}
    window.dispatchEvent(new Event("mlh-prefs"));
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    const load = () => setPrefs(readPrefs());
    load();
    window.addEventListener("mlh-prefs", load);
    return () => window.removeEventListener("mlh-prefs", load);
  }, []);
  return prefs;
}

export function useFavTeams() {
  return usePrefs().teams;
}
