"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { describe, usePlace, useWeather } from "@/lib/weather";
import { outcome, useTeams } from "@/lib/football";
import { useFavTeams } from "@/lib/prefs";

/**
 * The app's "mood": what the sky behind everything looks like, how the mascot feels,
 * and a cheeky one-liner for the Home screen — worked out from the time, the real
 * weather where you are, and how your team is doing. One provider so it's only fetched once.
 */

export type Scene = "dawn" | "day" | "dusk" | "night";
export type Sky = "clear" | "cloud" | "rain" | "snow" | "storm" | "fog";
export type Mood = "happy" | "party" | "rain" | "cold" | "sleepy" | "sunny" | "gutted";

export type Vibe = {
  scene: Scene;
  sky: Sky;
  temp: number | null;
  rainSoon: boolean;
  mood: Mood;
  line: string;
  ready: boolean;
};

const DEFAULT: Vibe = { scene: "day", sky: "clear", temp: null, rainSoon: false, mood: "happy", line: "", ready: false };
const VibeCtx = createContext<Vibe>(DEFAULT);
export const useVibe = () => useContext(VibeCtx);

function sceneFor(h: number): Scene {
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

function skyFor(kind: ReturnType<typeof describe>["kind"]): Sky {
  if (kind === "rain" || kind === "drizzle") return "rain";
  if (kind === "storm") return "storm";
  if (kind === "snow") return "snow";
  if (kind === "fog") return "fog";
  if (kind === "cloud") return "cloud";
  return "clear";
}

const pick = <T,>(list: T[], seed: number) => list[Math.abs(seed) % list.length];

export function VibeProvider({ children }: { children: React.ReactNode }) {
  const { place } = usePlace();
  const { data: wx } = useWeather(place);
  const fav = useFavTeams();
  const main = fav[0];
  const { data: teams } = useTeams(main ? [main] : []);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const vibe = useMemo<Vibe>(() => {
    if (!now) return DEFAULT;
    const h = now.getHours();
    const scene = sceneFor(h);
    const kind = wx ? describe(wx.current.code).kind : "clear";
    const sky = skyFor(kind);
    const temp = wx ? Math.round(wx.current.temp) : null;
    const rainSoon = Boolean(wx?.hourly.slice(0, 4).some((x) => x.rain >= 60)) || sky === "rain" || sky === "storm";

    // Football: last result in the past 3 days, next match countdown
    const td = main ? teams[main.id] : undefined;
    const teamName = td?.team.name ?? main?.name ?? "Villa";
    const short = /aston villa/i.test(teamName) ? "Villa" : teamName;
    const last = td?.last?.[0];
    const lastWhen = last?.kickoff ? Date.parse(last.kickoff) : last?.date ? Date.parse(`${last.date}T15:00:00`) : 0;
    const recent = last && lastWhen && now.getTime() - lastWhen < 3 * 86400e3 ? outcome(last, td?.team.name ?? teamName) : null;
    const next = td?.next?.[0];
    const nextAt = next?.kickoff ? Date.parse(next.kickoff) : next?.date ? Date.parse(`${next.date}T15:00:00`) : 0;
    const days = nextAt ? Math.round((new Date(nextAt).setHours(12, 0, 0, 0) - new Date(now).setHours(12, 0, 0, 0)) / 86400e3) : null;

    // Mascot mood (most important first)
    let mood: Mood = "happy";
    if (recent === "W") mood = "party";
    else if (recent === "L") mood = "gutted";
    else if (h >= 23 || h < 5) mood = "sleepy";
    else if (rainSoon) mood = "rain";
    else if (temp != null && temp <= 3) mood = "cold";
    else if (sky === "clear" && scene !== "night" && (temp ?? 0) >= 15) mood = "sunny";

    // Cheeky line — two bits stitched together; seeded by the hour so it doesn't flicker
    const seed = now.getDate() * 24 + h;
    const fri = now.getDay() === 5 && h >= 16;
    const weekend = now.getDay() === 6 || now.getDay() === 0;
    let a: string;
    if (h >= 23 || h < 5) a = pick(["Still up? Bed, Jack", "It's late — phone down soon", "Night owl mode on"], seed);
    else if (sky === "storm") a = "Stormy out there — stay in if you can";
    else if (sky === "snow") a = "Snow! Wrap up and mind the roads";
    else if (rainSoon) a = pick(["Rain's on the way — brolly time", "Wet one coming, grab a coat", "Rain incoming. Classic Shropshire"], seed);
    else if (temp != null && temp <= 3) a = pick([`${temp}° out there. Coat on, chin up`, `Brr, ${temp}°. Scarf weather`, `${temp}° — defrost the car first`], seed);
    else if (fri) a = pick(["Friday night — feet up, you've earned it", "It's the weekend (nearly). Get in"], seed);
    else if (weekend) a = pick(["Weekend mode activated", "No alarms, no stress — weekend vibes"], seed);
    else if (sky === "clear" && scene !== "night") a = pick([`${temp ?? ""}° and clear — get outside`, "Blue skies. Make the most of it"], seed);
    else if (h < 12) a = pick(["Kettle on, let's go", "New day, clean slate", "Morning — you've got this"], seed);
    else a = pick(["Steady as she goes", "All ticking along nicely", "Nothing on fire. Lovely"], seed);

    let b = "";
    if (recent === "W") b = `${short} won! Up the ${short} 🦁`;
    else if (recent === "L") b = `${short} lost. We go again`;
    else if (days === 0) b = `${short} play TODAY ⚽`;
    else if (days === 1) b = `${short} tomorrow — get ready`;
    else if (days != null && days > 1 && days <= 7) b = `${short} in ${days} days`;

    const line = b ? `${a}. ${b}` : `${a}.`;
    return { scene, sky, temp, rainSoon, mood, line, ready: true };
  }, [now, wx, teams, main]);

  return <VibeCtx.Provider value={vibe}>{children}</VibeCtx.Provider>;
}
