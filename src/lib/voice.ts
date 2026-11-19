"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice notes that work everywhere — including the iPhone Home Screen app, where the browser's
 * built-in speech recognition is switched off. Records with the microphone, then the free Groq
 * Whisper model (via the `ai` Edge Function, mode "transcribe") turns it into text.
 * `level` (0–1) drives the glowing orb while you talk.
 */
export function useVoiceNote(onText: (text: string) => void, transcribe: (audio: string) => Promise<{ text?: string; error?: string }>) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  const cleanup = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setLevel(0);
  };
  useEffect(() => cleanup, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record — use the keyboard's mic button instead.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t));
      const r = new MediaRecorder(s, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        cleanup();
        const blob = new Blob(chunks, { type: r.mimeType || type || "audio/webm" });
        if (blob.size < 1500) {
          setState("idle");
          return;
        }
        setState("working");
        const data: string = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.readAsDataURL(blob);
        });
        const out = await transcribe(data);
        setState("idle");
        if (out.error) setError(out.error);
        else if (out.text?.trim()) cb.current(out.text.trim());
        else setError("I didn't catch that — try again.");
      };
      rec.current = r;
      r.start();
      setState("recording");
      navigator.vibrate?.(12);
      // live level meter for the orb
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 60));
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
      timer.current = setTimeout(() => r.state === "recording" && r.stop(), 60_000); // 1 minute max
    } catch {
      cleanup();
      setState("idle");
      setError("Microphone blocked — allow it in Settings → Safari (or your browser) → Microphone.");
    }
  }, [transcribe]);

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  return { state, level, error, start, stop, toggle: state === "recording" ? stop : start };
}
