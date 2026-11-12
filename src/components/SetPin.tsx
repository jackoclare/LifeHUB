"use client";

import { CheckCircle2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PinPad } from "./PinPad";

/** Lets a signed-in person set or change their unlock PIN. */
export function SetPin() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"first" | "confirm">("first");
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    createClient()
      .rpc("app_pin_status")
      .then(({ data }) => setHasPin(Boolean((data as { my_pin?: boolean } | null)?.my_pin)));
  }, [done]);

  const reset = () => {
    setStep("first");
    setFirst("");
    setError(null);
  };

  const submit = async (pin: string) => {
    if (step === "first") {
      setFirst(pin);
      setStep("confirm");
      setError(null);
      return;
    }
    if (pin !== first) {
      setError("Those didn't match — start again");
      setStep("first");
      setFirst("");
      return;
    }
    setBusy(true);
    const { error } = await createClient().rpc("set_app_pin", { p_pin: pin });
    setBusy(false);
    if (error) {
      setError(error.message);
      setStep("first");
      setFirst("");
      return;
    }
    setDone(true);
    setOpen(false);
    reset();
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="icon-tile" style={{ "--tile": "var(--accent)" } as React.CSSProperties}>
          <KeyRound size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Unlock PIN</p>
          <p className="text-xs text-muted">
            {hasPin === null ? "Checking…" : hasPin ? "Set — use it to unlock on any device" : "Not set yet — set one so you never need your password"}
          </p>
        </div>
        {!open && (
          <button
            className={`btn ${hasPin ? "btn-ghost" : "btn-primary"}`}
            onClick={() => {
              reset();
              setDone(false);
              setOpen(true);
            }}
          >
            {hasPin ? "Change" : "Set PIN"}
          </button>
        )}
      </div>
      {done && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--c-money)]">
          <CheckCircle2 size={16} /> PIN saved
        </p>
      )}
      {open && (
        <div className="mt-5 text-center">
          <p className="mb-4 text-sm font-semibold">{step === "first" ? "Choose a PIN (4–8 digits), then tap OK" : "Enter it again to confirm"}</p>
          <PinPad key={step} allowVariable onSubmit={submit} busy={busy} error={error} />
          <p className="mt-3 min-h-5 text-sm text-red-400">{error}</p>
          <button className="btn btn-ghost mt-1" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
