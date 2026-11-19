"use client";

import { Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { describe, usePlace, useWeather } from "@/lib/weather";
import { useVibe } from "@/lib/vibe";

/**
 * "Share my day": one tap draws a neon card (date, weather, next thing / live score, steps)
 * as an image and opens the phone's share sheet — straight into the group chat.
 * Falls back to downloading the image where sharing files isn't supported.
 */

const W = 1080;
const H = 1350;
const ukDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function stickMan(c: CanvasRenderingContext2D, x: number, y: number, s: number, cheer: boolean) {
  c.save();
  c.strokeStyle = "#ffffff";
  c.lineWidth = 7 * s;
  c.lineCap = "round";
  c.shadowColor = "#00e5ff";
  c.shadowBlur = 24;
  c.beginPath();
  c.arc(x, y, 26 * s, 0, Math.PI * 2);
  c.moveTo(x, y + 26 * s);
  c.lineTo(x, y + 90 * s);
  if (cheer) {
    c.moveTo(x, y + 44 * s);
    c.lineTo(x - 34 * s, y + 4 * s);
    c.moveTo(x, y + 44 * s);
    c.lineTo(x + 34 * s, y + 4 * s);
  } else {
    c.moveTo(x, y + 44 * s);
    c.lineTo(x - 28 * s, y + 70 * s);
    c.moveTo(x, y + 44 * s);
    c.lineTo(x + 32 * s, y + 20 * s);
    c.lineTo(x + 44 * s, y + 2 * s);
  }
  c.moveTo(x, y + 90 * s);
  c.lineTo(x - 20 * s, y + 140 * s);
  c.moveTo(x, y + 90 * s);
  c.lineTo(x + 20 * s, y + 140 * s);
  c.stroke();
  c.restore();
}

export function ShareDayButton({ now, next }: { now: Date | null; next: { title: string; when: string } | null }) {
  const { place } = usePlace();
  const { data: wx } = useWeather(place);
  const { live, line } = useVibe();
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      // steps today (if Apple Health is linked)
      let steps: number | null = null;
      try {
        const { data } = await createClient().from("health_daily").select("steps").eq("day", ukDate()).maybeSingle();
        steps = data?.steps != null ? Number(data.steps) : null;
      } catch {}

      await document.fonts?.ready;
      const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const c = cv.getContext("2d")!;

      // background: black with cyan / violet glows
      c.fillStyle = "#000";
      c.fillRect(0, 0, W, H);
      const g1 = c.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 620);
      g1.addColorStop(0, "rgba(0,229,255,0.30)");
      g1.addColorStop(1, "rgba(0,229,255,0)");
      c.fillStyle = g1;
      c.fillRect(0, 0, W, H);
      const g2 = c.createRadialGradient(80, H - 120, 0, 80, H - 120, 640);
      g2.addColorStop(0, "rgba(168,85,255,0.26)");
      g2.addColorStop(1, "rgba(168,85,255,0)");
      c.fillStyle = g2;
      c.fillRect(0, 0, W, H);
      // fine grid
      c.strokeStyle = "rgba(0,229,255,0.05)";
      c.lineWidth = 1;
      for (let x = 0; x < W; x += 54) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, H);
        c.stroke();
      }
      for (let y = 0; y < H; y += 54) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
      // neon border
      const edge = c.createLinearGradient(0, 0, W, H);
      edge.addColorStop(0, "#00e5ff");
      edge.addColorStop(0.5, "#3d7bff");
      edge.addColorStop(0.8, "#a855ff");
      edge.addColorStop(1, "#00f5a0");
      c.save();
      c.shadowColor = "#00e5ff";
      c.shadowBlur = 30;
      c.strokeStyle = edge;
      c.lineWidth = 5;
      roundRect(c, 36, 36, W - 72, H - 72, 64);
      c.stroke();
      c.restore();

      const d = now ?? new Date();
      c.textBaseline = "alphabetic";
      c.fillStyle = "#00e5ff";
      c.font = `800 34px ${font}`;
      c.fillText("LIFEHUB", 100, 150);
      c.fillStyle = "#ffffff";
      c.font = `800 88px ${font}`;
      c.fillText("Jack's day", 100, 250);
      c.fillStyle = "rgba(255,255,255,0.6)";
      c.font = `500 40px ${font}`;
      c.fillText(d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }), 100, 310);

      // weather block
      let y = 470;
      if (wx) {
        const today = wx.daily[0];
        c.save();
        c.font = `200 190px ${font}`;
        const tg = c.createLinearGradient(0, y - 160, 0, y);
        tg.addColorStop(0, "#ffffff");
        tg.addColorStop(1, "#7fefff");
        c.fillStyle = tg;
        c.shadowColor = "rgba(0,229,255,0.5)";
        c.shadowBlur = 30;
        c.fillText(`${Math.round(wx.current.temp)}°`, 92, y + 30);
        c.restore();
        c.fillStyle = "#fff";
        c.font = `700 48px ${font}`;
        c.fillText(describe(wx.current.code).label, 480, y - 60);
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.font = `500 38px ${font}`;
        if (today) c.fillText(`High ${Math.round(today.max)}° · Low ${Math.round(today.min)}°`, 480, y - 6);
        if (place?.name) c.fillText(place.name.replace(/, United Kingdom$/, ""), 480, y + 44);
      }

      // cards
      const card = (top: number, label: string, value: string, sub: string, colour: string) => {
        c.save();
        roundRect(c, 100, top, W - 200, 190, 40);
        c.fillStyle = "rgba(255,255,255,0.04)";
        c.fill();
        c.strokeStyle = colour;
        c.globalAlpha = 0.55;
        c.lineWidth = 2.5;
        c.stroke();
        c.restore();
        c.fillStyle = colour;
        c.font = `800 28px ${font}`;
        c.fillText(label.toUpperCase(), 140, top + 58);
        c.fillStyle = "#fff";
        c.font = `700 52px ${font}`;
        let v = value;
        while (c.measureText(v).width > W - 290 && v.length > 4) v = `${v.slice(0, -2)}…`;
        c.fillText(v, 140, top + 122);
        c.fillStyle = "rgba(255,255,255,0.55)";
        c.font = `500 32px ${font}`;
        c.fillText(sub, 140, top + 164);
      };
      y = 600;
      if (live && live.phase !== "soon") {
        card(y, live.phase === "ft" ? "Full time" : live.phase === "ht" ? "Half time" : `Live · ${live.minuteLabel}`, `${live.match.home} ${live.score[0]}–${live.score[1]} ${live.match.away}`, live.data?.league ?? "Matchday", "#00f5a0");
      } else if (next) {
        card(y, "Next up", next.title, next.when, "#3d7bff");
      } else {
        card(y, "Next up", "Nothing planned", "Free day 😎", "#3d7bff");
      }
      y += 230;
      card(y, "Steps today", steps != null ? steps.toLocaleString("en-GB") : "—", steps != null ? (steps >= 10000 ? "Goal smashed 🔥" : `${Math.max(0, 10000 - steps).toLocaleString("en-GB")} to go`) : "Link Apple Health to show steps", "#ffb020");

      // one-liner + stick man
      c.fillStyle = "rgba(255,255,255,0.75)";
      c.font = `italic 500 36px ${font}`;
      let l = line || "All ticking along nicely.";
      while (c.measureText(l).width > W - 420 && l.length > 4) l = `${l.slice(0, -2)}…`;
      c.fillText(l, 100, 1190);
      stickMan(c, W - 190, 1080, 1, live ? live.phase !== "soon" && (live.ours === "home" ? live.score[0] >= live.score[1] : live.score[1] >= live.score[0]) : false);

      const blob: Blob | null = await new Promise((r) => cv.toBlob(r, "image/png"));
      if (!blob) throw new Error("Couldn't make the image");
      const file = new File([blob], `lifehub-${ukDate(d)}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My day — LifeHub" }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={make} disabled={busy} aria-label="Share my day as a picture" className="hero-glass relative grid size-11 shrink-0 place-items-center rounded-full transition-transform active:scale-90">
      {busy ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
    </button>
  );
}
