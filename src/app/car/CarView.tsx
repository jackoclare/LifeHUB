"use client";

import { Car, Fuel, Gauge, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { ErrorNote, Field, Sheet, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useRows } from "@/lib/useRows";
import { WarningLight } from "./WarningLight";

export type Vehicle = {
  id: string;
  nickname: string | null;
  make: string;
  model: string | null;
  reg: string | null;
  year: number | null;
  fuel_type: string | null;
  mileage: number | null;
  mot_due: string | null;
  tax_due: string | null;
  insurance_due: string | null;
  service_due: string | null;
  notes: string | null;
};
type Log = { id: string; vehicle_id: string; kind: string; logged_on: string; cost: number | null; litres: number | null; mileage: number | null; notes: string | null };

const DUE = [
  ["mot_due", "MOT"],
  ["tax_due", "Road tax"],
  ["insurance_due", "Insurance"],
  ["service_due", "Service"],
] as const;
const KINDS = ["fuel", "service", "repair", "mot", "tax", "insurance", "parking", "other"];

export const daysUntil = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(new Date().toDateString() + " 12:00").getTime()) / 864e5);
const dueText = (d: number) => (d < 0 ? `${-d} day${d === -1 ? "" : "s"} overdue` : d === 0 ? "today" : d === 1 ? "tomorrow" : d < 60 ? `in ${d} days` : `in ${Math.round(d / 30)} months`);
const dueColor = (d: number) => (d < 0 ? "#ff3b30" : d <= 14 ? "#ff9500" : d <= 30 ? "#ffcc00" : "var(--c-money)");
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export function CarView() {
  const { user, loading } = useAuth();
  const vehicles = useRows<Vehicle>("vehicles", [{ column: "created_at" }], Boolean(user));
  const logs = useRows<Log>("vehicle_logs", [{ column: "logged_on", ascending: false }], Boolean(user));
  const [edit, setEdit] = useState<Partial<Vehicle> | null>(null);
  const [logFor, setLogFor] = useState<Vehicle | null>(null);

  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to see your vehicles." />;

  return (
    <div className="space-y-4">
      {vehicles.rows.length === 0 && !vehicles.loading && (
        <div className="card p-6 text-center">
          <Car className="mx-auto text-[var(--c-travel)]" size={30} />
          <p className="mt-2 font-semibold">Add your car</p>
          <p className="mt-1 text-sm text-muted">Get reminders before your MOT, tax, insurance and service are due, and track what it costs to run.</p>
          <button className="btn btn-primary mt-4" onClick={() => setEdit({ fuel_type: "petrol" })}>
            <Plus size={16} /> Add a vehicle
          </button>
        </div>
      )}

      {vehicles.rows.map((v, i) => (
        <VehicleCard key={v.id} v={v} i={i} logs={logs.rows.filter((l) => l.vehicle_id === v.id)} onEdit={() => setEdit(v)} onLog={() => setLogFor(v)} />
      ))}

      {vehicles.rows.length > 0 && (
        <button className="btn btn-ghost w-full" onClick={() => setEdit({ fuel_type: "petrol" })}>
          <Plus size={16} /> Add another vehicle
        </button>
      )}

      <WarningLight vehicles={vehicles.rows} />

      <p className="text-xs text-faint">
        Check your official MOT and tax dates on GOV.UK:{" "}
        <a className="text-accent" href="https://www.check-mot.service.gov.uk/" target="_blank" rel="noopener noreferrer">
          MOT history
        </a>{" "}
        ·{" "}
        <a className="text-accent" href="https://www.gov.uk/check-vehicle-tax" target="_blank" rel="noopener noreferrer">
          vehicle tax
        </a>
        .
      </p>

      <VehicleSheet value={edit} onClose={() => setEdit(null)} onSaved={vehicles.reload} />
      <LogSheet vehicle={logFor} onClose={() => setLogFor(null)} onSaved={logs.reload} />
    </div>
  );
}

