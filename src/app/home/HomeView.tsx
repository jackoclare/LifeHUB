"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { Field, Sheet, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useRows } from "@/lib/useRows";

export type HomeTask = { id: string; name: string; area: string; every_days: number | null; next_due: string | null; last_done: string | null; notes: string | null };
const AREAS = [
  { id: "cleaning", label: "Cleaning", emoji: "🧽" },
  { id: "maintenance", label: "Maintenance", emoji: "🔧" },
  { id: "garden", label: "Garden", emoji: "🌱" },
  { id: "appliances", label: "Appliances", emoji: "🔌" },
  { id: "admin", label: "Admin", emoji: "📋" },
  { id: "other", label: "Other", emoji: "🏠" },
];
const STARTERS: { name: string; area: string; every: number }[] = [
  { name: "Change bedding", area: "cleaning", every: 7 },
  { name: "Clean the bathroom", area: "cleaning", every: 7 },
  { name: "Hoover", area: "cleaning", every: 7 },
  { name: "Test smoke alarms", area: "maintenance", every: 30 },
  { name: "Boiler service", area: "maintenance", every: 365 },
  { name: "Bleed radiators", area: "maintenance", every: 365 },
  { name: "Mow the lawn", area: "garden", every: 14 },
  { name: "Descale kettle", area: "appliances", every: 60 },
  { name: "Clean washing machine", area: "appliances", every: 30 },
  { name: "Check energy meter readings", area: "admin", every: 30 },
];
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const plus = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysUntil = (iso: string) => Math.round((new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${today()}T12:00:00Z`).getTime()) / 864e5);
const everyLabel = (n: number | null) => (!n ? "One-off" : n === 1 ? "Daily" : n === 7 ? "Weekly" : n === 14 ? "Fortnightly" : n % 365 === 0 ? (n === 365 ? "Yearly" : `Every ${n / 365} years`) : n % 30 === 0 ? (n === 30 ? "Monthly" : `Every ${n / 30} months`) : `Every ${n} days`);

export function HomeView() {
  const { user, loading } = useAuth();
  const tasks = useRows<HomeTask>("home_tasks", [{ column: "next_due" }], Boolean(user));
  const [edit, setEdit] = useState<Partial<HomeTask> | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);

  const sorted = useMemo(() => [...tasks.rows].sort((a, b) => (a.next_due ?? "9999") < (b.next_due ?? "9999") ? -1 : 1), [tasks.rows]);
  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to see your home jobs." />;

  const done = async (t: HomeTask) => {
    setJustDone(t.id);
    const d = today();
    await createClient()
      .from("home_tasks")
      .update({ last_done: d, next_due: t.every_days ? plus(d, t.every_days) : null })
      .eq("id", t.id);
    setTimeout(() => setJustDone(null), 900);
    tasks.reload();
  };
  const addStarters = async () => {
    const d = today();
    await createClient()
      .from("home_tasks")
      .insert(STARTERS.map((s, i) => ({ name: s.name, area: s.area, every_days: s.every, next_due: plus(d, Math.min(s.every, 3 + i)) })));
    tasks.reload();
  };

  return (
    <div className="space-y-4">
      {tasks.rows.length === 0 && !tasks.loading ? (
        <div className="card p-6 text-center">
          <p className="text-3xl">🏡</p>
          <p className="mt-2 font-semibold">Keep on top of the house</p>
          <p className="mt-1 text-sm text-muted">Cleaning rota, boiler service, smoke alarms, garden jobs — tick them off and they come back round automatically.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button className="btn btn-primary" onClick={addStarters}>
              Start with common jobs
            </button>
            <button className="btn btn-ghost" onClick={() => setEdit({ area: "cleaning", every_days: 7 })}>
              <Plus size={16} /> Add my own
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul className="card stagger divide-y divide-line overflow-hidden">
            {sorted.map((t, i) => {
              const d = t.next_due ? daysUntil(t.next_due) : null;
              const a = AREAS.find((x) => x.id === t.area);
              return (
                <li key={t.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties} className="flex items-center gap-3 px-4 py-3">
                  <button
                    aria-label={`Mark ${t.name} done`}
                    onClick={() => done(t)}
                    className={`grid size-9 shrink-0 place-items-center rounded-full border-2 transition-all duration-300 ${justDone === t.id ? "scale-110 border-[var(--c-money)] bg-[var(--c-money)] text-white" : "border-line text-transparent hover:border-[var(--c-money)]"}`}
                  >
                    <Check size={16} />
                  </button>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(t)}>
                    <span className="block truncate font-medium">
                      {a?.emoji} {t.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {everyLabel(t.every_days)}
                      {d != null && (
                        <span style={{ color: d < 0 ? "#ff3b30" : d <= 1 ? "#ff9500" : undefined }}>
                          {" "}
                          · {d < 0 ? `${-d} days overdue` : d === 0 ? "due today" : d === 1 ? "due tomorrow" : `due in ${d} days`}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="btn btn-ghost w-full" onClick={() => setEdit({ area: "cleaning", every_days: 7 })}>
            <Plus size={16} /> Add a job
          </button>
        </>
      )}
      <TaskSheet value={edit} onClose={() => setEdit(null)} onSaved={tasks.reload} />
    </div>
  );
}

function TaskSheet({ value, onClose, onSaved }: { value: Partial<HomeTask> | null; onClose: () => void; onSaved: () => void }) {
  const [t, setT] = useState<Partial<HomeTask>>({});
  const [k, setK] = useState("");
  const key = value ? (value.id ?? "new") : "";
  if (key !== k) {
    setK(key);
    setT(value ? { next_due: today(), ...value } : {});
  }
  const save = async () => {
    if (!t.name?.trim()) return;
    const row = { name: t.name.trim(), area: t.area ?? "other", every_days: t.every_days || null, next_due: t.next_due || null, notes: t.notes || null };
    const sb = createClient();
    if (t.id) await sb.from("home_tasks").update(row).eq("id", t.id);
    else await sb.from("home_tasks").insert(row);
    onSaved();
    onClose();
  };
  const remove = async () => {
    if (!t.id) return;
    await createClient().from("home_tasks").delete().eq("id", t.id);
    onSaved();
    onClose();
  };
  return (
    <Sheet open={value !== null} title={t.id ? "Edit job" : "New job"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job" className="col-span-2">
          <input autoFocus className={inputClass} value={t.name ?? ""} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="e.g. Clean the oven" />
        </Field>
        <Field label="Area">
          <select className={inputClass} value={t.area ?? "other"} onChange={(e) => setT({ ...t, area: e.target.value })}>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji} {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Repeats">
          <select className={inputClass} value={t.every_days ?? 0} onChange={(e) => setT({ ...t, every_days: Number(e.target.value) || null })}>
            {[0, 1, 7, 14, 30, 60, 90, 180, 365].map((n) => (
              <option key={n} value={n}>
                {everyLabel(n || null)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Next due" className="col-span-2">
          <input type="date" className={inputClass} value={t.next_due ?? ""} onChange={(e) => setT({ ...t, next_due: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        {t.id && (
          <button className="btn btn-ghost text-red-500!" onClick={remove} aria-label="Delete job">
            <Trash2 size={16} />
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={!t.name?.trim()} onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  );
}
