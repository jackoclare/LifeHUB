"use client";

import { FileUp, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorNote, Sheet } from "@/components/ui";
import { CATEGORIES, CAT_EMOJI, type Txn, dedupeKey, parseCsv, parsePdfLines } from "@/lib/statement";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string; posted_on: string; description: string; amount: number; category: string; account: string };
const gbp = (n: number, dp = 2) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
const ym = (iso: string) => iso.slice(0, 7);

/** Bank statements → spending by category (upload PDF or CSV; nothing is linked to your bank) */
export function Spending() {
  const [rows, setRows] = useState<Row[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [cat, setCat] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().from("transactions").select("id,posted_on,description,amount,category,account").gte("posted_on", new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10)).order("posted_on", { ascending: false }).limit(3000);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const months = useMemo(() => [...new Set(rows.map((r) => ym(r.posted_on)))].sort().reverse(), [rows]);
  const m = month ?? months[0] ?? null;
  const inMonth = rows.filter((r) => m && ym(r.posted_on) === m);
  const spend = inMonth.filter((r) => r.amount < 0 && r.category !== "transfers");
  const totalOut = spend.reduce((s, r) => s + -Number(r.amount), 0);
  const totalIn = inMonth.filter((r) => r.amount > 0 && r.category !== "transfers").reduce((s, r) => s + Number(r.amount), 0);
  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of spend) map.set(r.category, (map.get(r.category) ?? 0) - Number(r.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [spend]);
  const prevMonth = months[months.indexOf(m ?? "") + 1];
  const prevOut = prevMonth ? rows.filter((r) => ym(r.posted_on) === prevMonth && r.amount < 0 && r.category !== "transfers").reduce((s, r) => s - Number(r.amount), 0) : null;
  const list = (cat ? inMonth.filter((r) => r.category === cat) : inMonth).slice(0, 60);

  const recat = async (r: Row, c: string) => {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, category: c } : x)));
    await createClient().from("transactions").update({ category: c }).eq("id", r.id);
  };

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Spending</h2>
          <p className="text-sm text-muted">{rows.length ? "From your uploaded statements" : "Upload a bank statement to see where your money goes"}</p>
        </div>
        <button className="btn btn-primary shrink-0" onClick={() => setImporting(true)}>
          <FileUp size={16} /> Upload
        </button>
      </div>

      {rows.length > 0 && m && (
        <>
          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
            {months.slice(0, 12).map((mm) => (
              <button key={mm} onClick={() => (setMonth(mm), setCat(null))} className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ${mm === m ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>
                {new Date(`${mm}-15T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: mm.slice(0, 4) === String(new Date().getFullYear()) ? undefined : "2-digit" })}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="text-xs text-muted">Spent</p>
              <p className="num-in font-display text-2xl font-bold tabular-nums">{gbp(totalOut, 0)}</p>
              {prevOut != null && prevOut > 0 && (
                <p className="text-xs font-medium" style={{ color: totalOut <= prevOut ? "var(--c-money)" : "#ff3b30" }}>
                  {totalOut <= prevOut ? "↓" : "↑"} {gbp(Math.abs(totalOut - prevOut), 0)} vs last month
                </p>
              )}
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="text-xs text-muted">Money in</p>
              <p className="num-in font-display text-2xl font-bold tabular-nums text-[var(--c-money)]">{gbp(totalIn, 0)}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {byCat.map(([c, v]) => (
              <li key={c}>
                <button className={`w-full rounded-xl px-1 py-1 text-left transition-colors ${cat === c ? "bg-accent-soft" : ""}`} onClick={() => setCat(cat === c ? null : c)}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">
                      {CAT_EMOJI[c] ?? "📦"} {c}
                    </span>
                    <span className="font-semibold tabular-nums">{gbp(v)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="bar-x h-full rounded-full bg-accent" style={{ width: `${(v / (byCat[0]?.[1] || 1)) * 100}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <h3 className="mb-1 mt-5 text-sm font-semibold">
            {cat ? <span className="capitalize">{cat}</span> : "Transactions"}{" "}
            {cat && (
              <button className="ml-2 text-xs text-accent" onClick={() => setCat(null)}>
                show all
              </button>
            )}
          </h3>
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2">{CAT_EMOJI[r.category] ?? "📦"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.description}</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    {new Date(`${r.posted_on}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ·
                    <select value={r.category} onChange={(e) => recat(r, e.target.value)} className="bg-transparent capitalize text-muted outline-none" aria-label="Category">
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </span>
                </span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${r.amount > 0 ? "text-[var(--c-money)]" : ""}`}>
                  {r.amount > 0 ? "+" : ""}
                  {gbp(Number(r.amount))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-[11px] text-faint">Statements are read once to pull out the transactions — the file itself isn&apos;t kept. Nothing is linked to your bank.</p>
      <ImportSheet open={importing} onClose={() => setImporting(false)} onDone={load} />
    </section>
  );
}

function ImportSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [account, setAccount] = useState("Pockit");
  const [result, setResult] = useState<string | null>(null);

  const reset = () => {
    setTxns(null);
    setErr(null);
    setResult(null);
    setFileName("");
  };

  const read = async (f: File) => {
    reset();
    setFileName(f.name);
    setBusy(true);
    try {
      let out: Txn[] = [];
      if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
        const sb = createClient();
        const { data } = await sb.auth.getSession();
        const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/statement-text`, {
          method: "POST",
          headers: { authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", "content-type": "application/pdf" },
          body: f,
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        out = parsePdfLines(j.lines ?? []);
      } else {
        out = parseCsv(await f.text());
      }
      if (!out.length) throw new Error("I couldn't find any transactions in that file. If it's a PDF, try the CSV download instead — or send me a screenshot of one page (hide your account number) and I'll adjust the reader.");
      setTxns(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that file");
    }
    setBusy(false);
  };

  const save = async () => {
    if (!txns?.length) return;
    setBusy(true);
    const sb = createClient();
    const dates = txns.map((t) => t.date).sort();
    const { data: imp } = await sb.from("statement_imports").insert({ filename: fileName, account, date_from: dates[0], date_to: dates[dates.length - 1] }).select("id").single();
    const rows = txns.map((t, i) => ({ posted_on: t.date, description: t.description, amount: t.amount, category: t.category, account, import_id: imp?.id ?? null, dedupe_key: `${account}|${dedupeKey(t, i, txns)}` }));
    let added = 0;
    for (let i = 0; i < rows.length; i += 400) {
      const { data, error } = await sb.from("transactions").upsert(rows.slice(i, i + 400), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id");
      if (error) {
        setBusy(false);
        return setErr(error.message);
      }
      added += data?.length ?? 0;
    }
    if (imp?.id) await sb.from("statement_imports").update({ rows_added: added }).eq("id", imp.id);
    setBusy(false);
    setResult(`Added ${added} transaction${added === 1 ? "" : "s"}${added < rows.length ? ` (${rows.length - added} were already in from an earlier upload)` : ""}.`);
    setTxns(null);
    onDone();
  };

  const out = txns?.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0) ?? 0;
  const inn = txns?.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0) ?? 0;

  return (
    <Sheet open={open} title="Upload a bank statement" onClose={() => (reset(), onClose())}>
      <input ref={fileRef} type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
      {!txns && !result && (
        <>
          <button className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line p-6 text-sm text-muted" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={24} className="animate-spin text-accent" /> : <FileUp size={24} className="text-accent" />}
            <span className="font-medium text-ink">{busy ? `Reading ${fileName}…` : "Choose your statement (PDF or CSV)"}</span>
            <span>In Pockit: Account → Statements → download, then pick it here.</span>
          </button>
          <label className="mt-3 flex items-center justify-between text-sm">
            <span className="font-medium">Account</span>
            <input value={account} onChange={(e) => setAccount(e.target.value.slice(0, 30))} className="min-h-10 w-40 rounded-xl bg-surface-2 px-3 text-right text-base outline-none" />
          </label>
        </>
      )}
      {err && <ErrorNote message={err} />}
      {result && (
        <div className="space-y-3 text-center">
          <p className="text-3xl">✅</p>
          <p className="font-semibold">{result}</p>
          <button className="btn btn-primary w-full" onClick={() => (reset(), onClose())}>
            Done
          </button>
        </div>
      )}
      {txns && (
        <div className="space-y-3">
          <p className="text-sm">
            Found <strong>{txns.length}</strong> transactions from {new Date(`${txns.map((t) => t.date).sort()[0]}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to{" "}
            {new Date(`${txns.map((t) => t.date).sort().at(-1)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — {gbp(out, 0)} out, {gbp(inn, 0)} in. Check they look right:
          </p>
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-2xl bg-surface-2 px-3">
            {txns.slice(0, 200).map((t, i) => (
              <li key={i} className="flex items-center gap-2 py-2 text-sm">
                <span className="w-12 shrink-0 text-xs text-muted">{t.date.slice(8)}/{t.date.slice(5, 7)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {CAT_EMOJI[t.category]} {t.description}
                </span>
                <span className={`shrink-0 tabular-nums ${t.amount > 0 ? "text-[var(--c-money)]" : ""}`}>{gbp(t.amount)}</span>
                <button aria-label="Leave this one out" className="text-faint" onClick={() => setTxns((ts) => ts!.filter((_, k) => k !== i))}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">If money in and out look swapped or wrong, tell me and I&apos;ll tune the reader for Pockit&apos;s layout.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={reset}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} Save {txns.length}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
