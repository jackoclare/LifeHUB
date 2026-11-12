"use client";

import { Delete, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/** iPhone-style PIN keypad with animated dots. Calls onSubmit when `length` digits are entered. */
export function PinPad({
  length = 6,
  onSubmit,
  busy,
  error,
  allowVariable = false,
}: {
  length?: number;
  onSubmit: (pin: string) => void;
  busy?: boolean;
  error?: string | null;
  /** Let the person submit 4–8 digits with an OK button (for setting a PIN). */
  allowVariable?: boolean;
}) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (error) {
      setShake(true);
      setPin("");
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [error]);

  const press = (d: string) => {
    if (busy) return;
    if (typeof navigator !== "undefined") navigator.vibrate?.(6);
    setPin((p) => {
      const next = (p + d).slice(0, allowVariable ? 8 : length);
      if (!allowVariable && next.length === length) setTimeout(() => onSubmit(next), 120);
      return next;
    });
  };
  const back = () => !busy && setPin((p) => p.slice(0, -1));

  // Physical keyboard support on a computer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter" && allowVariable && pin.length >= 4) onSubmit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const dots = allowVariable ? Math.max(4, pin.length) : length;

  return (
    <div className="mx-auto w-full max-w-[18rem]">
      <div className={`mb-6 flex h-6 items-center justify-center gap-3 ${shake ? "animate-shake" : ""}`} aria-live="polite" aria-label={`${pin.length} digits entered`}>
        {busy ? (
          <Loader2 className="animate-spin text-accent" size={22} />
        ) : (
          Array.from({ length: dots }, (_, i) => (
            <span
              key={i}
              className={`size-3.5 rounded-full border-2 transition-all duration-200 ${
                i < pin.length ? "scale-110 border-accent bg-accent shadow-[0_0_12px_var(--accent)]" : "border-line"
              }`}
            />
          ))
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        {allowVariable ? (
          <button
            type="button"
            onClick={() => pin.length >= 4 && onSubmit(pin)}
            disabled={pin.length < 4 || busy}
            className="aspect-square rounded-full text-sm font-semibold text-accent disabled:opacity-30"
          >
            OK
          </button>
        ) : (
          <span />
        )}
        <Key onClick={() => press("0")}>0</Key>
        <button type="button" onClick={back} className="grid aspect-square place-items-center rounded-full text-muted active:scale-90" aria-label="Delete">
          <Delete size={22} />
        </button>
      </div>
    </div>
  );
}

function Key({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-square rounded-full bg-surface-2/80 font-display text-2xl font-medium transition-[transform,background-color] duration-150 hover:bg-surface-2 active:scale-90 active:bg-accent-soft"
    >
      {children}
    </button>
  );
}
