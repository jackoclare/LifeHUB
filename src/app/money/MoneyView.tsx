"use client";

import { Calculator, PiggyBank, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { ErrorNote, Field, Sheet, inputClass } from "@/components/ui";
import { monthlyEquivalent, occurrences } from "@/lib/bills";
import { BillLogo } from "@/components/BillLogo";
import { createClient } from "@/lib/supabase/client";
import type { Bill } from "@/lib/types";
import { useRows } from "@/lib/useRows";

type Goal = { id: string; name: string; emoji: string | null; target: number; saved: number; target_date: string | null };
const gbp = (n: number, dp = 0) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: dp, minimumFractionDigits: dp }).format(n);

export function MoneyView() {
  const { user, loading } = useAuth();
  const bills = useRows<Bill>("bills", [{ column: "next_due_date" }], Boolean(user));
  const goals = useRows<Goal>("savings_goals", [{ column: "created_at" }], Boolean(user));
  const [income, setIncome] = useState<number | null>(null);
  const [payday, setPayday] = useState<number | null>(null);
  const [paydayDraft, setPaydayDraft] = useState("");
  const [incomeDraft, setIncomeDraft] = useState("");
  const [editingIncome, setEditingIncome] = useState(false);
  const [goalEdit, setGoalEdit] = useState<Partial<Goal> | null>(null);
  const [topUp, setTopUp] = useState<Goal | null>(null);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from("finance_profile")
      .select("monthly_income,payday")
      .maybeSingle()
      .then(({ data }) => {
        setIncome(data?.monthly_income != null ? Number(data.monthly_income) : null);
        setPayday(data?.payday ?? null);
      });
  }, [user]);

  const active = bills.rows.filter((b) => b.is_active);
  const monthlyBills = useMemo(() => active.reduce((s, b) => s + monthlyEquivalent(b), 0), [active]);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of active) m.set(b.category, (m.get(b.category) ?? 0) + monthlyEquivalent(b));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const subs = active.filter((b) => /subscri|stream|netflix|spotify|disney|prime|apple|sky|gym|phone|broadband/i.test(`${b.category} ${b.name}`));
  const left = income != null ? income - monthlyBills : null;

  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to see your money." />;

  const saveIncome = async () => {
    const v = incomeDraft ? Number(incomeDraft.replace(/[£,]/g, "")) : null;
    const pd = paydayDraft ? Math.min(31, Math.max(1, Number(paydayDraft))) : null;
    await createClient().from("finance_profile").upsert({ monthly_income: v, payday: pd, updated_at: new Date().toISOString() });
    setIncome(v);
    setPayday(pd);
    setEditingIncome(false);
  };

  return (
    <div className="space-y-4">
      {/* Headline: bills this month + payday */}
      <section className="overflow-hidden rounded-[1.9rem] p-5 text-white shadow-[0_18px_40px_-20px_rgb(201_31_75/0.7)]" style={{ background: "linear-gradient(150deg, #d7264f 0%, #a3123a 100%)" }}>
        <p className="text-sm text-white/80">Going out this month</p>
        <p className="num-in mt-1 font-display text-[2.6rem] font-bold leading-none tabular-nums">{gbp(monthlyBills, 2)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {payday && (
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
              💷 Payday {(() => {
                const t = new Date();
                let p = new Date(t.getFullYear(), t.getMonth(), Math.min(payday, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
                if (p < new Date(t.toDateString())) p = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(payday, new Date(t.getFullYear(), t.getMonth() + 2, 0).getDate()));
                const d = Math.round((p.getTime() - new Date(t.toDateString()).getTime()) / 864e5);
                return d === 0 ? "today 🎉" : `in ${d} day${d === 1 ? "" : "s"}`;
              })()}
            </span>
          )}
          {left != null && <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">{left >= 0 ? `${gbp(left)} left after bills` : `${gbp(-left)} short`}</span>}
          {!payday && (
            <button className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold" onClick={() => (setIncomeDraft(income?.toString() ?? ""), setPaydayDraft(""), setEditingIncome(true))}>
              + Add payday
            </button>
          )}
        </div>
      </section>

      <UpcomingWeek bills={active} />

      {/* Monthly overview */}
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">This month</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <button className="rounded-2xl bg-surface-2 p-3" onClick={() => (setIncomeDraft(income?.toString() ?? ""), setPaydayDraft(payday?.toString() ?? ""), setEditingIncome(true))}>
            <p className="text-xs text-muted">Income</p>
            <p className="num-in font-display text-xl font-bold tabular-nums">{income != null ? gbp(income) : "Add"}</p>
          </button>
          <Link href="/bills" className="rounded-2xl bg-surface-2 p-3">
            <p className="text-xs text-muted">Bills</p>
            <p className="num-in font-display text-xl font-bold tabular-nums">{gbp(monthlyBills)}</p>
          </Link>
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="text-xs text-muted">Left over</p>
            <p className="num-in font-display text-xl font-bold tabular-nums" style={{ color: left == null ? undefined : left >= 0 ? "var(--c-money)" : "#ff3b30" }}>
              {left != null ? gbp(left) : "–"}
            </p>
          </div>
        </div>
        {income != null && monthlyBills > 0 && (
          <div className="mt-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
              <div className="bar-x h-full bg-[var(--c-shop)]" style={{ width: `${Math.min(100, (monthlyBills / Math.max(income, 1)) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">Bills take {Math.round((monthlyBills / Math.max(income, 1)) * 100)}% of your income.</p>
          </div>
        )}
        {byCat.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {byCat.slice(0, 6).map(([cat, v]) => (
              <li key={cat} className="flex items-center justify-between text-sm">
                <span className="capitalize">{cat}</span>
                <span className="tabular-nums text-muted">{gbp(v, 2)}/mo</span>
              </li>
            ))}
          </ul>
        )}
        {subs.length > 0 && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs text-muted">Subscriptions and contracts: {subs.map((b) => b.name).join(", ")} — {gbp(subs.reduce((s, b) => s + monthlyEquivalent(b), 0), 2)} a month.</p>}
      </section>

      {/* Savings goals */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <PiggyBank size={18} className="text-[var(--c-money)]" /> Savings goals
          </h2>
          <button className="text-sm font-semibold text-accent" onClick={() => setGoalEdit({})}>
            <Plus size={14} className="mr-0.5 inline" /> New
          </button>
        </div>
        {goals.rows.length === 0 ? (
          <p className="text-sm text-muted">Saving for a holiday, a car or Christmas? Add a goal and track it here.</p>
        ) : (
          <ul className="space-y-4">
            {goals.rows.map((g) => {
              const pct = Math.min(100, (Number(g.saved) / Number(g.target)) * 100);
              const monthsLeft = g.target_date ? Math.max(1, Math.round((new Date(g.target_date).getTime() - Date.now()) / (30.4 * 864e5))) : null;
              const perMonth = monthsLeft ? Math.max(0, (Number(g.target) - Number(g.saved)) / monthsLeft) : null;
              return (
                <li key={g.id}>
                  <button className="w-full text-left" onClick={() => setTopUp(g)}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">
                        {g.emoji ?? "🎯"} {g.name}
                      </span>
                      <span className="text-sm tabular-nums text-muted">
                        {gbp(Number(g.saved))} / {gbp(Number(g.target))}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="bar-x h-full rounded-full bg-[var(--c-money)]" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {pct >= 100 ? "🎉 Reached!" : `${Math.round(pct)}%`}
                      {perMonth != null && pct < 100 ? ` · save ${gbp(perMonth)} a month to hit it by ${new Date(g.target_date!).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LoanCalculator />

      <Sheet open={editingIncome} title="Monthly take-home pay" onClose={() => setEditingIncome(false)}>
        <Field label="After tax, per month (£)">
          <input autoFocus className={inputClass} inputMode="decimal" value={incomeDraft} onChange={(e) => setIncomeDraft(e.target.value)} placeholder="e.g. 2200" />
        </Field>
        <Field label="Payday (day of the month)" className="mt-3">
          <input className={inputClass} inputMode="numeric" value={paydayDraft} onChange={(e) => setPaydayDraft(e.target.value)} placeholder="e.g. 28" />
        </Field>
        <p className="mt-2 text-xs text-muted">Only you can see this. It&apos;s used to work out what&apos;s left after bills and count down to payday.</p>
        <button className="btn btn-primary mt-4 w-full" onClick={saveIncome}>
          Save
        </button>
      </Sheet>
      <GoalSheet value={goalEdit} onClose={() => setGoalEdit(null)} onSaved={goals.reload} />
      <TopUpSheet goal={topUp} onClose={() => setTopUp(null)} onSaved={goals.reload} onEdit={(g) => (setTopUp(null), setGoalEdit(g))} />
    </div>
  );
}

function GoalSheet({ value, onClose, onSaved }: { value: Partial<Goal> | null; onClose: () => void; onSaved: () => void }) {
  const [g, setG] = useState<Partial<Goal>>({});
  const [err, setErr] = useState<string | null>(null);
  const [k, setK] = useState("");
  const key = value ? (value.id ?? "new") : "";
  if (key !== k) {
    setK(key);
    setG(value ?? {});
    setErr(null);
  }
  const save = async () => {
    if (!g.name?.trim() || !g.target) return setErr("Add a name and a target amount");
    const row = { name: g.name.trim(), emoji: g.emoji || null, target: Number(g.target), saved: Number(g.saved ?? 0), target_date: g.target_date || null };
    const sb = createClient();
    const { error } = g.id ? await sb.from("savings_goals").update(row).eq("id", g.id) : await sb.from("savings_goals").insert(row);
    if (error) return setErr(error.message);
    onSaved();
    onClose();
  };
  const remove = async () => {
    if (!g.id || !confirm("Delete this goal?")) return;
    await createClient().from("savings_goals").delete().eq("id", g.id);
    onSaved();
    onClose();
  };
  return (
    <Sheet open={value !== null} title={g.id ? "Edit goal" : "New savings goal"} onClose={onClose}>
      <div className="grid grid-cols-[4rem_1fr] gap-3">
        <Field label="Emoji">
          <input className={`${inputClass} text-center`} value={g.emoji ?? ""} onChange={(e) => setG({ ...g, emoji: e.target.value.slice(0, 4) })} placeholder="✈️" />
        </Field>
        <Field label="What for?">
          <input className={inputClass} value={g.name ?? ""} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Holiday to Spain" />
        </Field>
        <Field label="Target (£)" className="col-span-2">
          <input className={inputClass} inputMode="decimal" value={g.target ?? ""} onChange={(e) => setG({ ...g, target: Number(e.target.value) || undefined })} />
        </Field>
        <Field label="Saved so far (£)">
          <input className={inputClass} inputMode="decimal" value={g.saved ?? ""} onChange={(e) => setG({ ...g, saved: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="By when?">
          <input type="date" className={inputClass} value={g.target_date ?? ""} onChange={(e) => setG({ ...g, target_date: e.target.value })} />
        </Field>
      </div>
      {err && <ErrorNote message={err} />}
      <div className="mt-4 flex gap-2">
        {g.id && (
          <button className="btn btn-ghost text-red-500!" onClick={remove} aria-label="Delete goal">
            <Trash2 size={16} />
          </button>
        )}
        <button className="btn btn-primary flex-1" onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  );
}

function TopUpSheet({ goal, onClose, onSaved, onEdit }: { goal: Goal | null; onClose: () => void; onSaved: () => void; onEdit: (g: Goal) => void }) {
  const [amt, setAmt] = useState("");
  const apply = async (sign: 1 | -1) => {
    if (!goal || !amt) return;
    const saved = Math.max(0, Number(goal.saved) + sign * Number(amt));
    await createClient().from("savings_goals").update({ saved }).eq("id", goal.id);
    setAmt("");
    onSaved();
    onClose();
  };
  return (
    <Sheet open={!!goal} title={goal ? `${goal.emoji ?? "🎯"} ${goal.name}` : ""} onClose={onClose}>
      <Field label="Amount (£)">
        <input autoFocus className={inputClass} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
      </Field>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn btn-ghost" onClick={() => apply(-1)} disabled={!amt}>
          Take out
        </button>
        <button className="btn btn-primary" onClick={() => apply(1)} disabled={!amt}>
          Add to pot
        </button>
      </div>
      {goal && (
        <button className="mt-3 w-full text-sm font-semibold text-accent" onClick={() => onEdit(goal)}>
          Edit goal
        </button>
      )}
    </Sheet>
  );
}

/** Loan / mortgage repayment calculator (standard amortisation formula) */
function LoanCalculator() {
  const [kind, setKind] = useState<"loan" | "mortgage">("loan");
  const [amount, setAmount] = useState("10000");
  const [rate, setRate] = useState("7.9");
  const [years, setYears] = useState("5");
  const P = Number(amount) || 0;
  const r = (Number(rate) || 0) / 100 / 12;
  const n = Math.round((Number(years) || 0) * 12);
  const monthly = n > 0 ? (r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n) : 0;
  const total = monthly * n;
  return (
    <section className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Calculator size={18} className="text-accent" /> Repayment calculator
      </h2>
      <div className="mb-3 flex rounded-full bg-surface-2 p-1">
        {(["loan", "mortgage"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              if (k === "mortgage") {
                setAmount("180000");
                setRate("4.5");
                setYears("25");
              } else {
                setAmount("10000");
                setRate("7.9");
                setYears("5");
              }
            }}
            className={`min-h-9 flex-1 rounded-full text-sm font-semibold capitalize ${kind === k ? "bg-surface shadow-[var(--shadow)]" : "text-muted"}`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Amount (£)">
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Rate (APR %)">
          <input className={inputClass} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="Years">
          <input className={inputClass} inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Monthly</p>
          <p className="font-display text-2xl font-bold tabular-nums">{gbp(monthly, 2)}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Total interest</p>
          <p className="font-display text-2xl font-bold tabular-nums">{gbp(Math.max(0, total - P))}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-faint">A guide only, using a fixed rate for the whole term. Real offers vary — I&apos;m not a financial adviser, so check the lender&apos;s figures before you commit.</p>
    </section>
  );
}

/** Next 7 days with the bills landing on each one (like a bank app's "Upcoming") */
function UpcomingWeek({ bills }: { bills: Bill[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("en-CA");
  });
  const due = days.map((iso) => ({ iso, items: bills.filter((b) => occurrences(b, iso, iso, 60).length > 0) }));
  const all = due.flatMap((d) => d.items);
  const total = all.reduce((s, b) => s + Number(b.amount), 0);
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Upcoming</h2>
          <p className="mt-0.5 text-sm text-muted">
            {all.length ? `You have ${all.length} bill${all.length > 1 ? "s" : ""} due in the next 7 days for ${gbp(total, 2)}.` : "Nothing due in the next 7 days."}
          </p>
        </div>
        <Link href="/bills" className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-semibold">
          See all
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {due.map(({ iso, items }, i) => {
          const d = new Date(`${iso}T12:00:00`);
          return (
            <Link key={iso} href="/bills" className="flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors active:bg-surface-2">
              <span className={`text-xs ${i === 0 ? "font-bold text-[#d7264f]" : "text-muted"}`}>{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
              <span className={`text-lg font-bold ${i === 0 ? "text-[#d7264f]" : ""}`}>{d.getDate()}</span>
              <span className="flex min-h-8 flex-col items-center -space-y-2">
                {items.slice(0, 3).map((b) => (
                  <span key={b.id} className="rounded-full ring-2 ring-[var(--surface)]">
                    <BillLogo website={b.website} category={b.category} tone="var(--c-money)" size={22} />
                  </span>
                ))}
              </span>
              {items.length > 0 && <span className="rounded-md bg-[var(--accent-soft)] px-1 text-[10px] font-semibold tabular-nums">{gbp(items.reduce((s, b) => s + Number(b.amount), 0))}</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
