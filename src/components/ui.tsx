"use client";

import { Loader2, X } from "lucide-react";
import { useEffect } from "react";

export const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
export const money = (n: number | null | undefined) => (n == null || Number.isNaN(Number(n)) ? "—" : gbp.format(Number(n)));

/** Bottom sheet on iPhone, centred dialog on desktop. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="sheet-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet-panel pb-safe relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.6rem] border border-line bg-bg-elevated p-5 shadow-2xl sm:max-w-lg sm:rounded-[1.6rem]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-surface-2 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-base outline-none transition-colors focus:border-accent"; // text-base stops iPhone zooming

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-medium text-muted ${className}`}>
      {label}
      {children}
    </label>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
      <Loader2 size={18} className="animate-spin" /> {label}…
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{message}</p>;
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-faint">{icon}</div>
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="card inline-flex gap-1 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-h-10 rounded-xl px-3.5 text-sm font-semibold transition-colors ${value === o.value ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="card p-4" style={{ "--tile": tone } as React.CSSProperties}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums sm:text-2xl" style={{ color: tone }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}
