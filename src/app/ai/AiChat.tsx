"use client";

import Link from "next/link";
import { RichText } from "@/components/RichText";
import { ArrowUp, ImagePlus, Loader2, Mic, Square, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { Mascot } from "@/components/Mascot";
import { createClient } from "@/lib/supabase/client";
import { useVibe } from "@/lib/vibe";
import { useVoiceNote } from "@/lib/voice";
import { runActions, undoAction, type ActionResult, type AiAction } from "@/lib/aiActions";

type Msg = { role: "user" | "assistant"; text: string; image?: string; error?: boolean; done?: ActionResult[]; voice?: boolean };
const STORE = "mlh.ai.chat.v2";

/** Shrink a photo before sending (keeps uploads fast and cheap). PNG for editing, JPEG for chat. */
export async function shrink(file: File, max = 1280, png = false): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function askAi(body: Record<string, unknown>): Promise<{ text?: string; image?: string; error?: string; actions?: AiAction[] }> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Please unlock the app with your PIN first." };
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch {
    return { error: "Couldn't reach the AI — check your signal." };
  }
}

const transcribe = (audio: string) => askAi({ mode: "transcribe", audio });

const DO_EXAMPLES = ["Dentist Tuesday at 3pm", "Add milk, eggs and 2 loaves to the shopping", "Mum's birthday is 4 March", "I've parked for 2 hours", "I'm going to Málaga for 4 days", "I'm going for a run"];
const ASK_EXAMPLES = ["What have I got on this week?", "Plan a cheap weekend in Lisbon", "What should I cook with chicken, rice and peppers?"];

function Receipt({ r }: { r: ActionResult }) {
  const [undone, setUndone] = useState(false);
  return (
    <div className={`ai-receipt flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm ${r.ok ? "" : "ai-receipt-bad"} ${undone ? "opacity-40" : ""}`}>
      <span className="text-base">{r.icon}</span>
      <Link href={r.href} className="min-w-0 flex-1 truncate font-medium">
        {undone ? <s>{r.label}</s> : r.label}
      </Link>
      {r.ok && !undone && (r.table || r.pref) && (
        <button
          className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:text-ink"
          aria-label="Undo"
          onClick={async () => {
            await undoAction(r);
            setUndone(true);
          }}
        >
          <Undo2 size={15} />
        </button>
      )}
    </div>
  );
}

