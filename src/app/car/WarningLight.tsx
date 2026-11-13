"use client";

import { AlertTriangle, Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import { askAi, shrink } from "@/app/ai/AiChat";
import { RichText } from "@/components/RichText";
import type { Vehicle } from "./CarView";

/** Snap a dashboard warning light → the free AI explains it, says if it's safe to drive and what to do next. */
export function WarningLight({ vehicles }: { vehicles: Vehicle[] }) {
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const v = vehicles[0];

  const go = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setAnswer(null);
    try {
      const image = await shrink(file, 1280);
      setPhoto(image);
      const car = v ? [v.make, v.model, v.year, v.fuel_type].filter(Boolean).join(" ") : "a car";
      const r = await askAi({
        mode: "chat",
        messages: [
          {
            role: "user",
            image,
            text: `This is a photo of a warning light on my dashboard (${car}). Tell me: 1) what the light means, 2) how urgent it is — can I keep driving, drive carefully to a garage, or stop now? 3) what I should check or do next, and a rough UK repair cost if it's a common fault. If you can't see a warning light clearly, say so. Keep it short.`,
          },
        ],
      });
      if (r.error) setErr(r.error);
      else setAnswer(r.text ?? "");
    } catch {
      setErr("Couldn't read that photo — try again.");
    }
    setBusy(false);
  };

  return (
    <section className="card p-4">
      <div className="flex items-center gap-3">
        <span className="icon-tile" style={{ "--tile": "#ff9500" } as React.CSSProperties}>
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Warning light on?</p>
          <p className="text-xs text-muted">Snap it and the AI explains what it means and whether it&apos;s safe to drive.</p>
        </div>
      </div>
      <label className={`btn btn-primary mt-3 w-full cursor-pointer ${busy ? "opacity-80" : ""}`}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {busy ? "Checking the light…" : "Snap the warning light"}
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy} onChange={(e) => go(e.target.files?.[0] ?? undefined)} />
      </label>
      {(answer || err) && (
        <div className="mt-3 flex gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo && <img src={photo} alt="Your dashboard" className="size-16 shrink-0 rounded-xl object-cover" />}
          <div className="min-w-0 flex-1">{err ? <p className="text-muted">{err}</p> : <RichText text={answer!} />}</div>
        </div>
      )}
      {answer && (
        <p className="mt-2 text-[11px] text-faint">
          AI guidance only. A red light (oil, brakes, temperature) usually means stop safely as soon as you can. If in doubt, call your breakdown cover.
        </p>
      )}
    </section>
  );
}