function VehicleCard({ v, i, logs, onEdit, onLog }: { v: Vehicle; i: number; logs: Log[]; onEdit: () => void; onLog: () => void }) {
  const stats = useMemo(() => {
    const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const recent = logs.filter((l) => l.logged_on >= yearAgo);
    const total = recent.reduce((s, l) => s + Number(l.cost ?? 0), 0);
    const fuel = recent.filter((l) => l.kind === "fuel").reduce((s, l) => s + Number(l.cost ?? 0), 0);
    // mpg from fill-ups with mileage
    const fills = logs.filter((l) => l.kind === "fuel" && l.mileage && l.litres).sort((a, b) => (a.mileage! < b.mileage! ? -1 : 1));
    let mpg: number | null = null;
    if (fills.length >= 2) {
      const miles = fills[fills.length - 1].mileage! - fills[0].mileage!;
      const litres = fills.slice(1).reduce((s, l) => s + Number(l.litres), 0);
      if (miles > 0 && litres > 0) mpg = miles / (litres / 4.54609);
    }
    return { total, fuel, mpg };
  }, [logs]);

  return (
    <section className="card animate-rise overflow-hidden" style={{ animationDelay: `${i * 70}ms` }}>
      <div className="flex items-start gap-3 p-5">
        <span className="icon-tile size-12!" style={{ "--tile": "var(--c-travel)" } as React.CSSProperties}>
          <Car size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight">{v.nickname || `${v.make} ${v.model ?? ""}`.trim()}</p>
          <p className="text-sm text-muted">{[v.nickname ? `${v.make} ${v.model ?? ""}`.trim() : null, v.year, v.fuel_type].filter(Boolean).join(" · ")}</p>
          {v.reg && <span className="mt-2 inline-block rounded-md bg-[#ffd400] px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-black">{v.reg.toUpperCase()}</span>}
        </div>
        <button className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted" aria-label="Edit vehicle" onClick={onEdit}>
          <Pencil size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-4">
        {DUE.map(([k, label]) => {
          const d = v[k] ? daysUntil(v[k]!) : null;
          return (
            <div key={k} className="bg-surface p-3">
              <p className="text-xs text-muted">{label}</p>
              {d == null ? (
                <button className="text-sm font-semibold text-accent" onClick={onEdit}>
                  Add date
                </button>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={{ color: dueColor(d) }}>
                    {dueText(d)}
                  </p>
                  <p className="text-[11px] text-faint">{new Date(`${v[k]}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="flex items-center justify-center gap-1 text-xs text-muted">
            <Gauge size={12} /> Mileage
          </p>
          <p className="font-semibold tabular-nums">{v.mileage != null ? v.mileage.toLocaleString("en-GB") : "–"}</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-1 text-xs text-muted">
            <Fuel size={12} /> Economy
          </p>
          <p className="font-semibold tabular-nums">{stats.mpg ? `${stats.mpg.toFixed(1)} mpg` : "–"}</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-1 text-xs text-muted">
            <Wrench size={12} /> Last 12 months
          </p>
          <p className="font-semibold tabular-nums">{gbp(stats.total)}</p>
        </div>
      </div>
      {logs.length > 0 && (
        <ul className="border-t border-line">
          {logs.slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-b-0">
              <span className="w-20 shrink-0 text-xs text-muted">{new Date(`${l.logged_on}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              <span className="flex-1 capitalize">
                {l.kind}
                {l.litres ? ` · ${Number(l.litres)}L` : ""}
                {l.notes ? <span className="text-muted"> · {l.notes}</span> : null}
              </span>
              <span className="font-semibold tabular-nums">{l.cost != null ? gbp(Number(l.cost)) : ""}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="flex w-full items-center justify-center gap-2 border-t border-line py-3 text-sm font-semibold text-accent" onClick={onLog}>
        <Plus size={16} /> Log fuel, service or cost
      </button>
    </section>
  );
}

function VehicleSheet({ value, onClose, onSaved }: { value: Partial<Vehicle> | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Partial<Vehicle>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = value !== null;
  // reset when opened
  const key = value ? (value.id ?? "new") : "";
  const [lastKey, setLastKey] = useState("");
  if (key !== lastKey) {
    setLastKey(key);
    setV(value ?? {});
    setErr(null);
  }
  const set = (k: keyof Vehicle, val: string) => setV((p) => ({ ...p, [k]: val === "" ? null : k === "mileage" || k === "year" ? Number(val) : val }));

  const save = async () => {
    if (!v.make?.trim()) return setErr("Add the make, e.g. Ford");
    setBusy(true);
    const row = { nickname: v.nickname ?? null, make: v.make, model: v.model ?? null, reg: v.reg ? v.reg.toUpperCase().replace(/\s+/g, " ") : null, year: v.year ?? null, fuel_type: v.fuel_type ?? null, mileage: v.mileage ?? null, mot_due: v.mot_due ?? null, tax_due: v.tax_due ?? null, insurance_due: v.insurance_due ?? null, service_due: v.service_due ?? null, notes: v.notes ?? null };
    const sb = createClient();
    const { error } = v.id ? await sb.from("vehicles").update(row).eq("id", v.id) : await sb.from("vehicles").insert(row);
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved();
    onClose();
  };
  const remove = async () => {
    if (!v.id || !confirm("Remove this vehicle and its history?")) return;
    await createClient().from("vehicles").delete().eq("id", v.id);
    onSaved();
    onClose();
  };

  return (
    <Sheet open={open} title={v.id ? "Edit vehicle" : "Add a vehicle"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Make">
          <input className={inputClass} value={v.make ?? ""} onChange={(e) => set("make", e.target.value)} placeholder="Ford" />
        </Field>
        <Field label="Model">
          <input className={inputClass} value={v.model ?? ""} onChange={(e) => set("model", e.target.value)} placeholder="Focus" />
        </Field>
        <Field label="Registration">
          <input className={`${inputClass} uppercase`} value={v.reg ?? ""} onChange={(e) => set("reg", e.target.value)} placeholder="AB12 CDE" />
        </Field>
        <Field label="Nickname (optional)">
          <input className={inputClass} value={v.nickname ?? ""} onChange={(e) => set("nickname", e.target.value)} />
        </Field>
        <Field label="Year">
          <input className={inputClass} inputMode="numeric" value={v.year ?? ""} onChange={(e) => set("year", e.target.value)} />
        </Field>
        <Field label="Fuel">
          <select className={inputClass} value={v.fuel_type ?? ""} onChange={(e) => set("fuel_type", e.target.value)}>
            {["petrol", "diesel", "hybrid", "electric", "other"].map((f) => (
              <option key={f} value={f}>
                {f[0].toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mileage" className="col-span-2">
          <input className={inputClass} inputMode="numeric" value={v.mileage ?? ""} onChange={(e) => set("mileage", e.target.value)} />
        </Field>
        {DUE.map(([k, label]) => (
          <Field key={k} label={`${label} due`}>
            <input type="date" className={inputClass} value={(v[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
      </div>
      {err && <ErrorNote message={err} />}
      <div className="mt-4 flex gap-2">
        {v.id && (
          <button className="btn btn-ghost text-red-500!" onClick={remove} aria-label="Remove vehicle">
            <Trash2 size={16} />
          </button>
        )}
        <button className="btn btn-primary flex-1" disabled={busy} onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  );
}

function LogSheet({ vehicle, onClose, onSaved }: { vehicle: Vehicle | null; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState("fuel");
  const [cost, setCost] = useState("");
  const [litres, setLitres] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!vehicle) return;
    const sb = createClient();
    const { error } = await sb.from("vehicle_logs").insert({
      vehicle_id: vehicle.id,
      kind,
      logged_on: date,
      cost: cost ? Number(cost) : null,
      litres: kind === "fuel" && litres ? Number(litres) : null,
      mileage: mileage ? Number(mileage) : null,
      notes: notes || null,
    });
    if (error) return setErr(error.message);
    if (mileage && Number(mileage) > (vehicle.mileage ?? 0)) await sb.from("vehicles").update({ mileage: Number(mileage) }).eq("id", vehicle.id);
    setCost("");
    setLitres("");
    setMileage("");
    setNotes("");
    onSaved();
    onClose();
  };

  return (
    <Sheet open={!!vehicle} title="Add to log" onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`min-h-9 rounded-full px-3 text-sm font-semibold capitalize ${kind === k ? "bg-accent text-white" : "bg-surface-2 text-muted"}`}>
            {k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost (£)">
          <input className={inputClass} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Date">
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {kind === "fuel" && (
          <Field label="Litres">
            <input className={inputClass} inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} />
          </Field>
        )}
        <Field label="Mileage now">
          <input className={inputClass} inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={kind === "fuel" ? "e.g. Asda Solihull" : "e.g. new tyres"} />
        </Field>
      </div>
      {err && <ErrorNote message={err} />}
      <button className="btn btn-primary mt-4 w-full" onClick={save}>
        Save
      </button>
    </Sheet>
  );
}