export function AiChat() {
  const { user, loading } = useAuth();
  const { mood } = useVibe();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "[]");
      if (Array.isArray(saved)) setMsgs(saved);
    } catch {}
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30).map((m) => ({ ...m, image: undefined }))));
    } catch {}
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const send = useCallback(async (raw: string, img: string | null, voice = false) => {
    const t = raw.trim();
    if (!t && !img) return;
    const mine: Msg = { role: "user", text: t, image: img ?? undefined, voice };
    const next = [...msgsRef.current, mine];
    setMsgs(next);
    setText("");
    setPhoto(null);
    setBusy(true);
    const r = await askAi({ mode: "chat", messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text, image: m.image })) });
    let done: ActionResult[] | undefined;
    if (!r.error && r.actions?.length) done = await runActions(r.actions);
    setMsgs((m) => [...m, r.error ? { role: "assistant", text: r.error, error: true } : { role: "assistant", text: r.text ?? "", done }]);
    if (done?.some((d) => d.ok)) navigator.vibrate?.([10, 40, 10]);
    const go = done?.find((d) => d.go)?.go;
    if (go) setTimeout(() => (window.location.href = go), 900);
    setBusy(false);
  }, []);

  const voice = useVoiceNote((heard) => send(heard, null, true), transcribe);
  const listening = voice.state === "recording";

  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to use the AI assistant." />;

  const empty = msgs.length === 0;

  return (
    <div className="ai-page mx-auto flex min-h-[calc(100dvh-20rem)] max-w-2xl flex-col">
      {status && !status.configured && (
        <p className="mb-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-400">The free AI isn&apos;t connected yet — it needs a free Groq key adding in Supabase secrets.</p>
      )}

      <div className="flex-1 space-y-3 pb-4">
        {empty && (
          <div className="flex flex-col items-center pt-8 text-center">
            <button
              onClick={voice.toggle}
              disabled={voice.state === "working" || busy}
              className={`ai-orb ${listening ? "is-listening" : ""}`}
              style={{ "--lvl": voice.level } as React.CSSProperties}
              aria-label={listening ? "Stop and send" : "Tap and talk"}
            >
              <span className="ai-orb-ring" aria-hidden />
              <span className="ai-orb-ring ai-orb-ring-2" aria-hidden />
              {voice.state === "working" ? <Loader2 size={34} className="animate-spin" /> : listening ? <Square size={30} fill="currentColor" /> : <Mic size={36} />}
            </button>
            <p className="mt-5 font-display text-xl font-bold">{listening ? "Listening… tap to send" : voice.state === "working" ? "Got it…" : "Tap and talk"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Say it how you&apos;d say it — I&apos;ll put everything in the right place: calendar, shopping, meals, wish list, house jobs. Or just ask me anything.</p>
            {voice.error && <p className="mt-2 text-sm text-[#ff6b61]">{voice.error}</p>}

            <p className="mt-6 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#00e5ff]">Try saying</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {DO_EXAMPLES.map((ex) => (
                <button key={ex} className="chip ai-chip min-h-9 px-3!" onClick={() => send(ex, null)}>
                  {ex}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {ASK_EXAMPLES.map((ex) => (
                <button key={ex} className="chip min-h-9 px-3!" onClick={() => send(ex, null)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "items-end justify-start gap-2"}`}>
            {m.role === "assistant" && (
              <span className="mb-0.5 shrink-0">
                <Mascot mood={m.error ? "gutted" : mood} size={30} />
              </span>
            )}
            <div className={`max-w-[85%] rounded-[1.4rem] px-4 py-2.5 text-[0.95rem] leading-relaxed ${m.role === "user" ? "ai-bubble-me rounded-br-md" : m.error ? "rounded-bl-md bg-red-500/10 text-red-400" : "ai-bubble-ai rounded-bl-md"}`}>
              {m.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="Your photo" className="mb-2 max-h-56 rounded-xl" />
              )}
              {m.voice && <span className="mb-0.5 flex items-center gap-1 text-[0.68rem] font-semibold uppercase tracking-wider opacity-70"><Mic size={11} /> Voice</span>}
              {m.text && (m.role === "assistant" && !m.error ? <RichText text={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>)}
              {m.done?.length ? (
                <div className="mt-2 space-y-1.5">
                  {m.done.map((r, j) => (
                    <Receipt key={j} r={r} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="ai-typing" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="ai-dock sticky bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-20 space-y-2 rounded-[1.6rem] p-2 lg:bottom-6">
        {photo && (
          <div className="relative ml-1 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Attached" className="h-20 rounded-xl" />
            <button aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-bg">
              <X size={12} />
            </button>
          </div>
        )}
        {!empty && voice.error && <p className="px-2 text-xs text-[#ff6b61]">{voice.error}</p>}
        <form
          className="flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) send(text, photo);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setPhoto(await shrink(f, 1280));
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:text-ink" aria-label="Add a photo">
            <ImagePlus size={19} />
          </button>
          {msgs.length > 0 && (
            <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full text-faint hover:text-ink" aria-label="Clear chat" onClick={() => setMsgs([])}>
              <Trash2 size={16} />
            </button>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) send(text, photo);
              }
            }}
            rows={1}
            placeholder={listening ? "Listening…" : "Ask, or tell me what to add…"}
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base outline-none placeholder:text-faint"
            aria-label="Message"
          />
          {text.trim() || photo ? (
            <button className="btn btn-primary size-11 shrink-0 rounded-full! p-0!" disabled={busy} aria-label="Send">
              <ArrowUp size={19} />
            </button>
          ) : (
            <button
              type="button"
              onClick={voice.toggle}
              disabled={voice.state === "working" || busy}
              className={`ai-mic grid size-11 shrink-0 place-items-center rounded-full ${listening ? "is-listening" : ""}`}
              style={{ "--lvl": voice.level } as React.CSSProperties}
              aria-label={listening ? "Stop and send" : "Talk"}
            >
              {voice.state === "working" ? <Loader2 size={18} className="animate-spin" /> : listening ? <Square size={15} fill="currentColor" /> : <Mic size={19} />}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
