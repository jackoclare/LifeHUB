"use client";

import { RichText } from "@/components/RichText";
import { ArrowUp, Download, ImagePlus, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { createClient } from "@/lib/supabase/client";

type Msg = { role: "user" | "assistant"; text: string; image?: string; generated?: string; error?: boolean };
const STORE = "mlh.ai.chat.v1";

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

export async function askAi(body: Record<string, unknown>): Promise<{ text?: string; image?: string; error?: string }> {
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

export function AiChat() {
  const { user, loading } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ chat: string; edit: string } | null>(null);
  const [mode, setMode] = useState<"chat" | "image">("chat");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
      // keep the conversation for this session (photos dropped to save space)
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30).map((m) => ({ ...m, image: undefined }))));
    } catch {}
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to use the AI assistant." />;

  const send = async () => {
    const t = text.trim();
    if ((!t && !photo) || busy) return;
    const mine: Msg = { role: "user", text: t, image: photo?.chat };
    const next = [...msgs, mine];
    setMsgs(next);
    setText("");
    const p = photo;
    setPhoto(null);
    setBusy(true);
    if (mode === "image") {
      const r = await askAi({ mode: "image", prompt: t || "Improve this photo", image: p?.edit });
      setMsgs((m) => [...m, r.error ? { role: "assistant", text: r.error, error: true } : { role: "assistant", text: p ? "Here's your edited image." : "Here's what I made.", generated: r.image }]);
    } else {
      const r = await askAi({ mode: "chat", messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text, image: m.image })) });
      setMsgs((m) => [...m, r.error ? { role: "assistant", text: r.error, error: true } : { role: "assistant", text: r.text ?? "" }]);
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-13rem)] max-w-2xl flex-col lg:h-[calc(100dvh-10rem)]">
      {status && !status.configured && (
        <p className="mb-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-400">The free AI isn&apos;t connected yet — it needs a free Groq key adding in Supabase secrets.</p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {msgs.length === 0 && (
          <div className="card p-6 text-center">
            <Sparkles className="mx-auto text-accent" size={28} />
            <p className="mt-2 font-display text-lg font-semibold">Ask me anything</p>
            <p className="mt-1 text-sm text-muted">Ask anything, or send a photo and ask about it. Free AI (Groq), no cost.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["Plan a cheap weekend in Lisbon", "What should I cook with chicken, rice and peppers?", "Write a funny birthday message for my mate"].map((ex) => (
                <button key={ex} className="chip min-h-9 px-3!" onClick={() => setText(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed ${
                m.role === "user" ? "rounded-br-md bg-accent text-white" : m.error ? "rounded-bl-md bg-red-500/10 text-red-400" : "rounded-bl-md bg-surface-2"
              }`}
            >
              {m.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="Your photo" className="mb-2 max-h-56 rounded-xl" />
              )}
              {m.text && (m.role === "assistant" && !m.error ? <RichText text={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>)}
              {m.generated && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.generated} alt="AI image" className="rounded-xl" />
                  <a href={m.generated} target="_blank" rel="noopener noreferrer" download className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                    <Download size={14} /> Open / save
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> {mode === "image" ? "Creating your image — this can take up to a minute…" : "Thinking…"}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-xs text-faint">{mode === "image" ? (photo ? "Describe how to change your photo" : "Describe a picture, or add a photo to edit") : "Add a photo to ask about it"}</span>
          {msgs.length > 0 && (
            <button className="grid size-8 place-items-center rounded-full text-faint hover:text-ink" aria-label="Clear chat" onClick={() => setMsgs([])}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
        {photo && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.chat} alt="Attached" className="h-20 rounded-xl" />
            <button aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-bg">
              <X size={12} />
            </button>
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
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
              if (!f) return;
              const [chat, edit] = await Promise.all([shrink(f, 1280), shrink(f, 1024, true)]);
              setPhoto({ chat, edit });
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted hover:text-ink" aria-label="Add a photo">
            <ImagePlus size={19} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={mode === "image" ? "e.g. make it look like a sunny day" : "Message LifeHub AI…"}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-line bg-bg-elevated px-4 py-2.5 text-base outline-none focus:border-accent"
            aria-label="Message"
          />
          <button className="btn btn-primary size-11 shrink-0 rounded-full! p-0!" disabled={busy || (!text.trim() && !photo)} aria-label="Send">
            <ArrowUp size={19} />
          </button>
        </form>
      </div>
    </div>
  );
}
