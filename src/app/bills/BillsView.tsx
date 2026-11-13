"use client";

import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus, ReceiptPoundSterling, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { celebrate } from "@/lib/celebrate";
import { run, useRows } from "@/lib/useRows";
import { addDays, fromISODate, toISODate } from "@/lib/dates";
import { billCategories, dueLabel, frequencyLabel, isOverdue, monthlyEquivalent, nextDate, occurrences, projectByMonth } from "@/lib/bills";
import type { Bill, BillPayment, Frequency } from "@/lib/types";
import { Empty, ErrorNote, Field, Segmented, Sheet, Spinner, StatTile, inputClass, money } from "@/components/ui";
import { BillLogo } from "@/components/BillLogo";

type Tab = "upcoming" | "sheet" | "spending";

export function BillsView() {
  const bills = useRows<Bill>("bills", [{ column: "next_due_date" }]);
  const payments = useRows<BillPayment>("bill_payments", [{ column: "paid_at", ascending: false }]);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [editing, setEditing] = useState<Bill | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = bills.rows.filter((b) => b.is_active);
  const today = toISODate(new Date());

  const stats = useMemo(() => {
    const in7 = addDays(today, 7);
    const monthStart = today.slice(0, 8) + "01";
    const monthly = active.reduce((s, b) => s + monthlyEquivalent(b), 0);
    const dueSoon = active.flatMap((b) => occurrences(b, today, in7).map(() => Number(b.amount))).reduce((s, n) => s + n, 0);
    const overdue = active.filter((b) => isOverdue(b, today));
    const paidThisMonth = payments.rows.filter((p) => p.paid_at.slice(0, 10) >= monthStart).reduce((s, p) => s + Number(p.amount), 0);
    return { monthly, annual: monthly * 12, dueSoon, overdue, paidThisMonth };
  }, [active, payments.rows, today]);

  const markPaid = async (b: Bill) => {
    setBusyId(b.id);
    setError(null);
    const supabase = createClient();
    let msg = await run(() => supabase.from("bill_payments").insert({ bill_id: b.id, due_date: b.next_due_date, amount: b.amount }));
    if (!msg) {
      const next = nextDate(b.next_due_date, b.frequency);
      msg = await run(() =>
        supabase
          .from("bills")
          .update(next ? { next_due_date: next } : { is_active: false })
          .eq("id", b.id),
      );
    }
    if (!msg) celebrate(null, 40);
    setError(msg);
    await Promise.all([bills.reload(), payments.reload()]);
    setBusyId(null);
  };

  const undoLastPayment = async (b: Bill) => {
    const last = payments.rows.find((p) => p.bill_id === b.id);
    if (!last) return;
    setBusyId(b.id);
    const supabase = createClient();
    let msg = await run(() => supabase.from("bills").update({ next_due_date: last.due_date, is_active: true }).eq("id", b.id));
    if (!msg) msg = await run(() => supabase.from("bill_payments").delete().eq("id", last.id));
    setError(msg);
    await Promise.all([bills.reload(), payments.reload()]);
    setBusyId(null);
  };

  if (bills.loading) return <Spinner label="Loading bills" />;

  return (
    <div className="space-y-5">
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div style={{ "--i": 0 } as React.CSSProperties}>
          <StatTile label="Due in next 7 days" value={money(stats.dueSoon)} tone="var(--c-money)" />
        </div>
        <div style={{ "--i": 1 } as React.CSSProperties}>
          <StatTile label="Monthly (average)" value={money(stats.monthly)} />
        </div>
        <div style={{ "--i": 2 } as React.CSSProperties}>
          <StatTile label="Per year" value={money(stats.annual)} />
        </div>
        <div style={{ "--i": 3 } as React.CSSProperties}>
          <StatTile
            label="Overdue"
            value={String(stats.overdue.length)}
            tone={stats.overdue.length ? "#f87171" : undefined}
            sub={`Paid this month: ${money(stats.paidThisMonth)}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "sheet", label: "Spreadsheet" },
            { value: "spending", label: "Spending" },
          ]}
        />
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus size={16} /> Add bill
        </button>
      </div>

      {(error ?? bills.error) && <ErrorNote message={(error ?? bills.error)!} />}

      {bills.rows.length === 0 ? (
        <Empty
          icon={<ReceiptPoundSterling size={36} />}
          title="No bills yet"
          text="Add your rent, council tax, phone, subscriptions and so on. Due dates will appear on your calendar automatically."
          action={
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus size={16} /> Add your first bill
            </button>
          }
        />
      ) : tab === "upcoming" ? (
        <UpcomingList bills={active} busyId={busyId} onPaid={markPaid} onEdit={setEditing} />
      ) : tab === "sheet" ? (
        <SheetView bills={bills.rows} payments={payments.rows} onEdit={setEditing} onUndo={undoLastPayment} busyId={busyId} />
      ) : (
        <Spending bills={active} payments={payments.rows} />
      )}

      <BillForm
        bill={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await bills.reload();
        }}
      />
    </div>
  );
}

/* ---------------- Upcoming ---------------- */

function UpcomingList({ bills, busyId, onPaid, onEdit }: { bills: Bill[]; busyId: string | null; onPaid: (b: Bill) => void; onEdit: (b: Bill) => void }) {
  const today = toISODate(new Date());
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);
  const groups: { title: string; tone?: string; items: Bill[] }[] = [
    { title: "Overdue", tone: "#f87171", items: bills.filter((b) => b.next_due_date < today) },
    { title: "Next 7 days", tone: "var(--c-money)", items: bills.filter((b) => b.next_due_date >= today && b.next_due_date <= in7) },
    { title: "Next 30 days", items: bills.filter((b) => b.next_due_date > in7 && b.next_due_date <= in30) },
    { title: "Later", items: bills.filter((b) => b.next_due_date > in30) },
  ].filter((g) => g.items.length);

  if (!groups.length) return <p className="card p-6 text-sm text-muted">No active bills — everything's paid off or paused.</p>;

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className="mb-2 flex items-center gap-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em]" style={{ color: g.tone ?? "var(--text-faint)" }}>
            {g.title === "Overdue" && <AlertTriangle size={13} />} {g.title}
          </h3>
          <ul className="stagger space-y-2">
            {g.items.map((b, i) => {
              const overdue = isOverdue(b);
              return (
                <li key={b.id} style={{ "--i": i } as React.CSSProperties} className="card flex items-center gap-3 p-3 sm:p-4">
                  <button onClick={() => onEdit(b)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit ${b.name}`}>
                    <BillLogo website={b.website} category={b.category} tone={overdue ? "#f87171" : "var(--c-money)"} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{b.name}</span>
                      <span className={`block truncate text-xs ${overdue ? "text-red-400" : "text-muted"}`}>
                        {dueLabel(b.next_due_date)} · {frequencyLabel[b.frequency]}
                        {b.provider ? ` · ${b.provider}` : ""}
                      </span>
                    </span>
                  </button>
                  <span className="shrink-0 font-display text-base font-semibold tabular-nums">{money(b.amount)}</span>
                  <button
                    onClick={() => onPaid(b)}
                    disabled={busyId === b.id}
                    className="btn btn-ghost shrink-0 px-3! text-xs"
                    aria-label={`Mark ${b.name} as paid`}
                  >
                    {busyId === b.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} className="text-[var(--c-money)]" />}
                    <span className="hidden sm:inline">Paid</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------- Spreadsheet ---------------- */

type SortKey = "name" | "category" | "amount" | "next_due_date" | "monthly";

function SheetView({
  bills,
  payments,
  onEdit,
  onUndo,
  busyId,
}: {
  bills: Bill[];
  payments: BillPayment[];
  onEdit: (b: Bill) => void;
  onUndo: (b: Bill) => void;
  busyId: string | null;
}) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "next_due_date", asc: true });
  const rows = useMemo(() => {
    const val = (b: Bill) => (sort.key === "monthly" ? monthlyEquivalent(b) : sort.key === "amount" ? Number(b.amount) : String(b[sort.key]).toLowerCase());
    return [...bills].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [bills, sort]);

  const lastPaid = (id: string) => payments.find((p) => p.bill_id === id);
  const head = (key: SortKey, label: string, right = false) => (
    <th className={`whitespace-nowrap px-3 py-2.5 font-semibold ${right ? "text-right" : "text-left"}`}>
      <button onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))} className="hover:text-ink">
        {label} {sort.key === key ? (sort.asc ? "↑" : "↓") : ""}
      </button>
    </th>
  );
  const totalMonthly = bills.filter((b) => b.is_active).reduce((s, b) => s + monthlyEquivalent(b), 0);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2.5 text-left font-semibold">
                <button onClick={() => setSort((s) => ({ key: "name", asc: s.key === "name" ? !s.asc : true }))}>Bill {sort.key === "name" ? (sort.asc ? "↑" : "↓") : ""}</button>
              </th>
              {head("category", "Category")}
              {head("amount", "Amount", true)}
              <th className="px-3 py-2.5 text-left font-semibold">How often</th>
              {head("next_due_date", "Next due")}
              {head("monthly", "Per month", true)}
              <th className="px-3 py-2.5 text-left font-semibold">Last paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((b) => {
              const lp = lastPaid(b.id);
              return (
                <tr key={b.id} className={b.is_active ? "" : "opacity-50"}>
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2.5">
                    <button onClick={() => onEdit(b)} className="flex items-center gap-2.5 text-left font-semibold hover:text-accent">
                      <BillLogo website={b.website} category={b.category} tone="var(--c-money)" size={28} />
                      <span>
                        <span className="flex items-center gap-1.5">
                          {b.name} <Pencil size={12} className="text-faint" />
                        </span>
                        {(b.provider || b.account_ref) && (
                          <span className="block text-xs font-normal text-muted">{[b.provider, b.account_ref && `Ref ${b.account_ref}`].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{b.category}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(b.amount)}</td>
                  <td className="px-3 py-2.5 text-muted">{frequencyLabel[b.frequency]}</td>
                  <td className={`px-3 py-2.5 tabular-nums ${isOverdue(b) ? "font-semibold text-red-400" : ""}`}>
                    {b.is_active ? fromISODate(b.next_due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "Finished"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{b.is_active ? money(monthlyEquivalent(b)) : "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {lp ? (
                      <span className="flex items-center gap-1">
                        {new Date(lp.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        <button onClick={() => onUndo(b)} disabled={busyId === b.id} className="grid size-8 place-items-center rounded-full hover:bg-surface-2" aria-label="Undo last payment">
                          <Undo2 size={13} />
                        </button>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-surface-2 text-sm font-semibold">
            <tr>
              <td className="sticky left-0 bg-surface-2 px-3 py-2.5">Total</td>
              <td colSpan={4} />
              <td className="px-3 py-2.5 text-right tabular-nums">{money(totalMonthly)}</td>
              <td className="px-3 py-2.5 text-xs text-muted">{money(totalMonthly * 12)}/yr</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-faint sm:hidden">Swipe sideways to see every column.</p>
    </div>
  );
}

/* ---------------- Spending ---------------- */

function Spending({ bills, payments }: { bills: Bill[]; payments: BillPayment[] }) {
  const months = useMemo(() => projectByMonth(bills, 12), [bills]);
  const max = Math.max(1, ...months.map((m) => m.total));
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bills) map.set(b.category, (map.get(b.category) ?? 0) + monthlyEquivalent(b));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [bills]);
  const catMax = Math.max(1, ...byCategory.map(([, v]) => v));
  const paidByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) map.set(p.paid_at.slice(0, 7), (map.get(p.paid_at.slice(0, 7)) ?? 0) + Number(p.amount));
    return map;
  }, [payments]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className="card p-5">
        <h3 className="text-sm font-semibold">Next 12 months</h3>
        <p className="text-xs text-muted">What your bills will cost each month, based on their schedules.</p>
        <div className="mt-5 flex h-48 items-end gap-1.5 sm:gap-2" role="img" aria-label="Bar chart of bill costs over the next 12 months">
          {months.map((m, i) => (
            <div key={m.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[0.62rem] font-semibold tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">{Math.round(m.total)}</span>
              <div
                className="bar w-full rounded-t-md"
                style={{
                  height: `${Math.max(2, (m.total / max) * 100)}%`,
                  background: i === 0 ? "var(--c-money)" : "color-mix(in srgb, var(--c-money) 45%, transparent)",
                  animationDelay: `${i * 40}ms`,
                }}
                title={`${m.label}: ${money(m.total)}`}
              />
              <span className="text-[0.62rem] text-faint">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
          <span className="text-muted">12-month total</span>
          <span className="font-semibold tabular-nums">{money(months.reduce((s, m) => s + m.total, 0))}</span>
        </div>
        {paidByMonth.size > 0 && (
          <div className="mt-3 flex justify-between text-sm">
            <span className="text-muted">Marked paid this month</span>
            <span className="font-semibold tabular-nums">{money(paidByMonth.get(toISODate(new Date()).slice(0, 7)) ?? 0)}</span>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold">By category</h3>
        <p className="text-xs text-muted">Average per month.</p>
        <ul className="mt-4 space-y-3">
          {byCategory.map(([cat, v]) => (
            <li key={cat}>
              <div className="flex justify-between text-sm">
                <span>{cat}</span>
                <span className="font-semibold tabular-nums">{money(v)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="bar-x h-full rounded-full" style={{ width: `${(v / catMax) * 100}%`, background: "var(--c-money)" }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------------- Add / edit ---------------- */

const frequencies = Object.keys(frequencyLabel) as Frequency[];

function BillForm({ bill, onClose, onSaved }: { bill: Bill | "new" | null; onClose: () => void; onSaved: () => void }) {
  const open = bill !== null;
  const existing = bill && bill !== "new" ? bill : null;
  return (
    <Sheet open={open} title={existing ? "Edit bill" : "Add a bill"} onClose={onClose}>
      {open && <BillFormBody key={existing?.id ?? "new"} existing={existing} onSaved={onSaved} onClose={onClose} />}
    </Sheet>
  );
}

function BillFormBody({ existing, onSaved, onClose }: { existing: Bill | null; onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [provider, setProvider] = useState(existing?.provider ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? "monthly");
  const [due, setDue] = useState(existing?.next_due_date ?? toISODate(new Date()));
  const [category, setCategory] = useState(existing?.category ?? "Other");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [accountRef, setAccountRef] = useState(existing?.account_ref ?? "");
  const [website, setWebsite] = useState(existing?.website ?? "");
  const [active, setActive] = useState(existing?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(/[£,\s]/g, ""));
    if (!Number.isFinite(value) || value < 0) return setError("Enter the amount as a number, e.g. 45.99");
    setBusy(true);
    const row = {
      name: name.trim(),
      provider: provider.trim() || null,
      amount: value,
      frequency,
      next_due_date: due,
      category,
      notes: notes.trim() || null,
      account_ref: accountRef.trim() || null,
      website:
        website
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0] || null,
      is_active: active,
    };
    const supabase = createClient();
    const msg = existing ? await run(() => supabase.from("bills").update(row).eq("id", existing.id)) : await run(() => supabase.from("bills").insert(row));
    setBusy(false);
    if (msg) setError(msg);
    else onSaved();
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    const msg = await run(() => createClient().from("bills").delete().eq("id", existing.id));
    setBusy(false);
    if (msg) setError(msg);
    else onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="What is it?">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Council tax" required maxLength={120} autoFocus={!existing} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (£)">
          <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" required />
        </Field>
        <Field label="How often">
          <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {frequencies.map((f) => (
              <option key={f} value={f}>
                {frequencyLabel[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={existing ? "Next due date" : "Next payment date"}>
          <input type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} required />
        </Field>
        <Field label="Category">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {billCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Provider (optional)">
        <input className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Octopus Energy" maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account / reference no.">
          <input className={inputClass} value={accountRef} onChange={(e) => setAccountRef(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Company website (for logo)">
          <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} inputMode="url" placeholder="e.g. eonnext.com" />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <textarea className={`${inputClass} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {existing && (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (untick to pause or finish this bill)
        </label>
      )}
      {error && <ErrorNote message={error} />}
      <div className="flex gap-2 pt-1">
        {existing &&
          (confirmDelete ? (
            <button type="button" onClick={remove} disabled={busy} className="btn bg-red-500/15 text-red-400">
              <Trash2 size={16} /> Delete for good
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-ghost" aria-label="Delete bill">
              <Trash2 size={16} />
            </button>
          ))}
        <button type="button" onClick={onClose} className="btn btn-ghost ml-auto">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy && <Loader2 size={16} className="animate-spin" />} Save
        </button>
      </div>
    </form>
  );
}
