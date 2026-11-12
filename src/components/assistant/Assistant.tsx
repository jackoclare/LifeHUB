"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Mic, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { currentPosition } from "@/app/map/MapHub";
import { askAi } from "@/app/ai/AiChat";
import { createClient } from "@/lib/supabase/client";
import { type Intent, parse } from "@/lib/assistant";
import { guessAisle } from "@/app/shopping/ShoppingView";
import { DEFAULT_TEAMS, kickoffLabel, loadTeam } from "@/lib/football";
import { readPlace, describe } from "@/lib/weather";
import { dueLabel, isOverdue, monthlyEquivalent } from "@/lib/bills";
import { addDays, formatDay, toISODate } from "@/lib/dates";
import type { Bill } from "@/lib/types";

type Reply = { text: string; ok: boolean; link?: { href: string; label: string }; lines?: string[] };

const EXAMPLES = ["Add milk and 2 loaves of bread to the shopping list", "Dentist Friday at 3pm", "Remind me to call mum tomorrow at 6pm", "When's the next Villa game?", "What bills are due this week?", "Where's the cheapest diesel?", "Take me to Tesco Extra", "Show me the weather"];

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
  const heardRef = useRef("");
  const [hint, setHint] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  const [showVoices, setShowVoices] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    // iPhone Home Screen apps can't use speech recognition (Apple blocks it) — use keyboard dictation there
    const iosStandalone = /iP(hone|ad|od)/.test(navigator.userAgent) && ((navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches);
    setCanListen(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition) && !iosStandalone);
    const load = () => {
      if (!("speechSynthesis" in window)) return;
      const all = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
      // best first: UK, then enhanced/premium quality, then name
      const q = (v: SpeechSynthesisVoice) => (/premium/i.test(v.name) ? 0 : /enhanced|natural|neural/i.test(v.name) ? 1 : 2);
      all.sort((a, b) => Number(b.lang === "en-GB") - Number(a.lang === "en-GB") || q(a) - q(b) || a.name.localeCompare(b.name));
      setVoices(all);
    };
    load();
    if ("speechSynthesis" in window) window.speechSynthesis.addEventListener?.("voiceschanged", load);
    try {
      setVoiceName(localStorage.getItem("mlh.assistant.voice") ?? "");
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
      const all = window.speechSynthesis.getVoices();
      const q = (v: SpeechSynthesisVoice) => (/premium/i.test(v.name) ? 0 : /enhanced|natural|neural/i.test(v.name) ? 1 : 2);
      const voice =
        all.find((v) => v.name === voiceName) ?? [...all].filter((v) => v.lang === "en-GB").sort((a, b) => q(a) - q(b))[0];
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      window.speechSynthesis.speak(u);
    },
    [speak, voiceName],
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
          case "directions": {
            const pos = intent.from ? (readPlace() ?? { lat: 52.6, lon: -1.6 }) : await currentPosition(readPlace());
            if (!pos) return respond({ ok: false, text: "I need your location — allow location access and ask again." });
            const params: Record<string, string> = { q: intent.dest, lat: String(pos.lat), lon: String(pos.lon) };
            if (intent.from) params.from = intent.from;
            const r = await fetch(`/api/route?${new URLSearchParams(params)}`).then((x) => x.json());
            const mapUrl = `/map?go=${encodeURIComponent(intent.dest)}${intent.from ? `&from=${encodeURIComponent(intent.from)}` : ""}`;
            if (r.error) return respond({ ok: false, text: r.error });
            const time = r.minutes == null ? null : r.minutes >= 60 ? `${Math.floor(r.minutes / 60)} hour${r.minutes >= 120 ? "s" : ""} ${r.minutes % 60} minutes` : `${r.minutes} minutes`;
            respond({
              ok: true,
              text: `${r.start ? `From ${r.start.name}, ` : ""}${r.dest.name}${r.dest.address ? `, ${r.dest.address.split(",")[0]}` : ""} is ${time ? `about ${time} away` : `${r.miles} miles away`} — ${r.miles} miles. Here's the route.`,
              link: { href: mapUrl, label: "Show on map" },
            });
            router.push(mapUrl);
            setTimeout(() => setOpen(false), 2500);
            break;
          }
          case "carDue": {
            const { data } = await supabase.from("vehicles").select("make,model,nickname,reg,mot_due,tax_due,insurance_due,service_due");
            if (!data?.length) return respond({ ok: false, text: "You haven't added a vehicle yet.", link: { href: "/car", label: "Add your car" } });
            const labels = { mot: ["mot_due", "MOT"], tax: ["tax_due", "road tax"], insurance: ["insurance_due", "insurance"], service: ["service_due", "service"] } as const;
            const keys = intent.what === "all" ? (["mot", "tax", "insurance", "service"] as const) : ([intent.what] as const);
            const fmt = (iso: string) => {
              const d = Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(new Date().toDateString() + " 12:00").getTime()) / 864e5);
              return `${new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} (${d < 0 ? `${-d} days overdue` : d === 0 ? "today" : `in ${d} days`})`;
            };
            const lines: string[] = [];
            for (const v of data) {
              const name = v.nickname || `${v.make} ${v.model ?? ""}`.trim();
              for (const k of keys) {
                const [col, label] = labels[k];
                const iso = (v as Record<string, string | null>)[col];
                lines.push(iso ? `${name}: ${label} ${fmt(iso)}` : `${name}: no ${label} date saved`);
              }
            }
            respond({ ok: true, text: lines[0] + (lines.length > 1 ? "" : "."), lines: lines.length > 1 ? lines : undefined, link: { href: "/car", label: "Open Car" } });
            break;
          }
          case "findDoc": {
            const words = intent.q.split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "for"].includes(w));
            const { data } = await supabase.from("documents").select("id,title,category,expires_on,notes");
            const hits = (data ?? []).filter((d) => words.some((w) => `${d.title} ${d.category} ${d.notes ?? ""}`.toLowerCase().includes(w.toLowerCase())));
            if (!hits.length) return respond({ ok: false, text: `I couldn't find "${intent.q}" in your documents.`, link: { href: "/documents", label: "Open documents" } });
            const exp = hits.find((d) => d.expires_on);
            respond({
              ok: true,
              text: exp
                ? `${exp.title} expires on ${new Date(`${exp.expires_on}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
                : `I found ${hits.length === 1 ? `"${hits[0].title}"` : `${hits.length} documents`}.`,
              lines: hits.length > 1 ? hits.slice(0, 5).map((d) => d.title) : undefined,
              link: { href: "/documents", label: "Open documents" },
            });
            break;
          }
          case "fuel": {
            const place = readPlace();
            if (!place) return respond({ ok: false, text: "Set your location first, then ask me again.", link: { href: "/fuel", label: "Set location" } });
            const { data } = await supabase.rpc("nearby_fuel", { p_lat: place.lat, p_lon: place.lon, p_radius_km: 16, p_fuel: intent.fuel });
            const list = (data ?? []) as { name: string; brand: string | null; address: string | null; price: number; distance_km: number }[];
            const label = intent.fuel === "B7_Standard" ? "diesel" : intent.fuel === "E5" ? "super unleaded" : "unleaded";
            if (!list.length) return respond({ ok: false, text: `I couldn't find ${label} prices within 10 miles.`, link: { href: "/fuel", label: "Open fuel map" } });
            const top = list.slice(0, 3);
            const miles = (km: number) => `${(km * 0.621371).toFixed(1)} miles`;
            respond({
              ok: true,
              text: `Cheapest ${label} near you is ${Number(top[0].price).toFixed(1)}p at ${top[0].brand ?? top[0].name}, ${miles(top[0].distance_km)} away.`,
              lines: top.map((s) => `${Number(s.price).toFixed(1)}p — ${s.brand ?? s.name} · ${miles(s.distance_km)}`),
              link: { href: "/fuel", label: "Open fuel map" },
            });
            break;
          }
          case "help":
            respond({ ok: true, text: "Here are some things you can ask me.", lines: EXAMPLES });
            break;
          default: {
            // Anything the built-in commands don't cover goes to ChatGPT
            const r = await askAi({ mode: "chat", messages: [{ role: "user", text: q }] });
            if (r.error) respond({ ok: false, text: /switched on|connected/.test(r.error) ? "Sorry, I didn't get that. Try one of these:" : r.error, lines: EXAMPLES.slice(0, 4) });
            else respond({ ok: true, text: r.text ?? "", link: { href: "/ai", label: "Continue in AI chat" } });
          }
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
    if (!Rec || !canListen) {
      primeSpeech();
      setHint("Tap the 🎤 on your keyboard and speak — then press Send.");
      inputRef.current?.focus();
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    primeSpeech();
    setHint(null);
    const rec = new Rec();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    finalRef.current = "";
    heardRef.current = "";
    rec.onresult = (e: SR) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      heardRef.current = (finalRef.current + interim).trim();
      setText(heardRef.current);
    };
    rec.onerror = (e: SR) => {
      setListening(false);
      const code = String(e?.error ?? "");
      if (code === "no-speech" || code === "aborted") setHint("I didn't hear anything — tap the mic and try again.");
      else if (code === "not-allowed" || code === "service-not-allowed")
        setHint("The microphone is blocked here. On iPhone: Settings → Apps → Safari → Microphone → Allow, or type below and use the 🎤 on your keyboard.");
      else if (code === "network") setHint("Speech recognition needs an internet connection — try again, or type below.");
      else setHint("Voice didn't work that time — type below, or use the 🎤 on your keyboard.");
    };
    rec.onend = () => {
      setListening(false);
      // Safari often ends without marking a result as final, so fall back to everything heard
      const said = (finalRef.current.trim() || heardRef.current).trim();
      if (said) run(said);
    };
    recRef.current = rec;
    setReply(null);
    setText("");
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setHint("Voice isn't available here — type below, or use the 🎤 on your keyboard.");
    }
  };

  // Close on Escape
  // Other parts of the app (e.g. the Home search bar) can open the assistant
  useEffect(() => {
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<string | undefined>).detail;
      setOpen(true);
      if (q) setText(q);
      setTimeout(() => inputRef.current?.focus(), 250);
    };
    window.addEventListener("lifehub-assistant", onOpen);
    return () => window.removeEventListener("lifehub-assistant", onOpen);
  }, []);

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
                <Sparkles size={16} className="text-accent" /> LifeHub assistant
              </p>
              <div className="flex gap-1">
                <button
                  className={`h-10 rounded-full px-3 text-xs font-semibold ${showVoices ? "bg-accent text-white" : "text-faint hover:text-ink"}`}
                  onClick={() => setShowVoices((v) => !v)}
                  aria-expanded={showVoices}
                >
                  Voice
                </button>
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

            {showVoices && (
              <div className="mx-5 mt-3 rounded-2xl bg-surface-2 p-3">
                <p className="mb-2 text-xs text-muted">Pick a voice — tap one to hear it.</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {voices.length === 0 && <li className="text-sm text-muted">No voices found on this device.</li>}
                  {voices.map((v) => (
                    <li key={v.voiceURI}>
                      <button
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${voiceName === v.name ? "bg-accent text-white" : "hover:bg-bg"}`}
                        onClick={() => {
                          setVoiceName(v.name);
                          try {
                            localStorage.setItem("mlh.assistant.voice", v.name);
                          } catch {
                            /* ignore */
                          }
                          window.speechSynthesis.cancel();
                          const u = new SpeechSynthesisUtterance("Hi Jack, this is how I'll sound.");
                          u.voice = v;
                          u.lang = v.lang;
                          window.speechSynthesis.speak(u);
                        }}
                      >
                        <span className="truncate">{v.name}</span>
                        <span className="ml-2 shrink-0 text-xs opacity-70">{v.lang.replace("en-", "")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-snug text-faint">
                  Want a more natural voice? On iPhone: Settings → Accessibility → Read &amp; Speak (or Spoken Content) → Voices → English → download an
                  &ldquo;Enhanced&rdquo; or &ldquo;Premium&rdquo; voice, then reopen the app and pick it here.
                </p>
              </div>
            )}

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
                {listening ? "Listening… tap again when you've finished" : busy ? "Working on it…" : hint ? hint : canListen ? "Tap the mic and speak" : "Type below — or tap the 🎤 on your keyboard to speak"}
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
                      <button key={ex} className="chip min-h-9 px-3!" onClick={() => (primeSpeech(), setText(ex), run(ex))}>
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
                primeSpeech();
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

// iOS only lets a page speak if speech was started inside a tap — speak a silent utterance on tap to unlock it
function primeSpeech() {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
