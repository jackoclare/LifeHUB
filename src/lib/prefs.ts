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
  /** Birthdays (Birthdays page) */
  birthdays?: Birthday[];
  /** Bin collections (Bins page) */
  bins?: BinSetup | null;
  /** Habits + the days they were done (Habits page) */
  habits?: Habit[];
  /** Receipts with return-by / warranty dates (Warranties page) */
  warranties?: Warranty[];
  /** Packing lists (Packing page) */
  packing?: PackingList[];
  /** Today's quiz + streak (Quiz page) */
  quiz?: QuizState;
  /** Walks and runs tracked with GPS (Walk & run page) */
  activities?: Activity[];
};
export type Activity = { id: string; kind: "walk" | "run"; start: string; secs: number; km: number; steps: number; kcal: number; route: [number, number][] };
export type PackingList = { id: string; place: string; start: string | null; days: number; weather: string; items: { id: string; text: string; section: string; done: boolean }[] };
export type QuizQ = { q: string; options: string[]; answer: number; explain: string; topic: string };
export type QuizState = { date: string; questions: QuizQ[]; picks: (number | null)[]; streak: number; lastDone: string | null; best: number; played: number };
export type Birthday = { id: string; name: string; date: string /* MM-DD */; year?: number | null; gift?: string };
export type Bin = { id: string; name: string; colour: string; every: 1 | 2 | 4; anchor: string /* a YYYY-MM-DD collection date */ };
export type BinSetup = { day: number /* 0 Sun … 6 Sat */; bins: Bin[]; remind: boolean };
export type Habit = { id: string; name: string; emoji: string; done: string[] /* YYYY-MM-DD, newest first, kept ~120 days */ };
export type Warranty = { id: string; item: string; shop?: string; bought: string; returnBy?: string | null; warrantyUntil?: string | null; price?: number | null };
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
