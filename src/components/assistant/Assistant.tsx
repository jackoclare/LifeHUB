"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Mic, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { type Intent, parse } from "@/lib/assistant";
import { guessAisle } from "@/app/shopping/ShoppingView";
import { DEFAULT_TEAMS, kickoffLabel, loadTeam } from "@/lib/football";
import { readPlace, describe } from "@/lib/weather";
import { dueLabel, isOverdue, monthlyEquivalent } from "@/lib/bills";
import { addDays, formatDay, toISODate } from "@/lib/dates";
import type { Bill } from "@/lib/types";

type Reply = { text: string; ok: boolean; link?: { href: string; label: string }; lines?: string[] };

const EXAMPLES = ["Add milk and 2 loaves of bread to the shopping list", "Dentist Friday at 3pm", "Remind me to call mum tomorrow at 6pm", "When's the next Villa game?", "What bills are due this week?", "Show me the weather"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;

export function Assistant() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [speak, setSpeak] = useState(true);
  const [canListen, setCanListen] = useState(false);
  const recRef = useRef<SR>(null);
  const finalRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    setCanListen(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    try {
      setSpeak(localStorage.getItem("mlh.assistant.speak") !== "0");
    } catch {
      /* ignore */
    }
  }, []);

  const say = useCallback(
    (t: string) => {
      if (!speak || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t.replace(/[💷⚽📅🛒🎁]/gu, ""));
      u.lang = "en-GB";
      u.rate = 1.05;
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang === "en-GB");
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    },
    [speak],
  );

  const respond = useCallback(
    (r: Reply) => {
      setReply(r);
      say(r.text);
    },
    [say],
  );

  const needSignIn = (): Reply => ({ ok: false, text: "You'll need to sign in first so I can save that to your account.", link: { href: "/settings", label: "Sign in" } });

  const run = useCallback(
    async (input: string) => {
      const q = input.trim();
      if (!q) return;
      setBusy(true);
      setReply(null);
      const intent: Intent = parse(q);
      const supabase = createClient();
      try {
        switch (intent.kind) {
          case "shopping": {
            if (!user) return respond(needSignIn());
            let { data: lists } = await supabase.from("shopping_lists").select("id,name").order("created_at");
            if (!lists?.length) {
              const created = await supabase.from("shopping_lists").insert({ name: "Weekly shop" }).select("id,name");
              lists = created.data ?? [];
            }
            const target = (intent.list && lists?.find((l) => l.name.toLowerCase().includes(intent.list!.toLowerCase()))) || lists?.[0];
            if (!target) throw new Error("Couldn't find a shopping list");
            const { error } = await supabase
              .from("shopping_items")
              .insert(intent.items.map((i) => ({ list_id: target.id, name: i.name, quantity: i.quantity, category: guessAisle(i.name) })));
            if (error) throw error;
            const names = intent.items.map((i) => (i.quantity > 1 ? `${i.quantity} ${i.name.toLowerCase()}` : i.name.toLowerCase()));
            respond({ ok: true, text: `Added ${listJoin(names)} to ${target.name}.`, link: { href: "/shopping", label: "Open shopping list" } });
            break;
          }
          case "wishlist": {
            if (!user) return respond(needSignIn());
            const { error } = await supabase.from("wishlist_items").insert({ name: intent.name, priority: 2 });
            if (error) throw error;
            respond({ ok: true, text: `Added ${intent.name} to your wish list.`, link: { href: "/wishlist", label: "Open wish list" } });
            break;
          }
          case "event": {
            if (!user) return respond(needSignIn());
            const { error } = await supabase.from("calendar_events").insert({ title: intent.title, event_date: intent.date, event_time: intent.time ?? null, kind: intent.reminder ? "reminder" : "personal" });
            if (error) throw error;
            const when = `${formatDay(intent.date)}${intent.time ? ` at ${fmtTime(intent.time)}` : ""}`;
            respond({ ok: true, text: `${intent.reminder ? "Reminder set" : "Added to your calendar"}: ${intent.title}, ${when}.`, link: { href: "/calendar", label: "Open calendar" } });
            break;
          }
          case "navigate": {
            respond({ ok: true, text: `Opening ${intent.label}.` });
            router.push(intent.href);
            setTimeout(() => setOpen(false), 600);
            break;
          }
          case "weather": {
            const place = readPlace();
            if (!place) return respond({ ok: false, text: "Set your location on the weather card first, then ask me again.", link: { href: "/weather", label: "Set location" } });
            const j = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FLondon&forecast_days=1`,
            ).then((r) => r.json());
            const c = Math.round(j.current.temperature_2m);
            const rain = j.daily.precipitation_probability_max[0];
            respond({
              ok: true,
              text: `It's ${c} degrees and ${describe(j.current.weather_code).label.toLowerCase()} in ${place.name.split(",")[0]}. High of ${Math.round(j.daily.temperature_2m_max[0])}, low of ${Math.round(j.daily.temperature_2m_min[0])}${rain >= 40 ? `, and a ${rain}% chance of rain — take a coat` : ""}.`,
              link: { href: "/weather", label: "Full forecast" },
            });
            break;
          }
          case "nextMatch": {
            const teams = intent.team === "villa" ? [DEFAULT_TEAMS[0]] : intent.team === "england" ? [DEFAULT_TEAMS[1]] : DEFAULT_TEAMS;
            const data = await Promise.all(teams.map((t) => loadTeam(t.id)));
            const matches = data.flatMap((d) => d.next.slice(0, 1)).sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""));
            const m = matches[0];
            if (!m) return respond({ ok: false, text: "I couldn't find an upcoming fixture right now." });
            respond({ ok: true, text: `${m.home} versus ${m.away}, ${kickoffLabel(m)}${m.league ? ` in the ${m.league}` : ""}.`, link: { href: `/sport/match/${m.id}`, label: "Match details & lineups" } });
            break;
          }
          case "billsDue":
          case "billsTotal": {
            if (!user) return respond(needSignIn());
            const { data } = await supabase.from("bills").select("*").eq("is_active", true).order("next_due_date");
            const bills = (data ?? []) as Bill[];
            if (intent.kind === "billsTotal") {
              const m = bills.reduce((s, b) => s + monthlyEquivalent(b), 0);
              respond({ ok: true, text: `Your bills come to about ${gbp(m)} a month, or ${gbp(m * 12)} a year.`, link: { href: "/bills", label: "Open bills" } });
            } else {
              const in7 = addDays(toISODate(new Date()), 7);
              const due = bills.filter((b) => b.next_due_date <= in7);
              if (!due.length) return respond({ ok: true, text: "Nothing due in the next seven days. 👍", link: { href: "/bills", label: "Open bills" } });
              const overdue = due.filter((b) => isOverdue(b));
              respond({
                ok: true,
                text: `${due.length} bill${due.length > 1 ? "s" : ""} due in the next week, ${gbp(due.reduce((s, b) => s + Number(b.amount), 0))} in total${overdue.length ? `, and ${overdue.length} overdue` : ""}.`,
                lines: due.map((b) => `${b.name} — ${gbp(Number(b.amount))} · ${dueLabel(b.next_due_date)}`),
                link: { href: "/bills", label: "Open bills" },
              });
            }
            break;
          }
          case "help":
            respond({ ok: true, text: "Here are some things you can ask me.", lines: EXAMPLES });
            break;
          default:
            respond({ ok: false, text: "Sorry, I didn't get that. Try one of these:", lines: EXAMPLES.slice(0, 4) });
        }
      } catch (e) {
        respond({ ok: false, text: `Something went wrong: ${e instanceof Error ? e.message : "please try again"}.` });
      } finally {
        setBusy(false);
      }
    },
    [user, router, respond],
  );

  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) {
      inputRef.current?.focus();
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    window.speechSynthesis?.cancel();
    const rec = new Rec();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    finalRef.current = "";
    rec.onresult = (e: SR) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setText((finalRef.current + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      const said = finalRef.current.trim();
      if (said) run(said);
    };
    recRef.current = rec;
    setReply(null);
    setText("");
    setListening(true);
    rec.start();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setReply(null);
          setText("");
        }}
        aria-label="Open assistant"
        className="assistant-fab fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-full text-white lg:bottom-8 lg:right-8"
      >
        <Sparkles size={24} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Assistant">
          <button aria-label="Close" className="sheet-backdrop absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div className="sheet-panel pb-safe relative w-full overflow-hidden rounded-t-[1.8rem] border border-line bg-bg-elevated sm:max-w-lg sm:rounded-[1.8rem]">
            <div className="flex items-center justify-between px-5 pt-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={16} className="text-accent" /> MyLife assistant
              </p>
              <div className="flex gap-1">
                <button
                  className="grid size-10 place-items-center rounded-full text-faint hover:text-ink"
                  aria-label={speak ? "Mute voice replies" : "Turn on voice replies"}
                  onClick={() => {
                    setSpeak((s) => {
                      try {
                        localStorage.setItem("mlh.assistant.speak", s ? "0" : "1");
                      } catch {
                        /* ignore */
                      }
                      if (s) window.speechSynthesis?.cancel();
                      return !s;
                    });
                  }}
                >
                  {speak ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button className="grid size-10 place-items-center rounded-full text-faint hover:text-ink" aria-label="Close" onClick={() => setOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Orb */}
            <div className="flex flex-col items-center px-5 pb-2 pt-4">
              <button onClick={listen} aria-label={listening ? "Stop listening" : "Tap and speak"} className={`orb ${listening ? "is-listening" : ""} ${busy ? "is-busy" : ""}`}>
                <span className="orb-ring" />
                <span className="orb-ring orb-ring-2" />
                <span className="orb-core">
                  <Mic size={30} />
                </span>
              </button>
              <p className="mt-4 min-h-6 text-center text-sm text-muted" aria-live="polite">
                {listening ? "Listening…" : busy ? "Working on it…" : canListen ? "Tap the mic and speak" : "Type below — or tap the 🎤 on your keyboard to speak"}
              </p>
              {text && <p className="mt-1 max-w-sm text-center font-display text-lg font-semibold leading-snug">“{text}”</p>}
            </div>

            {/* Reply */}
            <div className="px-5">
              {reply ? (
                <div className={`headline-in rounded-2xl p-4 ${reply.ok ? "bg-accent-soft" : "bg-surface-2"}`}>
                  <p className="flex items-start gap-2 text-sm font-medium">
                    {reply.ok && <Check size={16} className="mt-0.5 shrink-0 text-accent" />}
                    {reply.text}
                  </p>
                  {reply.lines && (
                    <ul className="mt-2 space-y-1">
                      {reply.lines.map((l) => (
                        <li key={l}>
                          {reply.ok && reply.text.startsWith("Here are") || !reply.ok ? (
                            <button className="text-left text-sm text-muted hover:text-ink" onClick={() => (setText(l), run(l))}>
                              “{l}”
                            </button>
                          ) : (
                            <span className="text-sm text-muted">• {l}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {reply.link && (
                    <Link href={reply.link.href} onClick={() => setOpen(false)} className="mt-3 inline-flex text-sm font-semibold text-accent">
                      {reply.link.label} →
                    </Link>
                  )}
                </div>
              ) : (
                !text && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {EXAMPLES.slice(0, 4).map((ex) => (
                      <button key={ex} className="chip min-h-9 px-3!" onClick={() => (setText(ex), run(ex))}>
                        {ex}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Text input */}
            <form
              className="mt-4 flex gap-2 border-t border-line p-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(text);
              }}
            >
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask or tell me something…"
                enterKeyHint="send"
                className="w-full rounded-full border border-line bg-bg px-4 py-2.5 text-base outline-none focus:border-accent"
                aria-label="Message"
              />
              <button type="submit" className="btn btn-primary shrink-0 rounded-full! px-3!" disabled={!text.trim() || busy} aria-label="Send">
                <ArrowUp size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
};
const listJoin = (a: string[]) => (a.length <= 1 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
