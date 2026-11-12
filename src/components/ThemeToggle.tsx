"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("mlh.theme", t);
  } catch {
    /* storage unavailable — theme still applies for this visit */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) ?? "dark");
  }, []);
  const set = (t: Theme) => {
    applyTheme(t);
    setTheme(t);
  };
  return [theme, set] as const;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className={
        compact
          ? "grid size-11 place-items-center rounded-full text-muted transition-colors hover:text-ink"
          : "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      }
    >
      <Icon size={18} />
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
