"use client";

import { Brain, Flame, Loader2, Share2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { askAi } from "@/app/ai/AiChat";
import { updatePrefs, usePrefs, type QuizState } from "@/lib/prefs";
import { celebrate } from "@/lib/celebrate";
import { Mascot } from "@/components/Mascot";

/** Daily pub quiz: five fresh questions a day (football, Villa, general knowledge), a streak for every day you play. */

const ukDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
const yesterday = () => ukDay(new Date(Date.now() - 86400e3));

export function QuizView() {
  const { quiz } = usePrefs();
  const today = ukDay();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fresh = quiz?.date === today ? quiz : null;

  const load = async () => {
    setBusy(true);
    setErr(null);
    const r = (await askAi({ mode: "quiz", date: today })) as { error?: string; questions?: QuizState["questions"] };
    setBusy(false);
    if (r.error || !r.questions?.length) return setErr(r.error ?? "Couldn't make today's quiz — try again.");
    const keep = quiz ?? { streak: 0, lastDone: null, best: 0, played: 0 };
    // a missed day resets the streak
    const streak = keep.lastDone === yesterday() || keep.lastDone === today ? keep.streak : 0;
    updatePrefs({ quiz: { ...keep, streak, date: today, questions: r.questions, picks: r.questions.map(() => null) } as QuizState });
  };

  useEffect(() => {
    if (!fresh && !busy) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh?.date]);

  if (!fresh) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        {busy ? <Loader2 className="animate-spin text-[#00e5ff]" /> : <Brain className="text-[#b15cff]" />}
        <p className="text-sm text-muted">{busy ? "Writing today's questions…" : err ?? ""}</p>
        {err && (
          <button className="btn btn-primary" onClick={load}>
            Try again
          </button>
        )}
      </div>
    );
  }

  const answered = fresh.picks.filter((p) => p != null).length;
  const score = fresh.picks.reduce<number>((n, p, i) => n + (p === fresh.questions[i].answer ? 1 : 0), 0);
  const finished = answered === fresh.questions.length;

  const pick = (qi: number, oi: number, el: Element) => {
    if (fresh.picks[qi] != null) return;
    const picks = fresh.picks.map((p, i) => (i === qi ? oi : p));
    const right = oi === fresh.questions[qi].answer;
    if (right) celebrate(el, 16);
    else navigator.vibrate?.(60);
    const done = picks.every((p) => p != null);
    const streak = done && fresh.lastDone !== today ? fresh.streak + 1 : fresh.streak;
    updatePrefs({
      quiz: { ...fresh, picks, ...(done ? { lastDone: today, streak, best: Math.max(fresh.best, streak), played: fresh.played + (fresh.lastDone === today ? 0 : 1) } : {}) },
    });
  };

  const share = async () => {
    const grid = fresh.picks.map((p, i) => (p === fresh.questions[i].answer ? "🟩" : "🟥")).join("");
    const text = `LifeHub daily quiz ${today.slice(8)}/${today.slice(5, 7)}: ${score}/${fresh.questions.length} ${grid} 🔥${fresh.streak}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="neon-panel flex items-center gap-4 rounded-[1.9rem] p-5" style={{ "--tile": "#b15cff" } as React.CSSProperties}>
        <Mascot mood={finished ? (score >= 4 ? "party" : score <= 1 ? "gutted" : "happy") : "happy"} size={64} />
        <div className="flex-1">
          <p className="neon-number font-display text-3xl font-bold tabular-nums">
            {score}/{fresh.questions.length}
          </p>
          <p className="text-sm text-muted">{finished ? (score === 5 ? "Perfect! Pub legend 🏆" : score >= 3 ? "Solid effort" : "Tough one — back tomorrow") : `${answered} of ${fresh.questions.length} answered`}</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 font-display text-2xl font-bold text-[#ffb020]">
            <Flame size={20} /> {fresh.streak}
          </p>
          <p className="flex items-center justify-end gap-1 text-[0.68rem] text-faint">
            <Trophy size={11} /> best {fresh.best}
          </p>
        </div>
      </section>

      {fresh.questions.map((q, qi) => {
        const p = fresh.picks[qi];
        return (
          <section key={qi} className="card p-4">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#b15cff]">
              Q{qi + 1} · {q.topic}
            </p>
            <p className="mt-1 font-display text-lg font-semibold leading-snug">{q.q}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                const state = p == null ? "" : oi === q.answer ? "quiz-right" : oi === p ? "quiz-wrong" : "opacity-50";
                return (
                  <button key={oi} disabled={p != null} onClick={(e) => pick(qi, oi, e.currentTarget)} className={`quiz-opt rounded-2xl px-4 py-3 text-left text-[0.95rem] font-medium ${state}`}>
                    {o}
                  </button>
                );
              })}
            </div>
            {p != null && <p className="mt-2 text-sm text-muted">{p === q.answer ? "✅ " : "❌ "}{q.explain}</p>}
          </section>
        );
      })}

      {finished && (
        <button className="btn btn-primary w-full" onClick={share}>
          <Share2 size={17} /> Share my score
        </button>
      )}
      <p className="text-center text-xs text-faint">Questions are written by the free AI each day — very occasionally one might be wrong.</p>
    </div>
  );
}
